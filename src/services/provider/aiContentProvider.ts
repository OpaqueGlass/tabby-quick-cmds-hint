import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfigService, NotificationsService, TranslateService } from 'tabby-core';
import { AICommandItem, AIErrorInfo, AIRequestContext } from "../../api/aiType";
import { EnvBasicInfo, OptionItem } from "../../api/pluginType";
import { AIPromptConfirmDialogComponent } from "components/aiPromptConfirmDialog";
import { MyLogger } from "services/myLogService";
import { AICompletionService } from "services/aiCompletionService";
import { AIPromptService } from "services/aiPromptService";
import { MenuHidePauseService } from "services/menuPauseService";
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
        private notifications: NotificationsService,
        private translate: TranslateService,
        private menuPause: MenuHidePauseService,
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
            const cached = this.buildCachedItems(cmd, envBasicInfo);
            return {
                optionItem: [...(cached ?? []), this.buildManualEntry(cmd, envBasicInfo)],
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

        // 同一会话里输入过同样的命令：直接把上次的结果交给菜单，
        // 既不用等 debounce，也不用再打一次 AI 请求；入口项一并保留，便于重新请求
        const cachedItems = this.buildCachedItems(cmd, envBasicInfo);
        if (cachedItems != null) {
            return {
                optionItem: [...cachedItems, this.buildManualEntry(cmd, envBasicInfo)],
                envBasicInfo: envBasicInfo,
                type: AIContentProvider.providerTypeKey,
                // 同样是异步补结果，菜单已隐藏则丢弃
                dropIfMenuHidden: true,
            };
        }

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
            optionItem: [...items, this.buildManualEntry(cmd, envBasicInfo)],
            envBasicInfo: envBasicInfo,
            type: AIContentProvider.providerTypeKey,
            // 自动补全是异步到达的，菜单已隐藏则丢弃
            dropIfMenuHidden: true,
        };
    }

    /**
     * 当前请求是否为最新一次请求。
     */
    private isStillLatest(requestKey: string): boolean {
        return this.latestRequestKey === requestKey;
    }

    private buildRequestContext(cmd: string, envBasicInfo: EnvBasicInfo): AIRequestContext {
        return {
            ...envBasicInfo,
            inputCmd: cmd,
        };
    }

    /**
     * 取本次输入在内存里的缓存结果并转成候选项；未命中返回 null。
     *
     * 命中条件为「同一会话 + 同一条输入命令」。
     */
    private buildCachedItems(cmd: string, envBasicInfo: EnvBasicInfo): OptionItem[] | null {
        const cacheKey = this.aiCompletion.buildCacheKey(envBasicInfo?.sessionId ?? '', cmd);
        const cached = this.aiCompletion.getCached(cacheKey);
        if (cached == null || cached.length === 0) {
            return null;
        }
        this.logger.debug('AI cached result reused', cmd);
        return cached.map(item => this.toOptionItem(item));
    }

    /**
     * 入口项。选中后一定重新请求一次（不读缓存），结果到达后整组替换。
     * 有缓存时结果已直接展示在菜单里，入口项的作用就是"再问一次"。
     */
    private buildManualEntry(cmd: string, envBasicInfo: EnvBasicInfo): OptionItem {
        return {
            name: "ask ai for help",
            content: cmd,
            desp: "",
            type: AIContentProvider.providerTypeKey,
            // 由用户主动触发，失败时要给出提示
            callback: () => this.requestByEntry(cmd, envBasicInfo),
        };
    }

    /**
     * 入口项的处理：强制重新请求，并在结果后面重新保留入口项，方便再次请求。
     */
    private async requestByEntry(cmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItem[] | null> {
        const items = await this.generateAsync(cmd, envBasicInfo, true, true, true);
        if (items == null || items.length === 0) {
            return null;
        }
        return [...items, this.buildManualEntry(cmd, envBasicInfo)];
    }

    /**
     * 生成 AI 候选条目。
     * @param allowConfirm 是否允许弹出"发送前确认"窗口。auto 档恒为 false。
     * @param notify 失败/无结果时是否通过通知中心告知用户。auto 档恒为 false，避免输入过程被打扰。
     * @param force 忽略已有缓存，强制重新请求
     */
    async generateAsync(cmd: string, envBasicInfo: EnvBasicInfo, allowConfirm: boolean, notify: boolean = false, force: boolean = false): Promise<OptionItem[] | null> {
        const ctx = this.buildRequestContext(cmd, envBasicInfo);
        let prompt = this.aiPrompt.buildPrompt(ctx);
        const sessionId = envBasicInfo?.sessionId ?? '';

        // 已有上次的结果就不再打扰用户（确认弹窗也省掉）；入口项触发时 force 为 true，直接重新请求
        if (!force) {
            const cachedBeforeConfirm = this.buildCachedItems(cmd, envBasicInfo);
            if (cachedBeforeConfirm != null) {
                return cachedBeforeConfirm;
            }
        }

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

        const result = await this.aiCompletion.requestCommands(prompt, sessionId, cmd, force);
        if (result.error != null) {
            if (result.error.kind === 'empty') {
                if (notify) {
                    this.notifications.info(this.t('ogac.ai.error.empty'));
                }
                return null;
            }
            // auto 档静默：用户没有主动发起请求，弹通知会干扰输入
            if (notify) {
                this.notifyAIError(result.error);
            } else {
                this.logger.warn('AI request failed silently', result.error);
            }
            return null;
        }
        if (result.items.length === 0) {
            if (notify) {
                this.notifications.info(this.t('ogac.ai.error.empty'));
            }
            return null;
        }
        return result.items.map(item => this.toOptionItem(item));
    }

    /**
     * 通过 tabby 通知中心提示 AI 失败原因，详情可供用户复制排查。
     */
    private notifyAIError(error: AIErrorInfo) {
        this.notifications.error(this.t(`ogac.ai.error.${error.kind}`), error.detail);
    }

    private t(key: string): string {
        return this.translate.instant(key);
    }

    /**
     * 弹出确认窗口，返回用户确认后的 prompt；取消则返回 null。
     */
    private confirmPrompt(prompt: string, sessionId: string, tab?: any): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            // 弹窗打开会让终端失焦从而触发菜单隐藏，导致结果到达时无处渲染，
            // 故弹窗期间暂停菜单的被动隐藏
            this.menuPause.pause();
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
                this.menuPause.resume();
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
