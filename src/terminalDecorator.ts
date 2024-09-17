import { Injectable } from '@angular/core'
import { bufferTime } from 'rxjs'
import { AddMenuService } from 'services/insertMenu';
import { TerminalDecorator, BaseTerminalTabComponent, BaseSession, BaseTerminalProfile } from 'tabby-terminal'
import stripAnsi from 'strip-ansi';

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
        tab.addEventListenerUntilDestroyed(tab.element.nativeElement.querySelector(".xterm-helper-textarea"), 'focusout', () => {
            this.addMenuService.hideMenu();
            console.log("focus out,")
        }, true);
        
        // 为xterm添加focusout事件监听
        tab.input$.pipe(bufferTime(300)).subscribe((buffers: Buffer[]) => {
            // TODO: 还需要判断当前是否是输入命令的状态，其他vim文本输入等情况不做处理
            // 将接收到的缓冲区内容拼接起来
            const inputString = Buffer.concat(buffers).toString();

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
        let temp = "";
        const regex = /[\x08\x1b]((\[\??\d+[hl])|([=<>a-kzNM78])|([\(\)][a-b0-2])|(\[\d{0,2}\w)|(\[\d+;\d+[hfy]?)|(\[;?[hf])|(#[3-68])|([01356]n)|(O[mlnp-z]?)|(\/Z)|(\d+)|(\[\?\d;\d0c)|(\d;\dR))/gi

        

        tab.output$.pipe(bufferTime(300)).subscribe((data: string[]) => {
            // 需要注意，输出也有补充部分（补充当前行的输出），这个可能不能直接判定
            const outputString = data.join('');

            const cleanedOutputString = this.cleanupOutput(temp + outputString);
            temp = cleanedOutputString;
            const templist = temp.split("\n");
            temp = templist.pop() || "";

            const resplitStringArray = outputString.split("\n");

            const lastRowString = resplitStringArray[resplitStringArray.length - 1];
            // console.log("最后一行 r", lastRowString);
            // console.log("最后一行 c", temp);
            // console.log("对象内", tab.output$.forEach);
            // console.log("全体输出", Buffer.from(outputString, "utf-8").toString());
            if (lastRowString.match(new RegExp("]1337;CurrentDir="))) {
                isCmdStatus = true;
                temp = "";
            }
            if (isCmdStatus) {
                this.addMenuService.sendCurrentText(temp);
            }
            // console.log("当前是否用户输入状态", isCmdStatus);
        });
        tab.sessionChanged$.subscribe(session => {
            if (session) {
                this.attachToSession(session)
            }
        })
        if (tab.session) {
            this.attachToSession(tab.session)
        }
    }

    private cleanupOutput (data: string): string {
        // console.log("原data", data);
        // console.log("strip处理后", stripAnsi(data));
        // console.log("processBackspaces", this.processBackspaces(stripAnsi(data));
        return this.processBackspaces(stripAnsi(data));
    }

    private processBackspaces(input: string) {
        let result = [];  // 用数组来存储最终结果，处理效率更高
    
        for (let char of input) {
            if (char === '\b' || char === '\u007F' || char === "\x07") {
                // 遇到退格字符，删除前一个字符（如果有）
                if (result.length > 0) {
                    result.pop();
                }
            } else {
                // 非退格字符，直接加入结果
                result.push(char);
            }
        }
    
        // 将数组转换为字符串并返回
        return result.join('');
    }

    private attachToSession (session: BaseSession) {
        session.output$.subscribe(data => {
            if (data.includes('command not found')) {
                //
            }
        })
    }
}
