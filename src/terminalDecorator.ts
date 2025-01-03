import { Injectable } from '@angular/core'
import { bufferTime, Subscription } from 'rxjs'
import { AddMenuService } from 'services/insertMenu';
import { SimpleManager } from 'services/manager/simpleContentManager';
import { MyLogger } from 'services/myLogService';
import { AppService, ConfigService, NotificationsService } from 'tabby-core';
import { TerminalDecorator, BaseTerminalTabComponent, BaseTerminalProfile } from 'tabby-terminal'
import { cleanTerminalText, generateUUID, inputInitScripts, sleep } from 'utils/commonUtils';


@Injectable()
export class AutoCompleteTerminalDecorator extends TerminalDecorator {
    hintMenu: any;
    constructor (
        private addMenuService: AddMenuService,
        private configService: ConfigService,
        private logger: MyLogger,
        private app: AppService,
        private notification: NotificationsService,
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
            // TODO: 这里只是为了方便DEBUG，才不做处理的，正式版应当移除注释
            // this.addMenuService.hideMenu();
            this.logger.log("focus out");
        }, true);
        
        const mangager = new SimpleManager(tab, this.logger, this.addMenuService, this.configService, this.notification);
        if (mangager.handleInput) {
            super.subscribeUntilDetached(tab, tab.input$.pipe(bufferTime(300)).subscribe(mangager.handleInput));
        }
        if (mangager.handleOutput) {
            super.subscribeUntilDetached(tab, tab.output$.pipe(bufferTime(300)).subscribe(mangager.handleOutput));
        }
        super.subscribeUntilDetached(tab, tab.sessionChanged$.subscribe(mangager.handleSessionChanged));
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
