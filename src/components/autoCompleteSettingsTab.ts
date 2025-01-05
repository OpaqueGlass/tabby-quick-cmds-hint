import { Component } from '@angular/core'
import { AutoCompleteTranslateService } from 'services/translateService';
import { PlatformService, TranslateService } from "tabby-core";
import { ConfigService } from 'tabby-core'

@Component({
    template: require('./autoCompleteSettingsTab.pug'),
    styles: [require("./autoCompleteSettingsTab.scss")]
})
export class AutoCompleteSettingsTabComponent {
    agents = [
        'Bonzi',
        
    ]
    constructor (
        public config: ConfigService,
        private translate: AutoCompleteTranslateService,
        private platform: PlatformService
    ) {
        // console.log(this.translate.instant('Application'));
    }
    openGithub() {
        this.platform.openExternal('https://github.com/OpaqueGlass/tabby-quick-cmds-hint')
    }
    openNewIssue() {
        this.platform.openExternal('https://github.com/OpaqueGlass/tabby-quick-cmds-hint/issues/new')
    }
}
