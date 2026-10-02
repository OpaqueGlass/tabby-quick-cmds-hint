import { EnvBasicInfo } from './pluginType';

/**
 * AI 返回的单条命令建议。
 */
export interface AICommandItem {
    command: string;
    desp: string;
    dangerRating: number;
}

/**
 * AI 请求失败的分类。只用于向用户展示可读提示，不参与任何逻辑分支。
 */
export type AIErrorKind =
    | 'not_configured'  // 未填写 API Key
    | 'timeout'         // 超过配置的超时时间
    | 'auth'            // 401 / 403，Key 无效
    | 'model'           // 404，模型名不存在
    | 'rate_limit'      // 429，限流或配额不足
    | 'network'         // 连不上 baseURL
    | 'parse'           // 返回内容不是约定格式
    | 'empty'           // 请求成功，但没有可用建议
    | 'unknown';

/**
 * AI 请求失败信息。message 是面向排查的英文原文，展示文案由调用方按 kind 取 i18n。
 */
export interface AIErrorInfo {
    kind: AIErrorKind;
    message: string;
    /** 排查详情：HTTP 状态、原始错误、响应片段 */
    detail?: string;
}

/**
 * AI 请求结果。请求成功但无可用建议时 items 为空且 error.kind === 'empty'。
 */
export interface AICompletionResult {
    items: AICommandItem[];
    error?: AIErrorInfo;
}

/**
 * AI 功能的启用档位。
 * - off: 完全关闭，AI provider 不产出任何条目
 * - manual: 仅通过列表内的 "ask AI" 入口项或快捷键弹窗显式触发
 * - auto: 在 manual 基础上，输入停顿后自动内联补全
 */
export type AIEnableMode = 'off' | 'manual' | 'auto';

/**
 * 环境标签：一组共享相同 shell / 系统版本的 profile 可绑定到同一个 tag。
 * 声明顺序即提示词拼接顺序。
 */
export interface EnvTag {
    id: string;             // 唯一标识，预置 tag 使用其 name
    name: string;           // 展示名，同时作为 ${shell} 占位符取值
    systemVersion: string;  // 系统版本，单行文本，如 "Ubuntu 22.04"
    customPrompt: string;   // 该环境的自定义提示词
    profiles: string[];     // 关联的 tabby profile.id 列表
}

/**
 * 渲染提示词模板时可用的占位符取值集合。
 */
export interface AIEnvContext {
    cmd: string;
    sysVersion: string;
    shell: string;
    hostName: string;
    customPrompt: string;
    cwd: string;
}

/**
 * 模板渲染结果：渲染后的文本 + 未取到值的占位符清单（供设置页灰显提示）。
 */
export interface AITemplateRenderResult {
    text: string;
    missingKeys: string[];
}

/**
 * 供 provider 使用的环境上下文（含终端运行状态）。
 */
export interface AIRequestContext extends EnvBasicInfo {
    inputCmd: string;
    cwd?: string;
    recentOutput?: string;
}
