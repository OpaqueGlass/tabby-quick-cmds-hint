import { Injectable } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AutoCompleteAIDialogComponent } from 'components/autoCompleteAIDialog';
import { AppService, HostWindowService, HotkeysService, ToolbarButton, ToolbarButtonProvider } from 'tabby-core';
import { inputInitScripts, sendInput } from 'utils/commonUtils';

@Injectable()
export class ButtonProvider extends ToolbarButtonProvider {
    private recentDialogRef: any;
    constructor (
        hotkeys: HotkeysService,
        private hostWnd: HostWindowService,
        private app: AppService,
        private ngbModal: NgbModal,
    ) {
        super()
        // 仅注册在 ToolbarButtonProvider 中有效？
        hotkeys.hotkey$.subscribe(async (hotkey) => {
            if (hotkey === 'ogautocomplete_dev') {
                this.openDevTools();
            }
            if (hotkey === 'ogautocomplete_init_scripts') {
                inputInitScripts(app);
            }
            if (hotkey === 'ogautocomplete_ask_ai') {
                if (this.recentDialogRef) {
                    this.recentDialogRef.close();
                }
                this.recentDialogRef = this.ngbModal.open(AutoCompleteAIDialogComponent);
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
