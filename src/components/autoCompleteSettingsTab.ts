import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

@Component({
    template: require('./autoCompleteSettingsTab.pug'),
})
export class AutoCompleteSettingsTabComponent {
    agents = [
        'Bonzi',
        'Clippy',
        'F1',
        'Genie',
        'Genius',
        'Links',
        'Merlin',
        'Peedy',
        'Rocky',
        'Rover',
    ]
    constructor (
        public config: ConfigService,
    ) {
    }  
}
