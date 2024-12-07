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
import { MyLogger } from './myLogService';
import { BaseContentProvider, OptionItemResultWrap } from './provider/baseProvider';
import { QuickCmdContentProvider } from './provider/quickCmdContentProvider';
import { EnvBasicInfo } from 'api/pluginType';
import { ConfigService } from 'tabby-core';
import { BaseTerminalProfile, BaseTerminalTabComponent } from 'tabby-terminal';

@Injectable({
providedIn: 'root'
})
export class AddMenuService {
    private componentRef: ComponentRef<AutoCompleteHintMenuComponent>;
    private lastCmd: string;
    private recentUuid: string;
    public recentCmd: string; // 仅用于对外呈现
    private recentBlockedUuid: string;
    private recentBlockedKeyup: string;
    private currentTabId: string;
    private contentProviderList: BaseContentProvider[]; // 选项提供列表，用于异步获取
    constructor(
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        @Inject(DOCUMENT) private document: Document,
        private logger: MyLogger,
        private configService: ConfigService,
    ) {
        document.addEventListener("keydown", this.handleKeyDown.bind(this), true);
        document.addEventListener("keyup", this.handleKeyUp.bind(this), true);
        this.contentProviderList = [
            new QuickCmdContentProvider(this.logger) as BaseContentProvider,
            
        ];
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
        this.clearCurrentTabCache();
    }

    private clearCurrentTabCache() {
        this.currentTabId = null;
        this.recentUuid = null;
    }

    public isCurrentTabMatch(tabId: string, uuid: string) {
        if (this.currentTabId == null) {
            this.currentTabId = tabId;
            return true;
        }
        if (uuid && uuid === this.recentBlockedUuid && this.currentTabId === tabId) {
            return false;
        } else if (this.currentTabId === tabId) {
            return true;
        }
        return false;
    }

    private optionItemTypePostProcess(resultWrap: OptionItemResultWrap) {
        if (resultWrap.optionItem == null || resultWrap.optionItem.length == 0) {
            this.logger.log("Reject for empty");
            return;
        }
        if (resultWrap.envBasicInfo.tabId !== this.currentTabId) {
            this.logger.log("Reject for tabId unique", resultWrap.envBasicInfo.tabId, this.currentTabId);
            return;
        }
        this.componentRef.instance.setContent(resultWrap.optionItem);
    }

    public sendCurrentText(text: string, uuid: string, tabId: string, tab: BaseTerminalTabComponent<BaseTerminalProfile>) {
        // TODO: 加入快捷键或用户强制触发，这时不进行这些判定，并重置uuid
        if (this.lastCmd === text && this.currentTabId == tabId) {
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
        this.logger.log("进入处理", text)
        this.recentUuid = uuid;
        this.currentTabId = tabId;
        
        this.recentCmd = text;

        // TODO:异步：遍历所有
        // 改成异步的，另外，除了结果外还需要回传传过去的text、uuid、tab-id信息，避免插入到错误的tab提示中
        const envBasicInfo: EnvBasicInfo = {
            config: this.configService,
            document: this.document,
            tab: tab,
            tabId: tabId
        }
        this.contentProviderList.forEach((provider) => {
            provider.getQuickCmdList(text, envBasicInfo)
             .then(this.optionItemTypePostProcess.bind(this)).catch((err)=>{
                this.logger.error("获取快捷命令列表失败", err);
             });
        });
        
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
  