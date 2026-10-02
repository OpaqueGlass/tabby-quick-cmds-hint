import { Component } from '@angular/core'
import { AutoCompleteTranslateService } from 'services/translateService';
import { PlatformService, TranslateService } from "tabby-core";
import { ConfigService } from 'tabby-core'
import { AIPromptService } from 'services/aiPromptService';
import { AIRequestContext, EnvTag } from 'api/aiType';
import { DEFAULT_AI_PROMPT_TEMPLATE, AI_TEMPLATE_PLACEHOLDERS } from 'static/aiPromptTemplate';
import { isValidStr } from '../utils/commonUtils';

@Component({
    template: require('./autoCompleteSettingsTab.pug'),
    styles: [require("./autoCompleteSettingsTab.scss")]
})
export class AutoCompleteSettingsTabComponent {
    /** 新增标签时的名称输入 */
    newTagName: string = "";
    /** 每个标签的 profile 搜索关键字 */
    profileSearchText: { [tagId: string]: string } = {};
    /** 提示词预览使用的示例命令 */
    previewCmd: string = "ls -la";
    /** 提示词预览使用的 profile */
    previewProfileId: string = "";
    /** 环境标签区块是否展开 */
    showEnvTags: boolean = false;
    /** 单个环境标签的详情是否展开，key = tag.id */
    expandedTags: { [tagId: string]: boolean } = {};

    constructor (
        public config: ConfigService,
        private translate: AutoCompleteTranslateService,
        private platform: PlatformService,
        private aiPrompt: AIPromptService,
        private translateService: TranslateService,
    ) {
        // console.log(this.translate.instant('Application'));
    }

    t(key: string): string {
        return this.translateService.instant(key);
    }
    openGithub() {
        this.platform.openExternal('https://github.com/OpaqueGlass/tabby-quick-cmds-hint')
    }
    openNewIssue() {
        this.platform.openExternal('https://github.com/OpaqueGlass/tabby-quick-cmds-hint/issues/new/choose')
    }
    isQuickCmdsInstalled() {
        return this.config.store["qc"] && Object.keys(this.config.store["qc"]).length > 0
    }

    // ---------- AI 触发模式 ----------

    get aiConfig(): any {
        return this.config.store?.ogAutoCompletePlugin?.ai;
    }

    isAutoMode(): boolean {
        return this.aiPrompt.getEnableMode() === 'auto';
    }

    // ---------- 环境标签 ----------

    getEnvTags(): EnvTag[] {
        return this.aiPrompt.getEnvTags();
    }

    /**
     * 标签内容被编辑后保存。
     */
    onEnvTagChanged() {
        this.aiPrompt.updateEnvTags(this.getEnvTags());
    }

    /**
     * 整块环境标签的展开/收起，与「服务器自定义」保持一致的交互。
     */
    toggleEnvTags() {
        this.showEnvTags = !this.showEnvTags;
    }

    isTagExpanded(tagId: string): boolean {
        return this.expandedTags[tagId] === true;
    }

    toggleTag(tagId: string) {
        this.expandedTags[tagId] = !this.isTagExpanded(tagId);
    }

    /**
     * 收起态的一行摘要：系统版本 / 自定义提示词 / 已绑定服务器数。
     * 未配置任何内容的标签显示「未配置」。
     */
    getTagSummary(tag: EnvTag): string {
        const parts: string[] = [];
        const version = (tag?.systemVersion ?? '').trim();
        if (isValidStr(version)) {
            parts.push(version);
        }
        if (isValidStr((tag?.customPrompt ?? '').trim())) {
            parts.push(this.t('ogac.envTags.summary_prompt'));
        }
        const count = Array.isArray(tag?.profiles) ? tag.profiles.length : 0;
        if (count > 0) {
            parts.push(`${count} ${this.t('ogac.envTags.summary_profiles')}`);
        }
        return parts.length > 0 ? parts.join(' · ') : this.t('ogac.envTags.not_configured');
    }

    addEnvTag() {
        // 新增的标签直接展开，避免用户还要再点一次才能填内容
        const newId = this.aiPrompt.addEnvTag(this.newTagName);
        this.newTagName = "";
        if (newId != null) {
            this.expandedTags[newId] = true;
        }
    }

    removeEnvTag(tagId: string) {
        delete this.expandedTags[tagId];
        this.aiPrompt.removeEnvTag(tagId);
    }

    resetEnvTags() {
        this.aiPrompt.resetEnvTags();
    }

    // ---------- profile 关联 ----------

    getProfiles(): any[] {
        const profiles = (this.config.store as any)?.profiles;
        return Array.isArray(profiles) ? profiles : [];
    }

    getProfileName(profileId: string): string {
        const profile = this.getProfiles().find(p => p?.id === profileId);
        return profile?.name ?? '';
    }

    getFilteredProfiles(tag: EnvTag): any[] {
        const keyword = (this.profileSearchText[tag.id] ?? '').trim().toLowerCase();
        const profiles = this.getProfiles();
        if (keyword === '') {
            return profiles;
        }
        return profiles.filter(p => (p?.name ?? '').toLowerCase().includes(keyword));
    }

    isProfileInTag(tag: EnvTag, profileId: string): boolean {
        return Array.isArray(tag?.profiles) && tag.profiles.includes(profileId);
    }

    toggleProfileInTag(tag: EnvTag, profileId: string, event: any) {
        if (!tag) {
            return;
        }
        if (!Array.isArray(tag.profiles)) {
            tag.profiles = [];
        }
        const checked = event?.target?.checked === true;
        const index = tag.profiles.indexOf(profileId);
        if (checked && index === -1) {
            tag.profiles.push(profileId);
        } else if (!checked && index !== -1) {
            tag.profiles.splice(index, 1);
        }
        this.onEnvTagChanged();
    }

    // ---------- 提示词模板 ----------

    getPlaceholders(): string[] {
        return AI_TEMPLATE_PLACEHOLDERS;
    }

    resetPromptTemplate() {
        if (!this.aiConfig) {
            return;
        }
        this.aiConfig.promptTemplate = DEFAULT_AI_PROMPT_TEMPLATE;
        this.config.save();
    }

    /**
     * 渲染后的提示词预览（不含输出格式约束段）。
     */
    getRenderedPromptPreview(): string {
        const profile = this.getProfiles().find(p => p?.id === this.previewProfileId);
        const ctx: AIRequestContext = {
            config: this.config,
            document: window.document,
            // @ts-ignore 预览场景只用到 profile.id / profile.name
            tab: { profile: { id: this.previewProfileId ?? '', name: profile?.name ?? '' } },
            sessionId: '',
            inputCmd: this.previewCmd ?? '',
        };
        return this.aiPrompt.previewPrompt(ctx).text;
    }

    /**
     * 当前预览中未取到值的占位符，用于灰字提示。
     */
    getMissingPlaceholderKeys(): string[] {
        const profile = this.getProfiles().find(p => p?.id === this.previewProfileId);
        const ctx: AIRequestContext = {
            config: this.config,
            document: window.document,
            // @ts-ignore
            tab: { profile: { id: this.previewProfileId ?? '', name: profile?.name ?? '' } },
            sessionId: '',
            inputCmd: this.previewCmd ?? '',
        };
        return this.aiPrompt.previewPrompt(ctx).missingKeys;
    }

}
