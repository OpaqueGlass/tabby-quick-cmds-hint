import { Component, forwardRef, HostListener, Inject, Input } from '@angular/core';
import { EnvBasicInfo } from 'api/pluginType';
import OpenAI from 'openai';
import { MyLogger } from 'services/myLogService';
import { AppService, ConfigService, TranslateService } from 'tabby-core';
import jsYaml from "js-yaml"
import { AddMenuService } from 'services/menuService';
import { isValidStr, sendInput } from 'utils/commonUtils';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

interface AICommandItem {
    command: string;
    desp: string;
    dangerRating: number;
}

@Component({
    template: require('./autoCompleteAIDialog.pug'),
    styles: [require('./autoCompleteAIDialog.scss')],
})
export class AutoCompleteAIDialogComponent {
    commands: AICommandItem[] = [];
    selectedIndex: number = -1;
    loadingFlag: boolean = false;
    private openAI: OpenAI;
    askUserInput: string = "";
    notReady: string = "";
    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
         @Inject(forwardRef(() => AddMenuService)) protected addMenuService: AddMenuService,
        protected appService: AppService,
        protected activeModel: NgbActiveModal,
        protected myTranslate: TranslateService,
    ) {
        
    }

    ngOnInit() {
        this.loadOpenAIConfig();
        this.logger.log("AI panel init", this.askUserInput);
        if (isValidStr(this.askUserInput)) {
            // this.ask();
        }
        this.askUserInput = this.addMenuService.getCurrentCmd();
    }

    loadOpenAIConfig() {
        try {
            this.logger.log("infos", this.configService.store.ogAutoCompletePlugin.ai.openAIBaseUrl)
            // https://github.com/openai/openai-node/tree/v4#configuring-an-https-agent-eg-for-proxies
            // if need proxy
            this.openAI = new OpenAI({
                apiKey: this.configService.store.ogAutoCompletePlugin.ai.openAIKey,
                baseURL: this.configService.store.ogAutoCompletePlugin.ai.openAIBaseUrl,
                dangerouslyAllowBrowser: true,
            });
        } catch(err) {
            this.logger.warn("Error occured while loading openai", err);
        }
    }

    ask() {
        this.loadingFlag = true;
        this.notReady = "";
        this.askForCmd(this.askUserInput, null, this.openAI)
        .then((commands) => {
            this.loadingFlag = false;
            if (commands) {
                this.commands = commands;
            } else {
                this.commands = [];
                this.notReady = "Can't recognize the response from AI";
            }
        }).catch(err=>{
            this.logger.error("While asking to gpt, an error occured", err);
            this.notReady = err.message;
            this.loadingFlag = false;
        });
    }

    async askForCmd(inputCmd: string, envBasicInfo: EnvBasicInfo, openai: OpenAI):  Promise<AICommandItem[]> {
        const prompt = `
Given the following user request: "${inputCmd}"
And the current terminal state: "${envBasicInfo || "Not Provided"}"
Generate 3 suggested terminal commands based on the input and state. 
Each command should include:
1. The command itself
2. A brief description of what the command does
3. A danger rating on a scale from 0 (safe) to 5 (dangerous), where:
   - 0: Very safe
   - 1-2: Low risk (e.g., read-only commands)
   - 3-4: Moderate risk (e.g., file or system changes)
   - 5: Very dangerous (e.g., data loss or system instability possible)

Respond with the following JSON format only:

\`\`\`json
[
  {
    "command": "<command>",
    "desp": "<brief description of what the command does>",
    "dangerRating": <danger rating from 0 to 5>
  },
  {
    "command": "<command>",
    "desp": "<brief description of what the command does>",
    "dangerRating": <danger rating from 0 to 5>
  },
  {
    "command": "<command>",
    "desp": "<brief description of what the command does>",
    "dangerRating": <danger rating from 0 to 5>
  }
]
\`\`\`
`;
// // TESTONLY
//         const response = `
//         \`\`\`json
// [
//   {
//     "command": "nvidia-smi -q -d POWER",
//     "desp": "Displays detailed information about the power consumption of the NVIDIA GPU.",
//     "dangerRating": 0
//   },
//   {
//     "command": "nvidia-smi -pl <value>",
//     "desp": "Sets the power limit of the GPU to the specified value (in watts), allowing control over power usage.",
//     "dangerRating": 3
//   },
//   {
//     "command": "nvidia-smi --auto-boost-default=0",
//     "desp": "Disables the default auto-boost feature, which can lead to reduced performance in exchange for lower power consumption.",
//     "dangerRating": 2
//   }
// ]
// \`\`\`
//         `
        const response = await this.initiateConversation(prompt, this.openAI);
        this.logger.log("AI Response", response);
        return this.parseAIResponse(response, "json");
    }

    async initiateConversation(prompt: string, openai: OpenAI): Promise<string> {
        const response = await openai.chat.completions.create({
            model: this.configService.store.ogAutoCompletePlugin.ai.openAIModel,
            messages: [{role: 'user', content: prompt}],
        });
        //@ts-ignore
        if (response?.error) {
            //@ts-ignore
            throw new Error(JSON.stringify(response.error));
        }
        return response.choices[0].message.content;
    }

    async parseAIResponse(response: string, type: "json"|"yaml"): Promise<AICommandItem[]> {
        const codeBlockRegex = /```(json|yaml)([\s\S]*?)```/;
        const match = response.match(codeBlockRegex);
        const content = match ? match[2] : response;
        let result = null;
        if (type == "json") {
            try {
                result = JSON.parse(content) as AICommandItem[];
            } catch (jsonError) {
                this.logger.warn("Error parsing JSON response", jsonError);
            }
        } else {
            try {
                result = jsYaml.load(content) as AICommandItem[];
            } catch (yamlError) {
                this.logger.warn("Error parsing YAML response", yamlError);
            }
        }
        return result;
    }

    handleKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
        } else if (event.key === 'ArrowUp') {
            this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
        } else if (event.key === 'Enter') {
            if (this.selectedIndex >= 0) {
                this.userSelected(this.commands[this.selectedIndex]);
            }else if (this.selectedIndex < 0) {
                this.ask();
            } 
        }
    }
    getRatingColor(cmd: AICommandItem) {
        if (cmd.dangerRating <= 2) {
            return {"rate-safe": true};
        }
        if (cmd.dangerRating <= 4) {
            return {"rate-warn": true};
        }
        return {"rate-danger": true};
    }

    userSelected(cmd: AICommandItem) {
        this.logger.log("userSelected");
        sendInput({
            tab: this.appService.activeTab,
            cmd: this.avoidDirectRun(cmd.command),
            appendCR: false,
            clearFirst: true,
            refocus: true
        });
        this.activeModel.close("任务完成");
    }

    avoidDirectRun(cmd: string) {
        return cmd.replace(/\n/g, ' ');
    }
    isValidStr(s: string) {
        return isValidStr(s);
    }
}