import { ConfigProvider } from 'tabby-core'

/** @hidden */
export class AutoCompleteConfigProvider extends ConfigProvider {
    defaults = {
        clippyPlugin: {
            agent: 'OGAutoComplete',
        },
        hotkeys: {
            'stop-autoComplete': [],
        },
    }
}
