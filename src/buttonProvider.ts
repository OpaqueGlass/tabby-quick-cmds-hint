import { Injectable } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AutoCompleteAIDialogComponent } from 'components/autoCompleteAIDialog';
import { AppService, HostWindowService, HotkeysService, ToolbarButton, ToolbarButtonProvider } from 'tabby-core';
import { inputInitScripts, sendInput } from 'utils/commonUtils';
import { Subject } from "rxjs";
import { MySignalService } from 'services/signalService';

@Injectable()
export class ButtonProvider extends ToolbarButtonProvider {
    private recentDialogRef: any;

    // private menuStatusNS: Subject<void> = new Subject<void>();
    // public menuStatus$ = this.menuStatusNS.asObservable();
    constructor (
        hotkeys: HotkeysService,
        private hostWnd: HostWindowService,
        private app: AppService,
        private ngbModal: NgbModal,
        signalService: MySignalService
    ) {
        super()
        // 仅注册在 ToolbarButtonProvider 中有效？
        hotkeys.hotkey$.subscribe(async (hotkey) => {
            if (hotkey === 'ogautocomplete_dev') {
                this.openDevTools();
            } else if (hotkey === 'ogautocomplete_init_scripts') {
                inputInitScripts(this.app);
            } else if (hotkey === 'ogautocomplete_ask_ai') {
                if (this.recentDialogRef) {
                    this.recentDialogRef.close();
                }
                this.recentDialogRef = this.ngbModal.open(AutoCompleteAIDialogComponent);
            } else if (hotkey === "ogautocomplete_stop") {
                signalService.changeMenuStatus();
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
