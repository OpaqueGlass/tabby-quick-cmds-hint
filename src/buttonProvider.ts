import { Injectable } from '@angular/core'
import { AppService, HostWindowService, HotkeysService, ToolbarButton, ToolbarButtonProvider } from 'tabby-core';
import { inputInitScripts, sendInput } from 'utils/commonUtils';

@Injectable()
export class ButtonProvider extends ToolbarButtonProvider {
    constructor (
        hotkeys: HotkeysService,
        private hostWnd: HostWindowService,
        private app: AppService
    ) {
        super()
        // 仅注册在 ToolbarButtonProvider 中有效？
        hotkeys.hotkey$.subscribe(async (hotkey) => {
            console.log("hotkey2", hotkey)
            if (hotkey === 'ogautocomplete_dev') {
                this.openDevTools();
            }
            if (hotkey === 'ogautocomplete_init_scripts') {
                inputInitScripts(app);
            }
        });
    }

    private openDevTools() {
        this.hostWnd.openDevTools();
    }

    provide(): ToolbarButton[] {
        return [];
    }

    
}
