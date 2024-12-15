import { Injectable } from '@angular/core'
import { HotkeyDescription, HotkeyProvider } from 'tabby-core'

/** @hidden */
@Injectable()
export class AutoCompleteHotkeyProvider extends HotkeyProvider {
    hotkeys: HotkeyDescription[] = [
        {
            id: 'ogautocomplete_stop',
            name:'Stop AutoComplete Or Reopen it',
        },
        {
            id: "ogautocomplete_dev",
            name: "Open Dev Tools",
        },
        {
            id: "ogautocomplete_init_scripts",
            name: "Init QuickCmdHint for Current Session (Bash only)",
        },
        {
            id: "ogautocomplete_ask_ai",
            name: "AI Command Generation",
        }
    ]

    constructor (
    ) { super() }

    async provide (): Promise<HotkeyDescription[]> {
        return [
            ...this.hotkeys
        ]
    }
}