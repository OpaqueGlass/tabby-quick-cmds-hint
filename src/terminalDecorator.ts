import { Injectable } from '@angular/core'
import { bufferTime } from 'rxjs'
import { TerminalDecorator, BaseTerminalTabComponent, BaseSession, BaseTerminalProfile } from 'tabby-terminal'

@Injectable()
export class AutoCompleteTerminalDecorator extends TerminalDecorator {
    constructor (
    ) {
        super()
    }

    attach (tab: BaseTerminalTabComponent<BaseTerminalProfile>): void {
        let currentLine = ''; // 用于存储当前正在键入的行
        console.log("tab内容判断", tab);
        console.log("tab内容判断", tab.element.nativeElement);
        tab.input$.pipe(bufferTime(3000)).subscribe((buffers: Buffer[]) => {
            // 将接收到的缓冲区内容拼接起来
            const inputString = Buffer.concat(buffers).toString();
            // 问题不能判断删除

            // ssh连接ubuntu 实测换行为\r
            if (inputString.includes("\n") || inputString.includes("\r")) {
                // 如果输入中包含 \n 或 \r\n，说明用户已经按下了Enter
                // 重置 currentLine
                currentLine = '';
                const lastNewlineIndex = inputString.lastIndexOf('\n');
                currentLine = inputString.slice(lastNewlineIndex + 1);
            } else {
                // 如果输入中不包含 \n 或 \r\n，说明用户正在键入
                // 将当前输入追加到 currentLine
                currentLine += inputString;
            }
            // ssh连接ubuntu，实测删除为\u007F
            if (currentLine.includes('\u007F') || currentLine.includes("\b")) {
                console.log("字符串中包含退格");
                currentLine = this.processBackspaces(currentLine);
            }

            // 输出当前正在键入的行
            console.log(currentLine);
            // 非空字符串发给内容判定和显示
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

    private processBackspaces(input: string) {
        let result = [];  // 用数组来存储最终结果，处理效率更高
    
        for (let char of input) {
            if (char === '\b' || char === '\u007F') {
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
