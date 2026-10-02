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
import { ArgumentsContentProvider } from './provider/argumentsContentProvider';
import { AIContentProvider } from './provider/aiContentProvider';
import { MenuHidePauseService } from './menuPauseService';

@Injectable({
    providedIn: 'root'
})
export class AddMenuService {
    private componentRef: ComponentRef<AutoCompleteHintMenuComponent>;
    private lastCmd: string;
    private lastCursorIndexAt: number;
    private recentUuid: string;
    private currentCmd: string; // 仅用于对外呈现
    private recentBlockedUuid: string;
    private recentBlockedKeyup: string;
    private currentSessionId: string;
    private contentProviderList: BaseContentProvider[]; // 选项提供列表，用于异步获取
    // 回车输入状态
    private enterNotificationSubject: Subject<void> = new Subject<void>();
    public enterNotification$ = this.enterNotificationSubject.asObservable();
    // 用户按 Escape 取消提示：终端据此在"当前这一行"内不再弹出提示
    private escapeNotificationSubject: Subject<void> = new Subject<void>();
    public escapeNotification$ = this.escapeNotificationSubject.asObservable();
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
        argumentsContentProvider: ArgumentsContentProvider,
        aiContentProvider: AIContentProvider,
        private myTranslate: AutoCompleteTranslateService, // 这个东西，放在Provider、index都会导致其他中文内容丢失
        // openAIContentProvider: OpenAIContentProvider,
        // private buttonProvider: ButtonProvider, // 直接引用会卡在Cannot access 'AddMenuService' before initialization
        private signalService: MySignalService,
        private cssService: StyleService,
        private menuHidePause: MenuHidePauseService,
    ) {
        this.menuStatus = configService.store.ogAutoCompletePlugin.enableCompleteWithCompleteStart;
        document.addEventListener("keydown", this.handleKeyDown.bind(this), true);
        document.addEventListener("keyup", this.handleKeyUp.bind(this), true);
        this.contentProviderList = [
            quickCmdContentProvider,
            historyContentProvider,
            argumentsContentProvider,
            aiContentProvider,
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

    /**
     * 隐藏菜单。
     * @param force 为 true 时忽略其他组件请求暂停弹窗隐藏（用户主动取消 / 关闭插件 时，必须隐藏菜单）
     */
    public hideMenu(force: boolean = false) {
        if (!force && this.menuHidePause.isPaused()) {
            this.logger.debug("Menu hide skipped: paused by modal dialog");
            return;
        }
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
        if (resultWrap.dropIfMenuHidden === true) {
            // 异步到达的结果：菜单已被用户隐藏则直接丢弃，不重新点亮
            this.componentRef.instance.setContentIfShowing(resultWrap.optionItem, resultWrap.type);
            return;
        }
        this.componentRef.instance.setContent(resultWrap.optionItem, resultWrap.type);
    }

    /**
     * 向Provider广播用户输入的，已回车的cmd
     * @param cmd 用户输入的cmd
     * @param sessionId sessionId，和会话相关
     * @param tab tab实例
     * @param matchedByRegExp 
     */
    public broadcastUserEnteredCmd(cmd: string, sessionId: string, tab: BaseTerminalTabComponent<BaseTerminalProfile>, matchedByRegExp: boolean) {
        const terminalSessionInfo: TerminalSessionInfo = {
            config: this.configService,
            tab: tab,
            sessionId: sessionId,
            matchedByRegExp: matchedByRegExp
        }
        this.contentProviderList.forEach((provider) => {
            provider.userInputCmd(cmd, terminalSessionInfo).catch((err) => {
                this.logger.error("插入新命令失败", err);
            });
        });
    }

    public disable() {
        this.menuStatus = false;
        this.hideMenu(true);
        this.menuStatusNotificationSubject.next(this.menuStatus);
        this.document.querySelector(".og-tac-tool-btn")?.setAttribute("stroke", "purple");
    }

    public enable() {
        this.menuStatus = true;
        this.currentSessionId = "";
        this.lastCmd = "";
        this.lastCursorIndexAt = -1;
        this.recentBlockedUuid = "";
        this.menuStatusNotificationSubject.next(this.menuStatus);
        setTimeout(()=>{
            this.document.querySelector(".og-tac-tool-btn")?.setAttribute("stroke", "green");
        }, 300);
    }

    /**
     * 是否启用的控制，和menu是否正显示无关
     * @returns 
     */
    public getStatus() {
        return this.menuStatus;
    }

    /**
     * @param extra 附加的终端运行态信息（当前目录 / 最近输出），供 AI provider 使用
     */
    public sendCurrentText(text: string, cursorIndexAt: number, uuid: string, sessionId: string, tab: BaseTerminalTabComponent<BaseTerminalProfile>, ignoreStatus, extra?: { cwd?: string, recentOutput?: string }) {
        this.currentCmd = text;
        if (!this.menuStatus && !ignoreStatus) {
            this.logger.debug("Ignore sended cmd for menuStatus == false")
            return;
        }
        // ignoreStatus（force）为用户通过快捷键主动呼出，跳过检查
        if (ignoreStatus) {
            // 主动呼出同时结束"历史跳转"抑制状态
            this.recentHistoryJumpStatus = false;
        } else {
            if (this.recentHistoryJumpStatus) {
                this.logger.debug("Ignored due to recent history input");
                return;
            }
            if (this.lastCmd === text && this.lastCursorIndexAt === cursorIndexAt && this.currentSessionId == sessionId) {
                // 和上一个一致，无需处理
                this.logger.debug("和上一个一致，无需处理");
                return;
            }
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
            sessionId: sessionId,
            cwd: extra?.cwd ?? '',
            recentOutput: extra?.recentOutput ?? '',
        }
        this.contentProviderList.forEach((provider) => {
            provider.getQuickCmdList(text, cursorIndexAt, envBasicInfo)
             .then(this.optionItemTypePostProcess.bind(this)).catch((err)=>{
                this.logger.error("获取快捷命令列表失败", err);
             });
        });
        
        this.componentRef.instance.test(text);
        this.lastCmd = text;
        this.lastCursorIndexAt = cursorIndexAt;
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
                this.hideMenu(true);
            }
        } else if (key === 'ArrowDown' && !this.hasFloatWnd()) {
            if (this.componentRef.instance.selectDown() !== null) {
                actFlag = true;
            } else {
                this.recentHistoryJumpStatus = true;
                this.hideMenu(true);
            }
        } else if (key === 'Enter' && !this.hasFloatWnd()) {
            const currentIndex = this.componentRef.instance.currentItemIndex;
            this.enterNotificationSubject.next();
            if (currentIndex != -1 && this.componentRef.instance.showingFlag) {
                this.componentRef.instance.inputItem(currentIndex, 1);
                actFlag = true;
                this.logger.debug("handle enter: input")
            } else {
                this.hideMenu(true);
                this.logger.debug("handle enter: hide")
            }
        } else if (key === 'Escape') {
            this.recentBlockedUuid = this.recentUuid;
            // 广播给终端：本行不再展示提示，直到回车换行 / 会话切换 / 用户主动呼出
            this.escapeNotificationSubject.next();
            if (this.componentRef.instance.showingFlag) {
                this.hideMenu(true);
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
  