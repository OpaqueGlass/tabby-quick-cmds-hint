import { BaseTabComponent, SplitTabComponent } from "tabby-core";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";


/**
 * 
 * @param tab terminal标签页
 * @param cmd 待输入的命令 请注意 \\s将被认为延迟输入，\\x将被认为是16进制字符
 */
export async function sendInput(tab: BaseTabComponent, cmd: string, appendCR: boolean = false,
    singleLine: boolean = false
) {
    if (tab instanceof SplitTabComponent) {
        this._send((tab as SplitTabComponent).getFocusedTab(), cmd)
    }
    if (tab instanceof BaseTerminalTabComponent) {
        let currentTab = tab as BaseTerminalTabComponent<BaseTerminalProfile>;
        console.log("tab", currentTab);
        console.log("Sending " + cmd);

        let cmds = cmd.split(/(?:\r\n|\r|\n)/)

        for (let i = 0; i < cmds.length; i++) {
            let cmd = cmds[i];
            console.log("Sending " + cmd);


            if (cmd.startsWith('\\s')) {
                cmd = cmd.replace('\\s', '');
                let sleepTime = parseInt(cmd);

                await this.sleep(sleepTime);

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
            currentTab.sendInput(cmd);
        }

    }
}