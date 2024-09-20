import { Injectable } from '@angular/core'
import { HostWindowService, HotkeysService, ToolbarButton, ToolbarButtonProvider } from 'tabby-core';

@Injectable()
export class ButtonProvider extends ToolbarButtonProvider {
    constructor (
        hotkeys: HotkeysService,
        private hostWnd: HostWindowService

    ) {
        super()
        // 仅注册在 ToolbarButtonProvider 中有效？
        hotkeys.hotkey$.subscribe(async (hotkey) => {
            console.log("hotkey2", hotkey)
            if (hotkey === 'ogautocomplete_dev') {
                this.openDevTools();
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
