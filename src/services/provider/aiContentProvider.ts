import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfigService } from 'tabby-core';
import { AICommandItem, AIRequestContext } from "../../api/aiType";
import { EnvBasicInfo, OptionItem } from "../../api/pluginType";
import { AIPromptConfirmDialogComponent } from "components/aiPromptConfirmDialog";
import { MyLogger } from "services/myLogService";
import { AICompletionService } from "services/aiCompletionService";
import { AIPromptService } from "services/aiPromptService";
import { isValidStr, sleep } from "utils/commonUtils";
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";

/**
 * AI 生成结果使用的分组 key。
 * "a" 已被 argumentsContentProvider 占用，故 AI 使用独立的 "i"。
 */
export const AI_PROVIDER_TYPE_KEY = "i";

/**
 * AI 内容提供者。
 *
 * 三档行为：
 * - off:    返回 null，不产出任何条目
 * - manual: 返回一条 "ask AI" 入口项，选中后才发起请求（异步 callback，菜单先显示 loading）
 * - auto:   输入停顿后自动请求。Promise 延迟到结果返回才 resolve，
 *           因此列表不会先插入 loading 再抖动；过期结果自行丢弃。
 *
 * 依赖方向约束：本类只允许依赖 menuService 之外的服务，
 * 不得反向引用 AddMenuService，否则会造成循环依赖。
 */
@Injectable({
    providedIn: 'root'
})
export class AIContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = AI_PROVIDER_TYPE_KEY;
    /** 最近一次被接受的自动补全请求标识，用于丢弃过期结果 */
    private latestRequestKey: string = "";

    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
        private ngbModal: NgbModal,
        private aiPrompt: AIPromptService,
        private aiCompletion: AICompletionService,
    ) {
        super(logger, configService);
    }

    private get aiConfig(): any {
        return this.configService.store?.ogAutoCompletePlugin?.ai;
    }

    async getQuickCmdList(inputCmd: string, cursorIndexAt: number, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        const mode = this.aiPrompt.getEnableMode();
        if (mode === 'off') {
            return null;
        }
        const cmd = (inputCmd ?? '').trim();
        if (!isValidStr(cmd)) {
            return null;
        }

        if (mode === 'manual') {
            return {
                optionItem: [this.buildManualEntry(cmd, envBasicInfo)],
                envBasicInfo: envBasicInfo,
                type: AIContentProvider.providerTypeKey
            };
        }

        // auto
        const minLength = Number(this.aiConfig?.inlineMinLength) > 0 ? Number(this.aiConfig.inlineMinLength) : 3;
        if (cmd.length < minLength) {
            return null;
        }
        const debounce = Number(this.aiConfig?.inlineDebounce) >= 0 ? Number(this.aiConfig.inlineDebounce) : 800;

        const requestKey = `${envBasicInfo?.sessionId ?? ''}|${cmd}`;
        this.latestRequestKey = requestKey;

        await sleep(debounce);
        if (!this.isStillLatest(requestKey)) {
            this.logger.debug("AI request abandoned for newer input", requestKey);
            return null;
        }

        const items = await this.generateAsync(cmd, envBasicInfo, false);
        if (!this.isStillLatest(requestKey)) {
            this.logger.debug("AI result abandoned for newer input", requestKey);
            return null;
        }
        if (items == null || items.length === 0) {
            return null;
        }
        return {
            optionItem: items,
            envBasicInfo: envBasicInfo,
            type: AIContentProvider.providerTypeKey
        };
    }

    /**
     * 当前请求是否为最新一次请求。
     */
    private isStillLatest(requestKey: string): boolean {
        return this.latestRequestKey === requestKey;
    }

    /**
     * manual 档的入口项。选中后由菜单渲染 loading 占位，结果到达后整组替换。
     */
    private buildManualEntry(cmd: string, envBasicInfo: EnvBasicInfo): OptionItem {
        return {
            name: "ask ai for help",
            content: cmd,
            desp: "",
            type: AIContentProvider.providerTypeKey,
            callback: () => this.generateAsync(cmd, envBasicInfo, true),
        };
    }

    /**
     * 生成 AI 候选条目。
     * @param allowConfirm 是否允许弹出"发送前确认"窗口。auto 档恒为 false。
     */
    async generateAsync(cmd: string, envBasicInfo: EnvBasicInfo, allowConfirm: boolean): Promise<OptionItem[] | null> {
        const ctx: AIRequestContext = {
            ...envBasicInfo,
            inputCmd: cmd,
        };
        let prompt = this.aiPrompt.buildPrompt(ctx);

        if (allowConfirm
            && this.aiConfig?.includeLastOutput === true
            && isValidStr(envBasicInfo?.recentOutput)
            && this.aiCompletion.needConfirm(envBasicInfo.sessionId)) {
            const confirmed = await this.confirmPrompt(prompt, envBasicInfo.sessionId, envBasicInfo.tab);
            if (confirmed == null) {
                // 用户取消
                return null;
            }
            prompt = confirmed;
        }

        const items = await this.aiCompletion.requestCommands(prompt, envBasicInfo?.sessionId ?? '', cmd);
        if (items == null || items.length === 0) {
            return null;
        }
        return items.map(item => this.toOptionItem(item));
    }

    /**
     * 弹出确认窗口，返回用户确认后的 prompt；取消则返回 null。
     */
    private confirmPrompt(prompt: string, sessionId: string, tab?: any): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const ref = this.ngbModal.open(AIPromptConfirmDialogComponent, { backdrop: 'static' });
            ref.componentInstance.promptText = prompt;
            ref.result.then((result: any) => {
                if (result?.neverAskAgain) {
                    this.aiCompletion.setSessionConfirmed(sessionId);
                }
                resolve(isValidStr(result?.prompt) ? result.prompt : prompt);
            }).catch(() => {
                this.logger.debug("AI prompt confirmation cancelled");
                resolve(null);
            }).finally(() => {
                // 弹窗关闭后把焦点还给终端，避免用户需要手动点回终端
                setTimeout(() => this.refocusTerminal(tab), 0);
            });
        });
    }

    private refocusTerminal(tab?: any) {
        try {
            tab?.frontend?.focus();
        } catch (err) {
            this.logger.debug("Refocus terminal failed", err);
        }
    }

    /**
     * AI 结果转为候选项。
     * doNotEnterExec: true —— AI 生成的内容只上屏，不自动执行。
     */
    private toOptionItem(item: AICommandItem): OptionItem {
        return {
            name: item.command,
            content: item.command,
            desp: item.desp,
            type: AIContentProvider.providerTypeKey,
            dangerRating: item.dangerRating,
            doNotEnterExec: true,
            clearThenInput: true,
        };
    }
}
