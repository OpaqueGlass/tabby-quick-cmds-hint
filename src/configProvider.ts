import { ConfigProvider } from 'tabby-core'
import { EnvTag } from './api/aiType'
import { DEFAULT_AI_PROMPT_TEMPLATE, PRESET_ENV_TAG_NAMES } from './static/aiPromptTemplate'

/**
 * 预置环境标签。
 * 注意：tabby 的 ConfigProxy 对数组类型会在首次读取时物化进真实 store，
 * 因此这里给数组默认值是安全且有效的（增删改均可正常 save）。
 */
const presetEnvTags = (): EnvTag[] => PRESET_ENV_TAG_NAMES.map(name => ({
    id: name,
    name: name,
    systemVersion: '',
    customPrompt: '',
    profiles: [],
}));

/** @hidden */
export class AutoCompleteConfigProvider extends ConfigProvider {
    defaults = {
        ogAutoCompletePlugin: {
            agent: 'OGAutoComplete',
            debugLevel: 3,
            autoInit: false,
            enableCompleteWithCompleteStart: true,
            menuShowItemMaxCount: 7,
            ai: {
                openAIBaseUrl: "https://api.openai.com/v1",
                openAIKey: "",
                openAIModel: "gpt-4o-mini",
                // off | manual | auto，默认关闭
                enable: 'off',
                inlineMinLength: 3,
                inlineDebounce: 800,
                inlineMaxCount: 3,
                timeout: 15000,
                includeCwd: true,
                includeLastOutput: false,
                // 采集终端输出的上限：只取末尾 N 行，且总字符数不超过 M
                recentOutputMaxLines: 40,
                recentOutputMaxChars: 2000,
                promptTemplate: DEFAULT_AI_PROMPT_TEMPLATE,
            },
            // 环境标签。数组顺序即提示词拼接顺序
            envTags: presetEnvTags(),
            appearance: {
                "fontSize": 15,
            },
            useRegExpDetectPrompt: true,
            customRegExp: "",
            history: {
                "enable": false,
                "countInRegExp": true,
            },
            arguments: {
                "enable": false,
            }
        },
        hotkeys: {
            'ogautocomplete_stop': [],
            'ogautocomplete_dev': [],
            "ogautocomplete_init_scripts": [],
            "ogautocomplete_ask_ai": [],
            "ogautocomplete_hint_now": [],
        },
    }
}
