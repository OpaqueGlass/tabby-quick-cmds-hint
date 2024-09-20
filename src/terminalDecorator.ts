import { Injectable } from '@angular/core'
import { bufferTime } from 'rxjs'
import { AddMenuService } from 'services/insertMenu';
import { TerminalDecorator, BaseTerminalTabComponent, BaseSession, BaseTerminalProfile } from 'tabby-terminal'
import { resetAndClearXterm, sleep } from 'utils/commonUtils';
import { Terminal } from '@xterm/xterm';
import { Unicode11Addon } from '@xterm/addon-unicode11';

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
            this.addMenuService.hideMenu();
            console.log("focus out,")
        }, true);

        const xterm = new Terminal({
            allowTransparency: true,
            allowProposedApi: true,
        });
        xterm.loadAddon(new Unicode11Addon());
        xterm.unicode.activeVersion = "11";
        xterm.open(document.createElement("div"));

        // 为xterm添加focusout事件监听
        tab.input$.pipe(bufferTime(300)).subscribe((buffers: Buffer[]) => {
            // 还需要判断当前是否是输入命令的状态，其他vim文本输入等情况不做处理
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
                    resetAndClearXterm(xterm);
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
            // console.log("输入组当前行", currentLine);
            
        });
        let justInput = false;

        tab.output$.pipe(bufferTime(300)).subscribe((data: string[]) => {
            // 需要注意，输出也有补充部分（补充当前行的输出），这个可能不能直接判定
            let outputString = data.join('');
            console.log("本次获取内容", outputString);
            // if (data[data.length - 1]?.match(new RegExp("]1337;CurrentDir="))) {
            //     outputString = data[data.length - 1];
            // }
            outputString = this.outputStrPreprocess(outputString, xterm);
            xterm.write(outputString, ()=>{
                // 文本过多时需要先等待上屏，或者，咱们对过多的内容截断一下？
                if (outputString.match(new RegExp("]1337;CurrentDir="))) {
                    resetAndClearXterm(xterm);
                    const regExp = /\x1b\]1337;CurrentDir=.*?\x07/g;
                    const matches = outputString.match(regExp);
                    if (matches) {
                        console.log("有匹配", matches[0]);
                        const endIndex = outputString.indexOf(matches[0]) + matches[0].length;
                        resetAndClearXterm(xterm);
                        console.log("截断内容", outputString.slice(endIndex));
                        xterm.write(outputString.slice(endIndex));
                    }
                    isCmdStatus = true;
                    justInput = true;
                } else {
                    justInput = false;
                }
                // 刚判定输入时，会获取到 user:$
                if (isCmdStatus && !justInput) {
                    xterm.selectAll();
                    const xtermStr = xterm.getSelection();
                    console.log("xterm", xtermStr.trim());
                    xterm.clearSelection();
                    this.addMenuService.sendCurrentText(xtermStr.trim());
                }
            });
            
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

    private outputStrPreprocess(output: string, xterm: Terminal) {
        // [C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[C[K
        let regExp = /(\x1b\[C){24}/g;
        if (output.match(regExp)) {
            output = output.replace(regExp, "");
            resetAndClearXterm(xterm);
        }
        return output;
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

    private attachToSession (session: BaseSession) {
        session.output$.subscribe(data => {
            if (data.includes('command not found')) {
                //
            }
        })
    }
}
