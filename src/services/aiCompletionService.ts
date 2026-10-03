import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import OpenAI from 'openai';
import { jsonrepair } from 'jsonrepair';
import { AICommandItem, AICompletionResult, AIConnectionTestResult, AIErrorInfo } from '../api/aiType';
import { MyLogger } from './myLogService';
import { isValidStr } from '../utils/commonUtils';

const CACHE_MAX = 50;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_MAX_COUNT = 3;

/**
 * AI（OpenAI 兼容接口）请求服务。
 * 负责：客户端创建、超时控制、响应解析、结果缓存（仅内存、不落盘）、会话级"发送前确认"记忆。
 *
 * 所有异常都在本服务内部消化并降级为空数组，调用方无需 try-catch，
 * 以免异步结果打断了用户正在进行的输入。
 */
@Injectable({ providedIn: 'root' })
export class AICompletionService {
    /**
     * 结果缓存。仅存在于内存：
     * - key 为「会话 + 输入命令」，同一会话内重复输入同一条命令直接复用上次结果；
     * - 上限 CACHE_MAX 条，超出按写入顺序（近似 LRU）淘汰。
     */
    private cache = new Map<string, AICommandItem[]>();
    /** 缓存写入顺序，用于淘汰最旧的一条 */
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
     * 生成缓存 key：会话 id + 输入命令。
     */
    buildCacheKey(sessionId: string, inputCmd: string): string {
        return `${sessionId ?? ''}|${(inputCmd ?? '').trim()}`;
    }

    /**
     * 读取内存中的缓存结果（只读使用）。
     * 未命中或内容为空时返回 null；命中会刷新该条目的淘汰顺序。
     *
     */
    getCached(cacheKey: string): AICommandItem[] | null {
        if (!isValidStr(cacheKey)) {
            return null;
        }
        const cached = this.cache.get(cacheKey);
        if (!cached || cached.length === 0) {
            return null;
        }
        this.touchCacheKey(cacheKey);
        this.logger.debug('AI cache hit', cacheKey);
        return cached;
    }

    /**
     * 请求 AI 生成命令建议
     *
     * @param force 忽略已有缓存，强制重新请求；新结果会覆盖同一 key 的旧缓存
     */
    async requestCommands(prompt: string, sessionId: string, inputCmd: string, force: boolean = false): Promise<AICompletionResult> {
        const client = this.createClient();
        if (client == null) {
            this.logger.warn('AI not configured: openAIKey is empty, skip request');
            return { items: [], error: { kind: 'not_configured', message: 'openAIKey is empty' } };
        }

        const key = this.buildCacheKey(sessionId, inputCmd);
        if (!force) {
            const cached = this.getCached(key);
            if (cached) {
                return { items: cached };
            }
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
                this.putCache(key, result.items);
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
     * 测试当前 AI 配置是否可用：发一个最小请求验证 Key / baseURL / model。
     * 不写入缓存，不修改任何配置。
     */
    async testConnection(): Promise<AIConnectionTestResult> {
        const client = this.createClient();
        if (client == null) {
            return { ok: false, kind: 'not_configured', message: 'openAIKey is empty', latencyMs: 0 };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.getTimeout());
        const startedAt = Date.now();
        try {
            const response = await client.chat.completions.create({
                model: this.aiConfig.openAIModel,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
            }, { signal: controller.signal });

            // @ts-ignore 部分兼容实现会把错误放在 response.error 里
            if (response?.error) {
                // @ts-ignore
                throw new Error(JSON.stringify(response.error));
            }
            return {
                ok: true,
                kind: 'ok',
                message: String(response?.model ?? ''),
                latencyMs: Date.now() - startedAt,
            };
        } catch (err: any) {
            const error = this.classifyError(err);
            this.logger.warn('AI connection test failed', error);
            return {
                ok: false,
                kind: error.kind,
                message: error.message,
                detail: error.detail,
                latencyMs: Date.now() - startedAt,
            };
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
            parsed = this.parseJson(content);
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
     * 把 AI 返回的内容解析为 JSON。
     *
     * 先用标准 JSON.parse；失败时交给 jsonrepair 修复后再解析
     *
     * @throws 修复仍然失败时抛出异常，由调用方归类为 parse 错误
     */
    private parseJson(content: string): any {
        const text = (content ?? '').trim();
        try {
            return JSON.parse(text);
        } catch (err) {
            this.logger.debug('JSON.parse failed, fallback to jsonrepair', err);
        }
        try {
            const repaired = jsonrepair(text);
            this.logger.debug('AI response repaired by jsonrepair');
            return JSON.parse(repaired);
        } catch (err) {
            this.logger.debug('jsonrepair failed on full content, retry on the inner JSON part', err);
        }
        // 前后夹杂说明文字时，截取最外层 JSON 片段再修复
        const inner = this.extractJsonPart(text);
        return JSON.parse(jsonrepair(inner));
    }

    /**
     * 截取最外层的 JSON 片段：首个 [ 或 { 到最后一个 ] 或 }。
     * 无法识别时原样返回，交由 jsonrepair 处理并报错。
     */
    private extractJsonPart(text: string): string {
        const starts = [text.indexOf('['), text.indexOf('{')].filter(index => index >= 0);
        if (starts.length === 0) {
            return text;
        }
        const start = Math.min(...starts);
        const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
        return end > start ? text.slice(start, end + 1) : text.slice(start);
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
        this.removeCacheKey(key);
        this.cache.set(key, items);
        this.cacheKeys.push(key);
        while (this.cacheKeys.length > CACHE_MAX) {
            const oldest = this.cacheKeys.shift();
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }
    }

    /**
     * 刷新 key 的淘汰顺序：已存在的条目移到队尾，避免刚被用到的结果先被淘汰。
     */
    private touchCacheKey(key: string) {
        this.removeCacheKey(key);
        this.cacheKeys.push(key);
    }

    private removeCacheKey(key: string) {
        const index = this.cacheKeys.indexOf(key);
        if (index >= 0) {
            this.cacheKeys.splice(index, 1);
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
     * 同时丢弃该会话的结果缓存，避免跨会话复用。
     */
    forgetSession(sessionId: string) {
        this.confirmedSessions.delete(sessionId ?? '');
        const prefix = `${sessionId ?? ''}|`;
        this.cacheKeys.filter(key => key.startsWith(prefix)).forEach(key => {
            this.cache.delete(key);
            this.removeCacheKey(key);
        });
    }
}
