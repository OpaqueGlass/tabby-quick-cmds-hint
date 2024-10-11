import { Injectable } from '@angular/core'
import { bufferTime } from 'rxjs'
import { AddMenuService } from 'services/insertMenu';
import { TerminalDecorator, BaseTerminalTabComponent, BaseTerminalProfile } from 'tabby-terminal'
import { cleanTerminalText, generateUUID, sleep } from 'utils/commonUtils';


@Injectable()
export class AutoCompleteTerminalDecorator extends TerminalDecorator {
    hintMenu: any;
    constructor (
        private addMenuService: AddMenuService
    ) {
        super()
        addMenuService.insertComponent();
    }

    attach (tab: BaseTerminalTabComponent<BaseTerminalProfile>): void {
        let currentLine = ''; // 用于存储当前正在键入的行
        console.log("tab内容判断", tab);
        console.log("tab内容判断", tab.element.nativeElement);
        let isCmdStatus = false;
        tab.addEventListenerUntilDestroyed(tab.element.nativeElement.querySelector(".xterm-helper-textarea"), 'focusout', async () => {
            // 这里需要延迟，否则无法点击上屏
            await sleep(200);
            // this.addMenuService.hideMenu();
            console.log("focus out,")
        }, true);
        
        // 为xterm添加focusout事件监听
        tab.input$.pipe(bufferTime(300)).subscribe((buffers: Buffer[]) => {
            // 还需要判断当前是否是输入命令的状态，其他vim文本输入等情况不做处理
            // 将接收到的缓冲区内容拼接起来
            const inputString = Buffer.concat(buffers).toString();
            console.log("近期输入", inputString, JSON.stringify(inputString));
            // ssh连接ubuntu 实测换行为\r
            if (inputString.includes("\n") || inputString.includes("\r")) {
                // 如果输入中包含 \n 或 \r\n，说明用户已经按下了Enter，则重置currentLine，考虑到采样间隔，保留最后一行
                currentLine = '';
                const lastNewlineIndex = inputString.lastIndexOf('\r') == -1 ? inputString.lastIndexOf('\n') : inputString.lastIndexOf('\r');
                console.log("重置", lastNewlineIndex + 1 < inputString.length)
                if (lastNewlineIndex + 1 < inputString.length) {
                    currentLine = inputString.slice(lastNewlineIndex + 1);
                }
                // 判定停止用户命令输入状态
                if (isCmdStatus == true) {
                    isCmdStatus = false;
                    console.log("判定停止用户输入状态");
                    this.addMenuService.hideMenu();
                }
            } else {
                // 如果输入中不包含 \n 或 \r\n，说明用户正在键入，将当前输入追加到 currentLine
                currentLine += inputString;
            }
            // ssh连接ubuntu，实测删除为\u007F
            if (currentLine.includes('\u007F') || currentLine.includes("\b")) {
                console.log("字符串中包含退格");
                currentLine = this.processBackspaces(currentLine);
            }
        });
        let recentCleanPrefix = null;
        let recentUuid;


        tab.output$.pipe(bufferTime(300)).subscribe((data: string[]) => {
            const outputString = data.join('');
            const allStateStr = tab.frontend.saveState();
            // console.log("STATE STR", JSON.stringify(allStateStr));
            const lines = allStateStr.trim().split("\n");
            const lastSerialLinesStr = lines.slice(-1).join("\n");
            // console.log("最后几行", lastSerialLinesStr);

            // console.log("本次获取内容", JSON.stringify(outputString), outputString);

            // 
            

            // 通过最近输出判定开始键入命令
            if (outputString.match(new RegExp("]1337;CurrentDir="))) {
                // 获取最后一行
                const lastRawLine = outputString.split("\n").slice(-1)[0];
                const startRegExp = /.*\x1b\]1337;CurrentDir=.*?\x07/gm;
                const matchGroup = lastRawLine.match(startRegExp);
                let lastValidPrefix = "";
                if (matchGroup && matchGroup.length > 0) {
                    lastValidPrefix = matchGroup[matchGroup.length - 1];
                }
                // 获取清理后内容
                let tempPrefix = cleanTerminalText(lastValidPrefix);
                if (tempPrefix == null || tempPrefix.trim() == "") {
                    console.log("前缀获取异常");
                } else {
                    recentCleanPrefix = tempPrefix.trim();
                }
                console.log("更新：清理后命令前缀", recentCleanPrefix);
                isCmdStatus = true;
                recentUuid = generateUUID();
            }

            const cleanedLastSerialLinesStr = cleanTerminalText(lastSerialLinesStr);
            // console.log("清理后，最近几行", cleanedLastSerialLinesStr, "PREFIX", recentCleanPrefix)
            if (recentCleanPrefix && cleanedLastSerialLinesStr.includes(recentCleanPrefix)) {
                const firstValieIndex = cleanedLastSerialLinesStr.lastIndexOf(recentCleanPrefix) + recentCleanPrefix.length;
                let cmd = cleanedLastSerialLinesStr.slice(firstValieIndex);
                console.log("命令为", cmd);
                if (cmd && tab.hasFocus) {
                    console.log("menue seding", cmd);
                    this.addMenuService.sendCurrentText(cmd, recentUuid);
                } else if (tab.hasFocus) {
                    console.log("menue close");
                    this.addMenuService.hideMenu();
                }
            }
        });
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

    // private attachToSession (session: BaseSession) {
    //     // session.output$.subscribe(data => {
    //     //     if (data.includes('command not found')) {
    //     //         //
    //     //     }
    //     // })
    // }
}
