import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { ConfigProvider } from 'tabby-core'
import TabbyCoreModule from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { AutoCompleteConfigProvider } from './configProvider'
import { AutoCompleteSettingsTabProvider } from './settingsTabProvider'
import { AutoCompleteSettingsTabComponent } from 'components/autoCompleteSettingsTab'
import { TerminalDecorator } from 'tabby-terminal'
import { AutoCompleteTerminalDecorator } from 'terminalDecorator'




@NgModule({
    imports: [
        NgbModule,
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: AutoCompleteConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: AutoCompleteSettingsTabProvider, multi: true },
        { provide: TerminalDecorator, useClass: AutoCompleteTerminalDecorator, multi: true },
    ],
    declarations: [
        AutoCompleteSettingsTabComponent
    ],
})
export default class AutoCompleteModule { }
