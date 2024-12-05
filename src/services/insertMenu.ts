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
import { MyLogger } from './myLogService';

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
        private logger: MyLogger
    ) {
        document.addEventListener("keydown", this.handleKeyDown.bind(this), true);
        document.addEventListener("keyup", this.handleKeyUp.bind(this), true);
    }

    // 插入组件的方法
    public insertComponent() {
        this.logger.log("插入提示菜单组件");
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
        // TODO: 加入快捷键或用户强制触发，这时不进行这些判定，并重置uuid
        if (this.lastCmd === text) {
            // 和上一个一致，无需处理
            this.logger.log("和上一个一致，无需处理");
            return;
        }
        if (text.length < 3) {
            this.hideMenu();
            return;
        }
        if (uuid && this.recentBlockedUuid === uuid) {
            this.logger.log("uuid被阻止");
            return;
        }
        
        this.recentUuid = uuid;
        
        this.recentCmd = text;

        // 改成异步的，另外，除了结果外还需要回传传过去的text、uuid、tab-id信息，避免插入到错误的tab提示中
        const cmdHintList = this.contentProvider.getContentList(text);
        // 获取结果
        this.componentRef.instance.setContent(cmdHintList);
        // 无结果隐藏
        if (cmdHintList == null || cmdHintList.length == 0) {
            this.hideMenu();
        } else {
            this.componentRef.instance.showAutocompleteList(this.document.querySelector('.content-tab-active.active .focused .xterm-helper-textarea'));
        }
        this.componentRef.instance.test(text);
        this.lastCmd = text;
    }

    private handleKeyUp(event: KeyboardEvent) {
        const key = event.key;
        this.logger.log("handle key up");
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
            // TODO: 我们可能还需要判定是否有其他窗口显示在其上
            if (currentIndex != -1) {
                this.componentRef.instance.inputItem(currentIndex, 1);
                actFlag = true;
            }
        } else if (key === 'Escape') {
            this.recentBlockedUuid = this.recentUuid;
            if (this.componentRef.instance.isShowing) {
                this.hideMenu();
                actFlag = true;
            }
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
  