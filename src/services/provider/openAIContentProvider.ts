import { OptionItem, EnvBasicInfo } from "../../api/pluginType";
import Fuse from 'fuse.js';
import OpenAI from "openai";
import jsYaml from "js-yaml"

interface OpenAICmdItem {
    cmd: string;
    danger_rating: number;
    description: string;
}

export class OpenAIContentProvider {
    openai: OpenAI;
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: 'https://api.openai.com/v4'
        });
    }
    
    // TODO: 需要提供给gpt具体的终端等信息
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItem[]> {
        // xs
        // const quickCmdList = response.split("\n").map((cmd) => {
        //     return {
        //         label: cmd,
        //         description: "Quick Command",
        //         detail: "Quick Command"
        //     };
        // });
        // return quickCmdList;
    }

    async askForCmd(inputCmd: string, envBasicInfo: EnvBasicInfo, openai: OpenAI):  Promise<string[]> {
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

Each command should be provided in the following YAML format:

- command: <command>
  description: <brief description of what the command does>
  danger_rating: <danger rating from 0 to 5, where 0 is safe and 5 is dangerous>

        `;
        const response = await this.initiateConversation(prompt, this.openai);

    }

    async initiateConversation(prompt: string, openai: OpenAI): Promise<string> {
        try {
            const response = await openai.completions.create({
                model: "text-davinci-004",
                prompt: prompt,
                max_tokens: 150
            });
            return response.choices[0].text.trim();
        } catch (error) {
            console.error("Error initiating conversation:", error);
            throw error;
        }
    }

    async parseAiResponse(response: string): Promise<OpenAICmdItem[]> {
        const codeBlockRegex = /```([\s\S]*?)```/;
        const match = response.match(codeBlockRegex);
        const yamlContent = match ? match[1] : response;
        return jsYaml.load(yamlContent) as OpenAICmdItem[];
    }
}
