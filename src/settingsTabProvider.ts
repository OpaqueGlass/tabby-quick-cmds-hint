import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { AutoCompleteSettingsTabComponent } from './components/autoCompleteSettingsTab'

/** @hidden */
@Injectable()
export class AutoCompleteSettingsTabProvider extends SettingsTabProvider {
    id = 'autoComplete'
    // icon
    title = 'AutoComplete'

    getComponentType (): any {
        return AutoCompleteSettingsTabComponent
    }
}
