import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { AIEnvContext, AITemplateRenderResult, AIRequestContext, EnvTag } from '../api/aiType';
import { MyLogger } from './myLogService';
import {
    AI_TEMPLATE_PLACEHOLDERS,
    DEFAULT_AI_PROMPT_TEMPLATE,
    PRESET_ENV_TAG_NAMES,
    RECENT_OUTPUT_SECTION,
    outputFormatInstruction,
} from '../static/aiPromptTemplate';
import { isValidStr } from '../utils/commonUtils';

/**
 * AI 提示词构建与环境标签配置的读写服务。
 *
 * 重要约束（tabby ConfigProxy 行为导致，见技术方案 4.3）：
 * envTags 是数组，tabby 会在首次读取时物化进真实 store，可直接读写，但必须"整体赋值"回写。
 */
@Injectable({ providedIn: 'root' })
export class AIPromptService {
    constructor(
        private config: ConfigService,
        private logger: MyLogger,
    ) { }

    // ---------- 配置读写 ----------

    private get pluginConfig(): any {
        return this.config.store?.ogAutoCompletePlugin;
    }

    private get aiConfig(): any {
        return this.pluginConfig?.ai;
    }

    /**
     * 当前 AI 启用档位。非法值一律兜底为 'off'。
     */
    getEnableMode(): 'off' | 'manual' | 'auto' {
        const mode = this.aiConfig?.enable;
        return mode === 'manual' || mode === 'auto' ? mode : 'off';
    }

    getEnvTags(): EnvTag[] {
        const tags = this.pluginConfig?.envTags;
        return Array.isArray(tags) ? tags : [];
    }

    /**
     * 整体写回环境标签数组。
     */
    private saveEnvTags(tags: EnvTag[]) {
        if (!this.pluginConfig) {
            return;
        }
        this.pluginConfig.envTags = tags;
        this.config.save();
    }

    /**
     * 供设置页在编辑完标签内容后触发保存。
     */
    updateEnvTags(tags: EnvTag[]) {
        this.saveEnvTags(tags);
    }

    /**
     * 新增一个自定义标签。
     * @returns 新标签的 id；名称为空或重名时返回 null
     */
    addEnvTag(name: string): string | null {
        const tagName = (name ?? '').trim();
        if (!isValidStr(tagName)) {
            return null;
        }
        const tags = this.getEnvTags();
        if (tags.some(t => t.name === tagName)) {
            return null;
        }
        const id = `custom-${tagName}-${Date.now()}`;
        tags.push({
            id: id,
            name: tagName,
            systemVersion: '',
            customPrompt: '',
            profiles: [],
        });
        this.saveEnvTags(tags);
        return id;
    }

    removeEnvTag(id: string) {
        const tags = this.getEnvTags().filter(t => t.id !== id);
        this.saveEnvTags(tags);
    }

    /**
     * 重置为预置标签列表。会丢弃用户当前的全部自定义标签与绑定关系。
     */
    resetEnvTags() {
        this.saveEnvTags(PRESET_ENV_TAG_NAMES.map(name => ({
            id: name,
            name: name,
            systemVersion: '',
            customPrompt: '',
            profiles: [],
        })));
    }

    // ---------- 环境上下文 ----------

    /**
     * 根据当前 tab 的 profile 找出命中的环境标签（按数组顺序）。
     */
    getMatchedTags(profileId: string): EnvTag[] {
        if (!isValidStr(profileId)) {
            return [];
        }
        return this.getEnvTags().filter(tag => Array.isArray(tag.profiles) && tag.profiles.includes(profileId));
    }

    /**
     * 构建模板渲染所需的占位符取值。
     * 规则：
     * - sysVersion: 命中 tag 的 systemVersion 按数组顺序拼接去重
     * - shell: 命中 tag 的 name 逗号连接
     * - customPrompt: 命中 tag 的 customPrompt 顺序拼接
     */
    buildEnvContext(ctx: AIRequestContext): AIEnvContext {
        const profileId = ctx.tab?.profile?.id ?? '';
        const matched = this.getMatchedTags(profileId);

        const tagVersions = matched
            .map(t => (t.systemVersion ?? '').trim())
            .filter(v => isValidStr(v))
            .filter((v, i, arr) => arr.indexOf(v) === i);

        const tagPrompts = matched
            .map(t => (t.customPrompt ?? '').trim())
            .filter(v => isValidStr(v));

        const includeCwd = this.aiConfig?.includeCwd !== false;

        return {
            cmd: ctx.inputCmd ?? '',
            sysVersion: tagVersions.join('\n'),
            shell: matched.map(t => t.name).join(', '),
            hostName: ctx.tab?.profile?.name ?? '',
            customPrompt: tagPrompts.join('\n'),
            cwd: includeCwd ? (ctx.cwd ?? '') : '',
        };
    }

    /**
     * 渲染提示词模板。占位符缺失（空串）时替换为空串，并记录到 missingKeys。
     * 未知占位符保持原样，不报错。
     */
    resolveTemplate(template: string, values: AIEnvContext): AITemplateRenderResult {
        const raw = isValidStr(template) ? template : DEFAULT_AI_PROMPT_TEMPLATE;
        const missingKeys: string[] = [];
        const map: Record<string, string> = {
            '${cmd}': values.cmd ?? '',
            '${sysVersion}': values.sysVersion ?? '',
            '${shell}': values.shell ?? '',
            '${hostName}': values.hostName ?? '',
            '${customPrompt}': values.customPrompt ?? '',
            '${cwd}': values.cwd ?? '',
        };
        let text = raw;
        for (const key of AI_TEMPLATE_PLACEHOLDERS) {
            const value = map[key] ?? '';
            if (!isValidStr(value) && text.includes(key)) {
                missingKeys.push(key);
            }
            text = text.split(key).join(value);
        }
        return { text, missingKeys };
    }

    /**
     * 构建最终发送给 AI 的完整 prompt。
     * 输出格式约束由本方法硬编码追加，不进入用户可编辑模板。
     *
     * @param includeRecentOutput 本次请求是否附带终端输出。不传时按配置 ai.includeLastOutput 决定，
     *                            传值则以本次选择为准（AI 弹窗支持用户逐次选择）。
     */
    buildPrompt(ctx: AIRequestContext, includeRecentOutput?: boolean): string {
        const env = this.buildEnvContext(ctx);
        const template = isValidStr(this.aiConfig?.promptTemplate)
            ? this.aiConfig.promptTemplate
            : DEFAULT_AI_PROMPT_TEMPLATE;
        const rendered = this.resolveTemplate(template, env).text;

        const maxCount = Number(this.aiConfig?.inlineMaxCount) > 0 ? Number(this.aiConfig.inlineMaxCount) : 3;
        let prompt = rendered;

        const wantsOutput = includeRecentOutput ?? (this.aiConfig?.includeLastOutput === true);
        if (wantsOutput && isValidStr(ctx.recentOutput)) {
            prompt += RECENT_OUTPUT_SECTION(ctx.recentOutput);
        }
        prompt += outputFormatInstruction(maxCount);

        this.logger.debug('AI prompt built', prompt);
        return prompt;
    }

    /**
     * 设置页预览用：渲染当前模板（含 profile 覆盖与 tag 拼接结果），不附加格式约束。
     */
    previewPrompt(ctx: AIRequestContext): AITemplateRenderResult {
        const env = this.buildEnvContext(ctx);
        const template = isValidStr(this.aiConfig?.promptTemplate)
            ? this.aiConfig.promptTemplate
            : DEFAULT_AI_PROMPT_TEMPLATE;
        return this.resolveTemplate(template, env);
    }
}
