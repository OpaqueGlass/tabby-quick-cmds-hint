/*  
*  tabby-quick-cmds-hint: A simple complete hint plugin for tabby.
*  Copyright (C) 2025 OpaqueGlass and other developers
*
*  This program is free software: you can redistribute it and/or modify
*  it under the terms of the GNU Affero General Public License as published
*  by the Free Software Foundation, either version 3 of the License, or
*  (at your option) any later version.
*
*  This program is distributed in the hope that it will be useful,
*  but WITHOUT ANY WARRANTY; without even the implied warranty of
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*  GNU Affero General Public License for more details.
*
*  You should have received a copy of the GNU Affero General Public License
*  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { AppService, ConfigProvider, HotkeyProvider, ToolbarButtonProvider } from 'tabby-core'
import TabbyCoreModule from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { AutoCompleteConfigProvider } from './configProvider'
import { AutoCompleteSettingsTabProvider } from './settingsTabProvider'
import { AutoCompleteSettingsTabComponent } from 'components/autoCompleteSettingsTab'
import { TerminalDecorator } from 'tabby-terminal'
import { AutoCompleteTerminalDecorator } from 'terminalDecorator'
import { AutoCompleteHintMenuComponent } from 'components/autoCompleteHintMenu'
import { AddMenuService } from 'services/menuService'
import { AutoCompleteHotkeyProvider } from 'hotkeyProvider'
import { ButtonProvider } from 'buttonProvider'
import { AutoCompleteAIDialogComponent } from 'components/autoCompleteAIDialog'
import { AutoCompleteTranslateService } from 'services/translateService'




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
        { provide: HotkeyProvider, useClass: AutoCompleteHotkeyProvider, multi: true },
        { provide: ToolbarButtonProvider, useClass: ButtonProvider, multi: true },
        AddMenuService,
        AutoCompleteTranslateService,
    ],
    declarations: [
        AutoCompleteSettingsTabComponent,
        AutoCompleteHintMenuComponent,
        AutoCompleteAIDialogComponent,
    ],
})
export default class AutoCompleteModule {
    constructor(
        app: AppService, translate: AutoCompleteTranslateService
    ) {
        app.ready$.subscribe(() => {
            translate.initMyTranslate();
        })
    }
}
