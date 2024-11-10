import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

@Component({
    template: require('./autoCompleteSettingsTab.pug'),
})
export class AutoCompleteSettingsTabComponent {
    agents = [
        'Bonzi',
        
    ]
    constructor (
        public config: ConfigService,
    ) {
    }  
}
