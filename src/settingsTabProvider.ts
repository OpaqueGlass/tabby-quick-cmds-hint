import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { AutoCompleteSettingsTabComponent } from './components/autoCompleteSettingsTab'

/** @hidden */
@Injectable()
export class AutoCompleteSettingsTabProvider extends SettingsTabProvider {
    id = 'ogautocomplete'
    // icon
    title = 'Quick Hint'

    getComponentType (): any {
        return AutoCompleteSettingsTabComponent
    }
}
