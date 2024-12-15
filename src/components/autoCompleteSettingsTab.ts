import { Component } from '@angular/core'
import { AutoCompleteTranslateService } from 'services/translateService'
import { TranslateService } from "tabby-core";
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
        private translate: TranslateService,
    ) {
        console.log(this.translate.instant('Application'));
        console.log(this.translate);
    }  
}
