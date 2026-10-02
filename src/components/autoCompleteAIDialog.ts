import { Component, forwardRef, Inject } from '@angular/core';
import { AICommandItem, AIRequestContext } from 'api/aiType';
import { AppService, ConfigService, NotificationsService, SplitTabComponent, TranslateService } from 'tabby-core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MyLogger } from 'services/myLogService';
import { AddMenuService } from 'services/menuService';
import { AIPromptService } from 'services/aiPromptService';
import { AICompletionService } from 'services/aiCompletionService';
import { AutoCompleteTranslateService } from 'services/translateService';
import { TerminalContextService } from 'services/terminalContextService';
import { isValidStr, sendInput } from 'utils/commonUtils';

/** 预览区最多展示的字符数，避免几百行输出把弹窗撑爆 */
const PREVIEW_MAX_LENGTH = 800;

/**
 * AI 问答弹窗（快捷键 ogautocomplete_ask_ai 打开）。
 * 
 * 具体的请求与解析逻辑已下沉到 AICompletionService，提示词构建下沉到 AIPromptService，
 * 本组件只负责交互与展示
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
    /** 非错误的提示，例如"请先描述你要做的事" */
    notice: string = "";

    /** 本次请求是否附带当前终端输出，初值沿用全局配置 */
    includeTerminalOutput: boolean = false;
    /** 最近一次抓取到的终端输出，用于预览 */
    recentOutput: string = "";
    /** 当前活动页是否有对应的终端采集器（非终端页则为 false） */
    terminalAvailable: boolean = false;
    /** 输出预览是否展开 */
    previewVisible: boolean = false;

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
        protected terminalContext: TerminalContextService,
    ) {

    }

    ngOnInit() {
        this.logger.log("AI panel init", this.askUserInput);
        this.askUserInput = this.addMenuService.getCurrentCmd() ?? "";
        this.terminalAvailable = this.terminalContext.hasManager(this.getActiveTerminalTab());
        // 默认跟随设置项"附带最近的终端输出"，用户可在窗口内临时改选
        this.includeTerminalOutput = this.getAIConfig()?.includeLastOutput === true;
        if (this.includeTerminalOutput && this.terminalAvailable) {
            this.refreshRecentOutput();
        }
    }

    // ---------- 终端上下文选项 ----------

    /**
     * 用户勾选/取消勾选"附带终端输出"。
     * 勾选后立刻抓取一次，让用户先看到将要发送的内容。
     */
    onIncludeOutputChanged(checked: boolean) {
        this.includeTerminalOutput = checked;
        if (!checked) {
            this.recentOutput = "";
            this.previewVisible = false;
            return;
        }
        this.previewVisible = true;
        this.refreshRecentOutput();
    }

    /**
     * 重新抓取当前终端的输出。
     */
    refreshRecentOutput() {
        const tab = this.getActiveTerminalTab();
        if (tab == null) {
            this.recentOutput = "";
            return;
        }
        this.terminalContext.captureRecentOutput(tab).then((output) => {
            this.recentOutput = output ?? "";
            this.logger.debug("Recent terminal output captured", this.recentOutput.length);
        });
    }

    togglePreview() {
        this.previewVisible = !this.previewVisible;
    }

    /**
     * 预览展示（截断）后的输出内容。
     */
    getPreviewText(): string {
        if (!isValidStr(this.recentOutput)) {
            return "";
        }
        if (this.recentOutput.length <= PREVIEW_MAX_LENGTH) {
            return this.recentOutput;
        }
        return `${this.recentOutput.slice(0, PREVIEW_MAX_LENGTH)}\n…`;
    }

    getOutputLength(): number {
        return this.recentOutput?.length ?? 0;
    }

    // ---------- 请求 ----------

    async ask() {
        const input = (this.askUserInput ?? "").trim();
        if (!isValidStr(input)) {
            this.commands = [];
            this.notReady = "";
            this.notice = this.translate('ogac.ai.dialog.empty_input');
            return;
        }
        if (!this.aiCompletion.isConfigured()) {
            this.commands = [];
            this.notReady = "";
            this.notice = this.translate('ogac.ai.error.not_configured');
            return;
        }

        this.loadingFlag = true;
        this.notReady = "";
        this.notice = "";
        this.commands = [];
        this.selectedIndex = -1;

        // 勾选了才抓取，保证发送的是提问当下的最新输出
        let recentOutput = "";
        if (this.includeTerminalOutput) {
            recentOutput = await this.terminalContext.captureRecentOutput(this.getActiveTerminalTab());
            this.recentOutput = recentOutput;
        }
        const ctx = this.buildRequestContext(input, recentOutput);
        const prompt = this.aiPromptService.buildPrompt(ctx, this.includeTerminalOutput);
        this.aiCompletion.requestCommands(prompt, '', input)
            .then((result) => {
                this.loadingFlag = false;
                this.notice = "";
                if (result.error != null) {
                    this.commands = [];
                    this.notReady = this.translate(`ogac.ai.error.${result.error.kind}`);
                    // 弹窗内已有提示，同时发一条通知，避免用户关掉弹窗后无从得知失败原因
                    this.notifications.error(this.notReady, result.error.detail);
                    return;
                }
                this.commands = result.items;
                this.selectedIndex = result.items.length > 0 ? 0 : -1;
            }).catch(err => {
                this.logger.error("While asking to gpt, an error occured", err);
                this.notReady = err.message;
                this.loadingFlag = false;
            });
    }

    private buildRequestContext(input: string, recentOutput: string): AIRequestContext {
        const tab = this.getActiveTerminalTab();
        return {
            config: this.configService,
            document: window.document,
            // @ts-ignore 弹窗场景作用于当前活跃终端页
            tab: tab ?? this.appService.activeTab,
            sessionId: '',
            inputCmd: input,
            cwd: tab == null ? '' : this.terminalContext.getCwd(tab),
            recentOutput: recentOutput,
        };
    }

    /**
     * 当前活跃终端页。分屏时取获得焦点的那一页，取不到返回 null。
     */
    private getActiveTerminalTab(): any {
        const tab: any = this.appService?.activeTab;
        if (tab == null) {
            return null;
        }
        if (tab instanceof SplitTabComponent) {
            return tab.getFocusedTab() ?? null;
        }
        return tab;
    }

    private getAIConfig(): any {
        return this.configService.store?.ogAutoCompletePlugin?.ai;
    }

    /**
     * 尚未配置 API Key 时在窗口顶部提示用户。
     */
    isAIUnconfigured(): boolean {
        return !this.aiCompletion.isConfigured();
    }

    // ---------- 交互 ----------

    handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.close();
            return;
        }
        if (event.key === 'ArrowDown') {
            if (this.commands.length === 0) {
                return;
            }
            this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
        } else if (event.key === 'ArrowUp') {
            if (this.commands.length === 0) {
                return;
            }
            this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
        } else if (event.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.commands.length) {
                this.userSelected(this.commands[this.selectedIndex]);
            } else {
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
        this.close();
    }

    close() {
        this.activeModel.dismiss();
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
