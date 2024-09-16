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
        this.addMenuService.setMenuContent();
        let isCmdStatus = false;
        console.log(this.hintMenu)
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
            
            if (isCmdStatus) {
                this.addMenuService.sendCurrentText(currentLine);
            }

            // console.log(currentLine);
            // TODO: 非空字符串发给内容判定和显示currentLine为当前键入的行
            // tab.session.getWorkingDirectory().then((path) => {
            //     console.log("path", path);

            // });
        });
        let temp = "";
        const regex = /[\x08\x1b]((\[\??\d+[hl])|([=<>a-kzNM78])|([\(\)][a-b0-2])|(\[\d{0,2}\w)|(\[\d+;\d+[hfy]?)|(\[;?[hf])|(#[3-68])|([01356]n)|(O[mlnp-z]?)|(\/Z)|(\d+)|(\[\?\d;\d0c)|(\d;\dR))/gi

        function cleanupOutput (data: string): string {
            return stripAnsi(data ?? data.replace(regex, ''))
        }
        tab.output$.subscribe((data: string) => {
            data = cleanupOutput(data);
            temp += data;
            const templist = temp.split("\n");
            temp = templist.pop() || "";
        });
        tab.output$.pipe(bufferTime(300)).subscribe((data: string[]) => {
            // 需要注意，输出也有补充部分（补充当前行的输出），这个可能不能直接判定
            const outputString = data.join('\n');
            // console.log("输出", outputString);
            // console.log("当前是否用户输入", isCmdStatus);
            const resplitStringArray = outputString.split("\n");

            // tab.frontend?.xterm?.select(0, tab.frontend?.xterm?.rows, 100);
            // console.log("选取", tab.frontend?.xterm?.getSelection(), tab.frontend?.xterm?.rows);
            // tab.frontend?.xterm?.clearSelection();
            // console.log("选区", tab.frontend.getSelection(), tab.frontend?.xterm?.buffer.active.length);
            // tab.frontend.clearSelection();
            // 使用cmd判断；这里只判断启用
            // 输入区在命令输入过程中遇到 换行之后 关闭输入状态

            // centos这个办法就不行，没这个东西，而且，这个转义符的原本含义不符合
            // for (let item of data) {
            //     if (item.startsWith("\x1b\[\?2004h")) {
            //         console.log("开始用户输入");
            //         isCmdStatus = true;
            //     } else if (item.startsWith("\x1b\[\?2004l")) {
            //         console.log("结束用户输入");
            //         isCmdStatus = false;
            //     }
            // }
            // isCmdStatus = true;
            // 我们应该在会话开始之前，传入命令，完成：
            // - 将命令起始改写，让我们能够获得命令开始的pattern
            // - 删除这个命令的history
            // 另外，看起来用户输入也会上屏到 输出，看看如何获取输入更好吧
            const lastRowString = resplitStringArray[resplitStringArray.length - 1];
            // console.log("最后一行", lastRowString);
            console.log("最后一行", temp);
            // console.log("对象内", tab.output$.forEach);
            // console.log("全体输出", Buffer.from(outputString, "utf-8").toString());
            if (lastRowString.match(new RegExp("]1337;CurrentDir="))) {
                isCmdStatus = true;
            }
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
