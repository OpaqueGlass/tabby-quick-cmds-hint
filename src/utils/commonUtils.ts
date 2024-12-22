import { Terminal } from "@xterm/xterm";
import { clear } from "console";
import stripAnsi from "strip-ansi";
import { AppService, BaseTabComponent, SplitTabComponent } from "tabby-core";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";

export function isValidStr(input: string) {
    return input !== undefined && input !== null && input !== '';
}

export function cleanTerminalText(input: string) {
    const cleanNotVisibleExp = /[\x1b\x07]\[(?:[0-9]{1,2}(?:;[0-9]{1,2})*)?[a-zA-Z]|[\x1b\x07]\].*?\x07|[\x1b\x07]\[\?.*?[hl]|[\x1b\x07]\[>4;m|[\x1b\x07]\>|\x1B\(B/g;
    // fish (B

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
 * @param refocus 是否在输入后重新聚焦终端
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
        console.debug("tab", currentTab);
        console.debug("Sending " + cmd);

        let cmds = cmd.split(/(?:\r\n|\r|\n)/)

        if (clearFirst) {
            const endKeyEvent = new KeyboardEvent('keydown', {
                key: 'End',
                code: 'End',
                keyCode: 35,
                which: 35,
                bubbles: true,
                cancelable: true
            });
            window.document.dispatchEvent(endKeyEvent);
            currentTab.sendInput("\u0015"); //Ctrl + E
            // currentTab.sendInput("\u0003"); //Ctrl + c // have stability issue
        }

        for (let i = 0; i < cmds.length; i++) {
            let cmd = cmds[i];
            console.debug("Sending " + cmd);


            if (cmd.startsWith('\\s')) {
                cmd = cmd.replace('\\s', '');
                let sleepTime = parseInt(cmd);

                await sleep(sleepTime);

                console.debug('sleep time: ' + sleepTime);
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

export function cleanTextByNewXterm(input: string) {
    // 15ms
    return new Promise<string>((resolve) => {
        let term = new Terminal();
        const dom = document.createElement("div");
        dom.classList.add("ogmytempxterm");
        window.document.body.appendChild(dom);
        term.open(dom);
        term.write(input, ()=>{
            term.selectAll();
            const result = term.getSelection();
            term.dispose();
            resolve(trimLineTextFromXterm(result));
        });
    });
}

export function inputInitScripts(app: AppService) {
    const scripts = ` if [[ -z "$DIR_REPORTING_ENABLED" ]]; then export DIR_REPORTING_ENABLED=1; if [[ $SHELL == */bash ]]; then export PS1="$PS1\\[\\e]1337;CurrentDir=$(pwd)\a\]"; elif [[ $SHELL == */zsh ]]; then precmd() { echo -n "\\x1b]1337;CurrentDir=$(pwd)\\x07"; }; elif [[ $SHELL == */fish ]]; then fish -c 'function __tabby_working_directory_reporting --on-event fish_prompt; echo -en "\e]1337;CurrentDir=$PWD\\x7"; end'; else echo "Unsupported shell"; fi; fi`;
    // 需要转义 "， /等，另外，前导空格可以避免写入history
    const bashCommand = ` if [[ -z "$DIR_REPORTING_ENABLED" ]]; then export DIR_REPORTING_ENABLED=1; if [[ $SHELL == */bash ]]; then export PS1="$PS1\\[\\e]1337;CurrentDir=$(pwd)\\a\\]"; elif [[ $SHELL == */zsh ]]; then precmd() { echo -n "\\x1b]1337;CurrentDir=$(pwd)\\x07"; }; elif [[ $SHELL == */fish ]]; then fish -c 'function __tabby_working_directory_reporting --on-event fish_prompt; echo -en "\\e]1337;CurrentDir=$PWD\\x7"; end'; else echo "Unsupported shell"; fi; fi`;
    // Add history support
    const commandV2 = ` if [[ -z "$DIR_REPORTING_ENABLED" ]]; then export DIR_REPORTING_ENABLED=1; if [[ $SHELL == */bash ]]; then export PS1="$PS1\\[\\e]1337;CurrentDir=$(pwd)\\a\\]"; function preexec_invoke_exec() { printf "\\033]2323;Command=%s\\007" "$1"; }; trap 'preexec_invoke_exec "$BASH_COMMAND"' DEBUG; elif [[ $SHELL == */zsh ]]; then precmd() { echo -n "\\x1b]1337;CurrentDir=$(pwd)\\x07"; }; elif [[ $SHELL == */fish ]]; then fish -c 'function __tabby_working_directory_reporting --on-event fish_prompt; echo -en "\\e]1337;CurrentDir=$PWD\\x7"; end'; else echo "Unsupported shell"; fi; fi`;

    sendInput({
        "tab": app.activeTab,
        "cmd": commandV2,
        "appendCR": true,
    });

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

export function trimLineTextFromXterm(input: string) {
    return input.replace(new RegExp("\n", "gm"), "");
}