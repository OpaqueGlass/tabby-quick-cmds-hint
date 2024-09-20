import {
    Injectable,
} from '@angular/core';
import { ConfigService, HostWindowService, HotkeysService } from 'tabby-core';

@Injectable({
providedIn: 'root'
})
export class CommonFunctionService {
    constructor(
        hotkeys: HotkeysService,
        private hostWnd: HostWindowService
    ) {
        hotkeys.hotkey$.subscribe((hotkey) => {
            console.log("hotkey", hotkey)
            if (hotkey === 'ogautocomplete_dev') {
                this.openDevTools();
            }
        });

    }

    private openDevTools() {
        this.hostWnd.openDevTools();
    }
    
}
