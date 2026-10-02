import { Component, forwardRef, Inject } from '@angular/core';
import { AICommandItem, AIRequestContext } from 'api/aiType';
import { AppService, ConfigService, NotificationsService, TranslateService } from 'tabby-core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MyLogger } from 'services/myLogService';
import { AddMenuService } from 'services/menuService';
import { AIPromptService } from 'services/aiPromptService';
import { AICompletionService } from 'services/aiCompletionService';
import { AutoCompleteTranslateService } from 'services/translateService';
import { isValidStr, sendInput } from 'utils/commonUtils';

/**
 * AI 问答弹窗（快捷键 ogautocomplete_ask_ai 打开）。
 * 具体的请求与解析逻辑已下沉到 AICompletionService，提示词构建下沉到 AIPromptService，
 * 本组件只负责交互与展示。
 */
@Component({
    template: require('./autoCompleteAIDialog.pug'),
    styles: [require('./autoCompleteAIDialog.scss')],
})
export class AutoCompleteAIDialogComponent {
    commands: AICommandItem[] = [];
    selectedIndex: number = -1;
    loadingFlag: boolean = false;
    askUserInput: string = "";
    notReady: string = "";
    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
        @Inject(forwardRef(() => AddMenuService)) protected addMenuService: AddMenuService,
        protected appService: AppService,
        protected activeModel: NgbActiveModal,
        protected myTranslate: TranslateService,
        protected autoCompleteTranslate: AutoCompleteTranslateService,
        protected aiPromptService: AIPromptService,
        protected aiCompletion: AICompletionService,
        protected notifications: NotificationsService,
    ) {

    }

    ngOnInit() {
        this.logger.log("AI panel init", this.askUserInput);
        this.askUserInput = this.addMenuService.getCurrentCmd();
    }

    ask() {
        this.loadingFlag = true;
        this.notReady = "";
        const ctx = this.buildRequestContext();
        const prompt = this.aiPromptService.buildPrompt(ctx);
        this.aiCompletion.requestCommands(prompt, '', this.askUserInput)
            .then((result) => {
                this.loadingFlag = false;
                if (result.error != null) {
                    this.commands = [];
                    this.notReady = this.translate(`ogac.ai.error.${result.error.kind}`);
                    // 弹窗内已有提示，同时发一条通知，避免用户关掉弹窗后无从得知失败原因
                    this.notifications.error(this.notReady, result.error.detail);
                    return;
                }
                this.commands = result.items;
            }).catch(err => {
                this.logger.error("While asking to gpt, an error occured", err);
                this.notReady = err.message;
                this.loadingFlag = false;
            });
    }

    private buildRequestContext(): AIRequestContext {
        return {
            config: this.configService,
            document: window.document,
            // @ts-ignore 弹窗场景作用于当前活跃终端页
            tab: this.appService.activeTab,
            sessionId: '',
            inputCmd: this.askUserInput ?? '',
        };
    }

    handleKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
        } else if (event.key === 'ArrowUp') {
            this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
        } else if (event.key === 'Enter') {
            if (this.selectedIndex >= 0) {
                this.userSelected(this.commands[this.selectedIndex]);
            } else if (this.selectedIndex < 0) {
                this.ask();
            }
        }
    }
    getRatingColor(cmd: AICommandItem) {
        if (cmd.dangerRating <= 2) {
            return { "rate-safe": true };
        }
        if (cmd.dangerRating <= 4) {
            return { "rate-warn": true };
        }
        return { "rate-danger": true };
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

    // 翻译方法
    translate(key: string, params?: any): string {
        return this.myTranslate.instant(key, params);
    }
}
