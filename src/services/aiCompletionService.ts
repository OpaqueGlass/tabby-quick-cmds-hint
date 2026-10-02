import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import OpenAI from 'openai';
import { AICommandItem, AICompletionResult, AIErrorInfo } from '../api/aiType';
import { MyLogger } from './myLogService';
import { isValidStr } from '../utils/commonUtils';

const CACHE_MAX = 50;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_MAX_COUNT = 3;

/**
 * AI（OpenAI 兼容接口）请求服务。
 * 负责：客户端创建、超时控制、响应解析、结果缓存、会话级"发送前确认"记忆。
 *
 * 所有异常都在本服务内部消化并降级为空数组，调用方无需 try-catch，
 * 以免异步结果打断了用户正在进行的输入。
 */
@Injectable({ providedIn: 'root' })
export class AICompletionService {
    /** key = `${sessionId}|${cmd}` */
    private cache = new Map<string, AICommandItem[]>();
    private cacheKeys: string[] = [];

    /** 已选择"本次会话内不再询问"的会话 */
    private confirmedSessions = new Set<string>();

    constructor(
        private config: ConfigService,
        private logger: MyLogger,
    ) { }

    private get aiConfig(): any {
        return this.config.store?.ogAutoCompletePlugin?.ai;
    }

    private getMaxCount(): number {
        const n = Number(this.aiConfig?.inlineMaxCount);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_COUNT;
    }

    private getTimeout(): number {
        const n = Number(this.aiConfig?.timeout);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TIMEOUT;
    }

    /**
     * 是否已经配置了可用的 API Key。
     */
    isConfigured(): boolean {
        return isValidStr(this.aiConfig?.openAIKey);
    }

    private createClient(): OpenAI | null {
        const ai = this.aiConfig;
        if (!ai || !isValidStr(ai.openAIKey)) {
            return null;
        }
        try {
            return new OpenAI({
                apiKey: ai.openAIKey,
                baseURL: ai.openAIBaseUrl,
                dangerouslyAllowBrowser: true,
            });
        } catch (err) {
            this.logger.warn('Failed to create OpenAI client', err);
            return null;
        }
    }

    /**
     * 请求 AI 生成命令建议。
     * 失败一律归类为 AIErrorInfo 返回，不向调用方抛异常，
     * 以免异步结果打断用户正在进行的输入。
     */
    async requestCommands(prompt: string, sessionId: string, inputCmd: string): Promise<AICompletionResult> {
        const client = this.createClient();
        if (client == null) {
            this.logger.warn('AI not configured: openAIKey is empty, skip request');
            return { items: [], error: { kind: 'not_configured', message: 'openAIKey is empty' } };
        }

        const cacheKey = `${sessionId ?? ''}|${inputCmd ?? ''}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.logger.debug('AI result from cache', cacheKey);
            return { items: cached };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.getTimeout());
        try {
            const response = await client.chat.completions.create({
                model: this.aiConfig.openAIModel,
                messages: [{ role: 'user', content: prompt }],
            }, { signal: controller.signal });

            // @ts-ignore 部分兼容实现会把错误放在 response.error 里
            if (response?.error) {
                // @ts-ignore
                throw new Error(JSON.stringify(response.error));
            }
            const raw = response?.choices?.[0]?.message?.content ?? '';
            this.logger.debug('AI raw response', raw);
            const result = this.parseResponse(raw);
            if (result.error == null && result.items.length > 0) {
                this.putCache(cacheKey, result.items);
            }
            return result;
        } catch (err: any) {
            const error = this.classifyError(err);
            this.logger.warn('AI request failed', error);
            return { items: [], error: error };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * 解析 AI 响应：取出 ```json 代码块（或直接是 JSON），转换为命令列表。
     * - 过滤 command 为空的条目
     * - dangerRating 收敛到 0-5 的整数
     * - 条数截断到 inlineMaxCount
     */
    parseResponse(raw: string): AICompletionResult {
        if (!isValidStr(raw)) {
            return { items: [], error: { kind: 'empty', message: 'Empty response' } };
        }
        const codeBlockRegex = /```(?:json|yaml)?([\s\S]*?)```/;
        const match = raw.match(codeBlockRegex);
        const content = match ? match[1] : raw;

        let parsed: any;
        try {
            parsed = JSON.parse(content.trim());
        } catch (err) {
            this.logger.warn('Failed to parse AI response as JSON', err);
            return {
                items: [],
                error: { kind: 'parse', message: 'Response is not valid JSON', detail: raw.trim().slice(0, 300) },
            };
        }
        if (!Array.isArray(parsed)) {
            this.logger.warn('AI response is not an array');
            return {
                items: [],
                error: { kind: 'parse', message: 'Response is not a JSON array', detail: raw.trim().slice(0, 300) },
            };
        }

        const items = parsed
            .filter(item => item && isValidStr(String(item.command ?? '').trim()))
            .map(item => ({
                command: String(item.command).trim(),
                desp: String(item.desp ?? '').trim(),
                dangerRating: this.clampRating(item.dangerRating),
            }))
            .slice(0, this.getMaxCount());

        if (items.length === 0) {
            return { items: [], error: { kind: 'empty', message: 'No usable command in the response' } };
        }
        return { items: items };
    }

    /**
     * 把原始异常归类为可展示的错误信息。
     * 识别顺序：AbortError → HTTP 状态码 → 消息关键字。
     */
    private classifyError(err: any): AIErrorInfo {
        const detail = this.errorDetail(err);
        if (err?.name === 'AbortError') {
            return { kind: 'timeout', message: `Timed out after ${this.getTimeout()}ms`, detail: detail };
        }
        const status = Number(err?.status ?? err?.response?.status ?? err?.error?.status);
        if (status === 401 || status === 403) {
            return { kind: 'auth', message: 'Authentication failed', detail: detail };
        }
        if (status === 404) {
            return { kind: 'model', message: 'Model not found', detail: detail };
        }
        if (status === 429) {
            return { kind: 'rate_limit', message: 'Rate limit or quota exceeded', detail: detail };
        }
        const text = String(err?.message ?? err ?? '').toLowerCase();
        if (text.includes('timeout')) {
            return { kind: 'timeout', message: String(err?.message ?? 'Timeout'), detail: detail };
        }
        if (text.includes('fetch') || text.includes('econnrefused') || text.includes('enotfound') || text.includes('network')) {
            return { kind: 'network', message: String(err?.message ?? 'Network error'), detail: detail };
        }
        return { kind: 'unknown', message: String(err?.message ?? err ?? 'Unknown error'), detail: detail };
    }

    /**
     * 抽取排查用详情：HTTP 状态 + 服务端错误消息 + 原始 message。
     */
    private errorDetail(err: any): string {
        const parts: string[] = [];
        const status = err?.status ?? err?.response?.status ?? err?.error?.status;
        if (status != null) {
            parts.push(`HTTP ${status}`);
        }
        const serverMessage = err?.error?.message ?? err?.response?.data?.error?.message;
        if (isValidStr(String(serverMessage ?? ''))) {
            parts.push(String(serverMessage));
        }
        const raw = String(err?.message ?? err ?? '');
        if (isValidStr(raw)) {
            parts.push(raw);
        }
        return parts.join(' | ').slice(0, 300);
    }

    private clampRating(value: any): number {
        const n = Number(value);
        if (!Number.isFinite(n)) {
            return 0;
        }
        return Math.max(0, Math.min(5, Math.round(n)));
    }

    private putCache(key: string, items: AICommandItem[]) {
        this.cache.set(key, items);
        this.cacheKeys.push(key);
        while (this.cacheKeys.length > CACHE_MAX) {
            const oldest = this.cacheKeys.shift();
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }
    }

    // ---------- 发送前确认的会话级记忆 ----------

    /**
     * 该会话是否仍需弹出"发送前确认"窗口。
     * 用户勾选"本次会话内不再询问"后，同一 sessionId 不再弹窗。
     */
    needConfirm(sessionId: string): boolean {
        return !this.confirmedSessions.has(sessionId ?? '');
    }

    setSessionConfirmed(sessionId: string) {
        this.confirmedSessions.add(sessionId ?? '');
    }

    /**
     * 会话断开时清理记忆，避免 sessionId 无限增长。
     */
    forgetSession(sessionId: string) {
        this.confirmedSessions.delete(sessionId ?? '');
    }
}
