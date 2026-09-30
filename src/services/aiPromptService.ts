import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { AIEnvContext, AITemplateRenderResult, AIRequestContext, EnvTag, ProfileOverride } from '../api/aiType';
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
 * AI 提示词构建与环境标签 / 服务器覆盖配置的读写服务。
 *
 * 重要约束（tabby ConfigProxy 行为导致，见技术方案 4.3）：
 * 1. envTags 是数组，tabby 会在首次读取时物化进真实 store，可直接读写，但必须"整体赋值"回写。
 * 2. profileOverrides 默认值为空对象 {}，ConfigProxy 下读取返回的是临时深拷贝、且赋值 {} 会被 delete。
 *    因此任何读写都必须经过本服务的 getProfileOverride / setProfileOverride，
 *    禁止在调用方就地修改 store.profileOverrides。
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

    addEnvTag(name: string) {
        const tagName = (name ?? '').trim();
        if (!isValidStr(tagName)) {
            return;
        }
        const tags = this.getEnvTags();
        if (tags.some(t => t.name === tagName)) {
            return;
        }
        tags.push({
            id: `custom-${tagName}-${Date.now()}`,
            name: tagName,
            systemVersion: '',
            customPrompt: '',
            profiles: [],
        });
        this.saveEnvTags(tags);
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

    /**
     * 读取某个 profile 的覆盖配置。永远返回非 null 对象。
     */
    getProfileOverride(profileId: string): ProfileOverride {
        if (!isValidStr(profileId)) {
            return { systemVersion: '', extraNote: '' };
        }
        const all = this.pluginConfig?.profileOverrides ?? {};
        const item = all[profileId];
        return {
            systemVersion: item?.systemVersion ?? '',
            extraNote: item?.extraNote ?? '',
        };
    }

    /**
     * 写入某个 profile 的覆盖配置。
     * 必须整体赋值回写，否则会命中 ConfigProxy 的"等于默认值不落盘"分支而丢失。
     */
    setProfileOverride(profileId: string, value: Partial<ProfileOverride>) {
        if (!isValidStr(profileId) || !this.pluginConfig) {
            return;
        }
        const all = { ...(this.pluginConfig.profileOverrides ?? {}) };
        const next: ProfileOverride = {
            systemVersion: value.systemVersion ?? '',
            extraNote: value.extraNote ?? '',
        };
        if (!isValidStr(next.systemVersion) && !isValidStr(next.extraNote)) {
            // 两项都为空则移除该条目，保持配置整洁
            delete all[profileId];
        } else {
            all[profileId] = next;
        }
        this.pluginConfig.profileOverrides = all;
        this.config.save();
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
     * - sysVersion: 命中 tag 的 systemVersion 按数组顺序拼接去重；profile 覆盖非空则整体覆盖
     * - shell: 命中 tag 的 name 逗号连接
     * - customPrompt: 命中 tag 的 customPrompt 顺序拼接，再追加 profile 的 extraNote
     */
    buildEnvContext(ctx: AIRequestContext): AIEnvContext {
        const profileId = ctx.tab?.profile?.id ?? '';
        const matched = this.getMatchedTags(profileId);
        const override = this.getProfileOverride(profileId);

        const tagVersions = matched
            .map(t => (t.systemVersion ?? '').trim())
            .filter(v => isValidStr(v))
            .filter((v, i, arr) => arr.indexOf(v) === i);

        const tagPrompts = matched
            .map(t => (t.customPrompt ?? '').trim())
            .filter(v => isValidStr(v));
        if (isValidStr(override.extraNote?.trim())) {
            tagPrompts.push(override.extraNote.trim());
        }

        const includeCwd = this.aiConfig?.includeCwd !== false;

        return {
            cmd: ctx.inputCmd ?? '',
            sysVersion: isValidStr(override.systemVersion?.trim()) ? override.systemVersion.trim() : tagVersions.join('\n'),
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
     */
    buildPrompt(ctx: AIRequestContext): string {
        const env = this.buildEnvContext(ctx);
        const template = isValidStr(this.aiConfig?.promptTemplate)
            ? this.aiConfig.promptTemplate
            : DEFAULT_AI_PROMPT_TEMPLATE;
        const rendered = this.resolveTemplate(template, env).text;

        const maxCount = Number(this.aiConfig?.inlineMaxCount) > 0 ? Number(this.aiConfig.inlineMaxCount) : 3;
        let prompt = rendered;

        // 终端输出仅在 manual 档且用户开启时才可能非空（auto 档不采集）
        if (this.aiConfig?.includeLastOutput === true && isValidStr(ctx.recentOutput)) {
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
