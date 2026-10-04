/*  
*  tabby-quick-cmds-hint: A simple complete hint plugin for tabby.
*  Copyright (C) 2025 OpaqueGlass
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
import { Injectable } from '@angular/core';
import { bufferTime, Subscription } from 'rxjs';
import { SimpleManager } from 'services/manager/simpleContentManager';
import { AddMenuService } from 'services/menuService';
import { MyLogger } from 'services/myLogService';
import { RawOutputTap } from 'services/rawOutputTap';
import { MySignalService } from 'services/signalService';
import { AppService, ConfigService, NotificationsService } from 'tabby-core';
import { TerminalContextService } from 'services/terminalContextService';
import { BaseTerminalProfile, BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal';
import { inputInitScripts, sleep } from 'utils/commonUtils';


@Injectable()
export class AutoCompleteTerminalDecorator extends TerminalDecorator {
    hintMenu: any;
    constructor (
        private addMenuService: AddMenuService,
        private configService: ConfigService,
        private logger: MyLogger,
        private app: AppService,
        private notification: NotificationsService,
        private signalService: MySignalService,
        private terminalContext: TerminalContextService,
    ) {
        super()
        addMenuService.insertComponent();
    }

    attach (tab: BaseTerminalTabComponent<BaseTerminalProfile>): void {
        // TODO: 这里最好是区分一下终端，给个实例什么的，另外，可能可以通过currentPwd判断是否
        this.logger.log("tab内容判断", tab);
        this.logger.log("tab内容判断", tab.element.nativeElement);
        // 连接时提示使用init命令
        const sessionChangedSubscription = tab.sessionChanged$.subscribe(session => {
            this.logger.log("tab内容判断sessionChanged", tab.session?.supportsWorkingDirectory(), tab.title);
            this.logger.log("tab内容判断sessionChanged", session?.supportsWorkingDirectory());
            // 这个changed涉及重新连接什么的，所以，如果为false时没有，如果为session undefined就是没连上
            // 可以考虑给上自动加入脚本，但windows就hh
            if (session?.supportsWorkingDirectory()) {
                // 如果已经有了，就不需要操作，隐藏标签？
            } else if (session && !session?.supportsWorkingDirectory()) {
                // 提示添加
                // 或者自动加入
                if (this.configService.store.ogAutoCompletePlugin.autoInit) {
                    setTimeout(()=>{inputInitScripts(this.app);}, 300);
                }
            }
        });
        super.subscribeUntilDetached(tab, sessionChangedSubscription);
        // END

        tab.addEventListenerUntilDestroyed(tab.element.nativeElement.querySelector(".xterm-helper-textarea"), 'focusout', async () => {
            // 这里需要延迟，否则无法点击上屏
            await sleep(200);
            if (this.configService.store.ogAutoCompletePlugin.debugLevel > 1) {
                this.addMenuService.hideMenu();
            }
            this.logger.log("focus out");
        }, true);
        
        const mangager = new SimpleManager(tab, this.logger, this.addMenuService, this.configService, this.notification, this.signalService);
        // 登记到上下文服务，供 AI 弹窗等场景按需抓取终端输出
        this.terminalContext.register(tab, mangager);
        if (mangager.handleInput) {
            super.subscribeUntilDetached(tab, tab.input$.pipe(bufferTime(300)).subscribe(mangager.handleInput));
        }
        const detachOutputSource = mangager.handleOutput ? this.attachOutputSource(tab, mangager) : null;
        super.subscribeUntilDetached(tab, tab.sessionChanged$.subscribe(mangager.handleSessionChanged));
        const destroySub = tab.destroyed$.subscribe(()=>{
            this.terminalContext.unregister(tab);
            detachOutputSource?.();
            mangager.destroy();
            destroySub.unsubscribe();
        });
        // ????
        // tab.sessionChanged$.subscribe(session => {
        //     if (session) {
        //         this.attachToSession(session)
        //     }
        // })
        // if (tab.session) {
        //     this.attachToSession(tab.session)
        // }
    }


    /**
     * 接管终端输出源。
     *
     * tabby >= 1.0.231 起，`OSCProcessor` 会在数据到达终端前把 OSC 1337（`CurrentDir`）、
     * OSC 52 序列从输出流中剥离，所以 `tab.output$` 里已经没有 `\x1b]1337;CurrentDir=...\x07`，
     * 插件据此判断 prompt 结束位置的逻辑会完全失效。
     * 这里把 `RawOutputTap` 插到会话中间件栈顶，直接取未被 tabby 处理的原始数据；
     * 探针会把数据原样继续下发，不影响 tabby 自身行为。
     * 不支持中间件栈的旧版本 tabby 则退回 `tab.output$`。
     *
     * @returns 清理函数：移除探针并停止订阅
     */
    private attachOutputSource(
        tab: BaseTerminalTabComponent<BaseTerminalProfile>,
        mangager: SimpleManager,
    ): () => void {
        /** frontend 就绪前到达的数据先攒着，避免丢掉连接后的第一个 prompt */
        const MAX_PENDING_BYTES = 65536;
        let pendingBuffers: Buffer[] = [];
        let currentTap: RawOutputTap | null = null;
        let currentTapSession: any = null;
        let fallbackSubscription: Subscription | null = null;

        const removeTap = () => {
            if (!currentTap) {
                return;
            }
            try {
                // 先从栈里摘掉，再 complete，避免旧会话继续向已失效的订阅推数据
                currentTapSession?.middleware?.remove(currentTap);
                currentTap.close();
            } catch (e) {
                this.logger.debug("移除输出探针失败", e);
            }
            currentTap = null;
            currentTapSession = null;
        };

        const stopFallback = () => {
            fallbackSubscription?.unsubscribe();
            fallbackSubscription = null;
        };

        const install = (session) => {
            removeTap();
            if (!session?.middleware?.unshift) {
                // 旧版 tabby：没有中间件栈，退回原始输出（其中仍含 OSC 1337）
                if (!fallbackSubscription) {
                    fallbackSubscription = tab.output$.pipe(bufferTime(300)).subscribe(mangager.handleOutput);
                    super.subscribeUntilDetached(tab, fallbackSubscription);
                }
                return;
            }
            stopFallback();
            const tap = new RawOutputTap();
            session.middleware.unshift(tap);
            currentTap = tap;
            currentTapSession = session;
            super.subscribeUntilDetached(tab, tap.raw$.pipe(bufferTime(300)).subscribe(buffers => {
                if (!buffers?.length) {
                    return;
                }
                pendingBuffers.push(...buffers);
                if (!tab.frontend?.saveState) {
                    // frontend 未就绪时先缓存，超长时丢弃最旧的部分
                    let total = pendingBuffers.reduce((sum, buf) => sum + buf.length, 0);
                    while (total > MAX_PENDING_BYTES && pendingBuffers.length > 1) {
                        total -= pendingBuffers.shift().length;
                    }
                    return;
                }
                // 数据按 chunk 到达，逐个 toString 会截断多字节字符，必须先合并
                const data = Buffer.concat(pendingBuffers).toString();
                pendingBuffers = [];
                mangager.handleOutput([data]);
            }));
        };

        super.subscribeUntilDetached(tab, tab.sessionChanged$.subscribe(install));
        // sessionChanged$ 是普通 Subject，附加时已连接的会话需要立即处理
        install(tab.session);
        return () => {
            removeTap();
            stopFallback();
        };
    }

    private processBackspaces(input: string) {
        let result = [];  // 用数组来存储最终结果，处理效率更高
    
        for (let char of input) {
            if (char === '\b' || char === '\u007F' || char === "\x07") {
                // 遇到退格字符，删除前一个字符（如果有）
                if (result.length > 0) {
                    result.pop();
                }
            } else if (char === "\x15" || char === "\u0015") {
                result = [];
            } else {
                // 非退格字符，直接加入结果
                result.push(char);
            }
        }
    
        // 将数组转换为字符串并返回
        return result.join('');
    }
}
