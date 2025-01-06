import {
    ApplicationRef,
    Injector,
    EmbeddedViewRef,
    Inject,
    Injectable,
    ComponentFactoryResolver,
    ComponentRef,
    forwardRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AutoCompleteHintMenuComponent } from '../components/autoCompleteHintMenu';
import { MyLogger } from './myLogService';
import { BaseContentProvider, OptionItemResultWrap } from './provider/baseProvider';
import { QuickCmdContentProvider } from './provider/quickCmdContentProvider';
import { EnvBasicInfo, TerminalSessionInfo } from 'api/pluginType';
import { ConfigService } from 'tabby-core';
import { BaseTerminalProfile, BaseTerminalTabComponent } from 'tabby-terminal';
import { HistoryContentProvider } from './provider/historyProvider';
import { Subject } from 'rxjs';
import { MySignalService } from './signalService';
import { AutoCompleteTranslateService } from './translateService';
import { StyleService } from './styleService';

@Injectable({
    providedIn: 'root'
})
export class AddMenuService {
    private componentRef: ComponentRef<AutoCompleteHintMenuComponent>;
    private lastCmd: string;
    private recentUuid: string;
    private currentCmd: string; // 仅用于对外呈现
    private recentBlockedUuid: string;
    private recentBlockedKeyup: string;
    private currentSessionId: string;
    private contentProviderList: BaseContentProvider[]; // 选项提供列表，用于异步获取
    // 回车输入状态
    private enterNotificationSubject: Subject<void> = new Subject<void>();
    public enterNotification$ = this.enterNotificationSubject.asObservable();
    // 补全菜单工作状态
    private menuStatus: boolean = true;
    private menuStatusNotificationSubject: Subject<boolean> = new Subject<boolean>();
    public menuStatus$ = this.menuStatusNotificationSubject.asObservable();
    // 上下菜单状态
    private recentHistoryJumpStatus: boolean = false;
    constructor(
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        @Inject(DOCUMENT) private document: Document,
        private logger: MyLogger,
        private configService: ConfigService,
        quickCmdContentProvider: QuickCmdContentProvider,
        historyContentProvider: HistoryContentProvider,
        private myTranslate: AutoCompleteTranslateService, // 这个东西，放在Provider、index都会导致其他中文内容丢失
        // openAIContentProvider: OpenAIContentProvider,
        // private buttonProvider: ButtonProvider, // 直接引用会卡在Cannot access 'AddMenuService' before initialization
        private signalService: MySignalService,
        private cssService: StyleService
    ) {
        this.menuStatus = configService.store.ogAutoCompletePlugin.enableCompleteWithCompleteStart;
        document.addEventListener("keydown", this.handleKeyDown.bind(this), true);
        document.addEventListener("keyup", this.handleKeyUp.bind(this), true);
        this.contentProviderList = [
            quickCmdContentProvider,
            historyContentProvider,
        ];
        logger.log("Add menu service init");
        if (this.menuStatus) {
            this.enable();
        } else {
            this.disable();
        }
        signalService.menuStatus$.subscribe(()=>{
            if (this.getStatus()) {
                this.disable();
            } else {
                this.enable();
            }
        })
        // buttonProvider.menuStatus$.subscribe(()=>{
        //     if (this.getStatus()) {
        //         this.disable();
        //     } else {
        //         this.enable();
        //     }
        // });
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
        // fix componentRef is undefined in constructor
        this.componentRef?.instance?.hideAutocompleteList();
        this.clearCurrentTabCache();
    }

    private clearCurrentTabCache() {
        this.currentSessionId = null;
        this.recentUuid = null;
        this.currentCmd = "";
    }

    public isCurrentTabMatch(sessionId: string, uuid: string) {
        if (this.currentSessionId == null) {
            this.currentSessionId = sessionId;
            return true;
        }
        if (uuid && uuid === this.recentBlockedUuid && this.currentSessionId === sessionId) {
            return false;
        } else if (this.currentSessionId === sessionId) {
            return true;
        }
        return false;
    }

    private optionItemTypePostProcess(resultWrap: OptionItemResultWrap) {
        if (resultWrap == null) {
            this.logger.debug("Reject for no response");
            return;
        }
        if (resultWrap.optionItem == null) {
            this.logger.debug("Reject for empty");
            return;
        }
        if (resultWrap.envBasicInfo == null) {
            this.logger.debug("Reject for envBasicInfo");
            return;
        }
        if (resultWrap.envBasicInfo.sessionId !== this.currentSessionId) {
            this.logger.debug("Reject for sessionId unique", resultWrap.envBasicInfo.sessionId, this.currentSessionId);
            return;
        }
        this.logger.debug("Provider 返回option", resultWrap.optionItem);
        this.componentRef.instance.setContent(resultWrap.optionItem, resultWrap.type);
    }

    public broadcastNewCmd(cmd: string, sessionId: string, tab: BaseTerminalTabComponent<BaseTerminalProfile>) {
        const terminalSessionInfo: TerminalSessionInfo = {
            config: this.configService,
            tab: tab,
            sessionId: sessionId
        }
        this.contentProviderList.forEach((provider) => {
            provider.userInputCmd(cmd, terminalSessionInfo).catch((err) => {
                this.logger.error("插入新命令失败", err);
            });
        });
    }

    public disable() {
        this.menuStatus = false;
        this.hideMenu();
        this.menuStatusNotificationSubject.next(this.menuStatus);
        this.document.querySelector(".og-tac-tool-btn").setAttribute("stroke", "purple");
    }

    public enable() {
        this.menuStatus = true;
        this.currentSessionId = "";
        this.lastCmd = "";
        this.recentBlockedUuid = "";
        this.menuStatusNotificationSubject.next(this.menuStatus);
        this.document.querySelector(".og-tac-tool-btn").setAttribute("stroke", "green");
    }

    /**
     * 是否启用的控制，和menu是否正显示无关
     * @returns 
     */
    public getStatus() {
        return this.menuStatus;
    }

    public sendCurrentText(text: string, uuid: string, sessionId: string, tab: BaseTerminalTabComponent<BaseTerminalProfile>) {
        this.currentCmd = text;
        if (!this.menuStatus) {
            this.logger.debug("Ignore sended cmd for menuStatus == false")
            return;
        }
        if (this.recentHistoryJumpStatus) {
            this.logger.debug("Ignored due to recent history input");
            return;
        }
        if (this.lastCmd === text && this.currentSessionId == sessionId) {
            // 和上一个一致，无需处理
            this.logger.debug("和上一个一致，无需处理");
            return;
        }
        if (text.length < 2) {
            this.hideMenu();
            return;
        }
        if (uuid && this.recentBlockedUuid === uuid) {
            this.logger.debug("uuid被阻止");
            return;
        }
        this.logger.debug("进入处理", text)
        this.recentUuid = uuid;
        this.currentSessionId = sessionId;
        

        // TODO:异步：遍历所有
        // 改成异步的，另外，除了结果外还需要回传传过去的text、uuid、tab-id信息，避免插入到错误的tab提示中
        const envBasicInfo: EnvBasicInfo = {
            config: this.configService,
            document: this.document,
            tab: tab,
            sessionId: sessionId
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

    public getCurrentCmd() {
        return this.currentCmd;
    }

    private handleKeyUp(event: KeyboardEvent) {
        const key = event.key;
        if (key === this.recentBlockedKeyup) {
            this.recentBlockedKeyup = null;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.logger.debug("blocked key up", key)
            return;
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        const key = event.key;
        let actFlag = false;
        // this.logger.messyDebug("handle key down", event.key)
        if (key === 'ArrowUp' && !this.hasFloatWnd()) {
            if (this.componentRef.instance.selectUp() !== null) {
                actFlag = true;
            } else {
                this.logger.debug("up 不操作");
                this.recentHistoryJumpStatus = true;
                this.hideMenu();
            }
        } else if (key === 'ArrowDown' && !this.hasFloatWnd()) {
            if (this.componentRef.instance.selectDown() !== null) {
                actFlag = true;
            } else {
                this.recentHistoryJumpStatus = true;
                this.hideMenu();
            }
        } else if (key === 'Enter' && !this.hasFloatWnd()) {
            const currentIndex = this.componentRef.instance.currentItemIndex;
            this.enterNotificationSubject.next();
            if (currentIndex != -1 && this.componentRef.instance.showingFlag) {
                this.componentRef.instance.inputItem(currentIndex, 1);
                actFlag = true;
                this.logger.debug("handle enter: input")
            } else {
                this.hideMenu();
                this.logger.debug("handle enter: hide")
            }
        } else if (key === 'Escape') {
            this.recentBlockedUuid = this.recentUuid;
            if (this.componentRef.instance.showingFlag) {
                this.hideMenu();
                actFlag = true;
            }
        } else if (key === 'Tab' && !this.hasFloatWnd()) {
            const currentIndex = this.componentRef.instance.currentItemIndex;
            if (currentIndex != -1) {
                this.componentRef.instance.inputItem(currentIndex, 0);
                actFlag = true;

            }
        } else if (key === 'Backspace' && !this.hasFloatWnd()) {
            this.componentRef.instance.clearSelection();
        } else {
            this.recentHistoryJumpStatus = false;
            return;
        }
        if (actFlag) {
            event.stopImmediatePropagation();
            event.stopPropagation();
            event.preventDefault();
            this.recentBlockedKeyup = key;
        } else {
            this.logger.debug("No act")
        }

    }
    hasFloatWnd(): boolean {
        const floatLayers = this.document.querySelectorAll("ngb-modal-window[role]")
        if (floatLayers == null || floatLayers.length == 0) {
            return false;
        }
        return true;
    }


}
  