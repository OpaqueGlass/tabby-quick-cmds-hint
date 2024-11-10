import { ConfigProvider } from 'tabby-core'

/** @hidden */
export class AutoCompleteConfigProvider extends ConfigProvider {
    defaults = {
        ogAutoCompletePlugin: {
            agent: 'OGAutoComplete',
            debugLevel: 3,
        },
        hotkeys: {
            'ogautocomplete_stop': [],
            'ogautocomplete_dev': [],
        },
    }
}
