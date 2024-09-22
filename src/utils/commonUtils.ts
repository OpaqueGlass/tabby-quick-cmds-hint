import { Terminal } from "@xterm/xterm";
import { BaseTabComponent, SplitTabComponent } from "tabby-core";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";

export function cleanTerminalText(input: string) {
    const cleanNotVisibleExp = /[\x1b\x07]\[(?:[0-9]{1,2}(?:;[0-9]{1,2})*)?[a-zA-Z]|[\x1b\x07]\].*?\x07|[\x1b\x07]\[\?.*?[hl]/g;
    

    let result = input.replace(cleanNotVisibleExp, '');
    
    return result;
}


export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 
 * @param tab terminal标签页
 * @param cmd 待输入的命令 请注意 \\s将被认为延迟输入，\\x将被认为是16进制字符
 * @param appendCR 是否在命令后追加回车
 * @param singleLine 是否忽略换行，而一次只输入一行
 * @param clearFirst 是否在输入前清空终端
 * 
 */
export async function sendInput({tab, cmd, appendCR = false,
    singleLine = false, clearFirst = false, refocus = true}: {
    tab: BaseTabComponent | SplitTabComponent,
    cmd: string,
    appendCR?: boolean,
    singleLine?: boolean,
    clearFirst?: boolean,
    refocus?: boolean
}) {
    if (tab instanceof SplitTabComponent) {
        sendInput({
            tab: (tab as SplitTabComponent).getFocusedTab(),
            cmd: cmd,
            appendCR: appendCR,
            singleLine: singleLine,
            clearFirst: clearFirst,
            refocus: refocus
        });
    }
    if (tab instanceof BaseTerminalTabComponent) {
        let currentTab = tab as BaseTerminalTabComponent<BaseTerminalProfile>;
        console.log("tab", currentTab);
        console.log("Sending " + cmd);

        let cmds = cmd.split(/(?:\r\n|\r|\n)/)

        if (clearFirst) {
            currentTab.sendInput("\u0015");
        }

        for (let i = 0; i < cmds.length; i++) {
            let cmd = cmds[i];
            console.log("Sending " + cmd);


            if (cmd.startsWith('\\s')) {
                cmd = cmd.replace('\\s', '');
                let sleepTime = parseInt(cmd);

                await sleep(sleepTime);

                console.log('sleep time: ' + sleepTime);
                continue;
            }

            if (cmd.startsWith('\\x')) {
                cmd = cmd.replace(/\\x([0-9a-f]{2})/ig, function (_, pair) {
                    return String.fromCharCode(parseInt(pair, 16));
                });
            }
            if (i != cmds.length - 1) {
                cmd = cmd + "\n";
            }
            if (appendCR) {
                cmd = cmd + "\n";
            }
            currentTab.sendInput(cmd);
            // 点击会导致失去聚焦，可能这里也需要携带参数
            if (refocus) {
                currentTab.frontend.focus();
            }
        }

    }
}

export function resetAndClearXterm(xterm: Terminal) {
    console.log("清屏");
    xterm.clear();
    xterm.write('\x1b[2J');
}

export function generateUUID() {
    let uuid = '';
    let i = 0;
    let random = 0;

    for (i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else {
            random = Math.random() * 16 | 0;
            if (i === 19) {
                random = (random & 0x3) | 0x8;
            }
            uuid += (random).toString(16);
        }
    }

    return uuid;
}