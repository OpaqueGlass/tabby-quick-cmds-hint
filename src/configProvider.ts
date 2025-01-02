import { AutoCompleteTranslateService } from 'services/translateService'
import { ConfigProvider } from 'tabby-core'
import { TranslateService } from "tabby-core";

/** @hidden */
export class AutoCompleteConfigProvider extends ConfigProvider {
    defaults = {
        ogAutoCompletePlugin: {
            agent: 'OGAutoComplete',
            debugLevel: 3,
            autoInit: false,
            ai: {
                openAIBaseUrl: "https://api.openai.com/v1",
                openAIKey: "",
                openAIModel: "gpt-4o-mini",
            },
            appearance: {
                "fontSize": 15,
            }
        },
        hotkeys: {
            'ogautocomplete_stop': [],
            'ogautocomplete_dev': [],
            "ogautocomplete_init_scripts": [],
            "ogautocomplete_ask_ai": [],
        },
    }
}
