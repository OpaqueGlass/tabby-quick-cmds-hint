import {
    ApplicationRef,
    Injector,
    EmbeddedViewRef,
    Inject,
    Injectable,
    ComponentFactoryResolver,
    ComponentRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AutoCompleteHintMenuComponent } from '../components/autoCompleteHintMenu';
import { ContentProviderService } from './contentProvider';

@Injectable({
providedIn: 'root'
})
export class AddMenuService {
    private componentRef: ComponentRef<AutoCompleteHintMenuComponent>;
    private lastCmd: string;
    private recentUuid: string;
    public recentCmd: string;
    private recentBlockedUuid: string;
    private recentBlockedKeyup: string;
    constructor(
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        @Inject(DOCUMENT) private document: Document,
        private contentProvider: ContentProviderService,
    ) {
        document.addEventListener("keydown", this.handleKeyDown.bind(this), true);
        document.addEventListener("keyup", this.handleKeyUp.bind(this), true);
    }

    // 插入组件的方法
    public insertComponent() {
        console.log("插入组件");
        // 获取目标 DOM 元素
        const target = this.document.querySelector('app-root');
        
        if (target) {
            const componentFactory = this.componentFactoryResolver.resolveComponentFactory(AutoCompleteHintMenuComponent);
            this.componentRef = componentFactory.create(this.injector);
            this.appRef.attachView(this.componentRef.hostView);
            const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
            target.appendChild(domElem);
        }
        // this.document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    }

    public showMenu() {
        this.componentRef.instance.showAutocompleteList(this.document.querySelector('.xterm-helper-textarea'));
    }

    public hideMenu() {
        this.componentRef.instance.hideAutocompleteList();
    }

    public sendCurrentText(text: string, uuid?: string) {
        if (this.lastCmd === text) {
            // 和上一个一致，无需处理
            console.log("和上一个一致，无需处理");
            return;
        }
        if (text.length < 3) {
            this.hideMenu();
            return;
        }
        if (uuid && this.recentBlockedUuid === uuid) {
            console.log("uuid被阻止");
            return;
        }
        
        this.recentUuid = uuid;
        
        this.recentCmd = text;
        // 获取结果
        this.componentRef.instance.setContent(this.contentProvider.getContentList(text));
        this.componentRef.instance.showAutocompleteList(this.document.querySelector('.content-tab-active.active .focused .xterm-helper-textarea'));
        this.componentRef.instance.test(text);
        this.lastCmd = text;
    }

    private handleKeyUp(event: KeyboardEvent) {
        const key = event.key;
        console.log("handle key up");
        if (key === this.recentBlockedKeyup) {
            this.recentBlockedKeyup = null;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            console.log("blocked key up", key)
            return;
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        const key = event.key;
        console.log("handle key down");
        let actFlag = false;
        if (key === 'ArrowUp') {
            if (this.componentRef.instance.selectUp() !== null) {
                actFlag = true;
            } else {
                console.log("up 不操作");
            }
        } else if (key === 'ArrowDown') {
            if (this.componentRef.instance.selectDown() !== null) {
                actFlag = true;
            }
        } else if (key === 'Enter') {
            const currentIndex = this.componentRef.instance.currentItemIndex;
            if (currentIndex != -1) {
                this.componentRef.instance.inputItem(currentIndex, 1);
                actFlag = true;
            }
        } else if (key === 'Escape') {
            this.recentBlockedUuid = this.recentUuid;
            this.hideMenu();
            // this.componentRef.instance.escape();
        } else if (key === 'Tab') {
            const currentIndex = this.componentRef.instance.currentItemIndex;
            if (currentIndex != -1) {
                this.componentRef.instance.inputItem(currentIndex, 0);
                actFlag = true;

            }
        } else {
            return;
        }
        if (actFlag) {
            event.stopImmediatePropagation();
            event.stopPropagation();
            event.preventDefault();
            this.recentBlockedKeyup = key;
        } else {
            console.log("No act")
        }

    }


}
  