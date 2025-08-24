/*  
*  tabby-quick-cmds-hint: A simple complete hint plugin for tabby.
*  Copyright (C) 2025 OpaqueGlass and other developers
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

import { cleanTerminalText, cleanTextByNewXterm, generateUUID, isValidStr, simpleHash } from "utils/commonUtils";
import { BaseManager } from "./baseManager";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";
import { MyLogger } from "services/myLogService";
import { AddMenuService } from "services/menuService";
import { ConfigService, NotificationsService } from "tabby-core";
import { MySignalService } from "services/signalService";

interface LastStateLinesObj {
    raw: string;
    cleaned: string;
}
export class SimpleManager extends BaseManager {
    // 命令输入状态，由enter清除，由匹配到prefix开始
    private cmdStatusFlag: boolean;
    private userImputedFlag: boolean;
    private currentLine: string;
    private recentCleanPrompt: string;
    // 命令输入id，用于区分一次输入
    private recentUuid: string;
    private recentStateLineHash: string;
    // private regExp: RegExp;
    // 使用正则表达式匹配的
    private usingRegExp: boolean;
    constructor(
        public tab: BaseTerminalTabComponent<BaseTerminalProfile>, 
        public logger: MyLogger, 
        public addMenuService: AddMenuService, 
        public configService: ConfigService,
        public notification: NotificationsService,
        private signalService: MySignalService
    ) {
        super(tab, logger, addMenuService, configService);
        this.currentLine = "";
        this.subscriptionList.push(addMenuService.enterNotification$.subscribe(this.endCmdStatus.bind(this)));
        this.subscriptionList.push(signalService.startCompleteNow$.subscribe(this.suggestNow.bind(this)));
    }
    async endCmdStatus() {
        this.logger.debug("收到Enter信号", this)
        this.cmdStatusFlag = false;
        if (!this.tab.hasFocus) {
            return;
        }
        const lastStateLineObj = await this.getLastStateLine();
        // 检查
        // FIXME: 避免进vim之后会出现的，每次回车都广播
        const [cmd, _] = await this.getCmd(lastStateLineObj.raw, lastStateLineObj.cleaned);
        if (isValidStr(cmd) && cmd[0] != " " && !cmd.trim().endsWith("/")) {
            this.logger.log("广播命令", cmd);
            this.addMenuService.broadcastUserEnteredCmd(cmd, this.sessionUniqueId, this.tab, this.usingRegExp);
        }
    }
    handleInput = (buffers: Buffer[]) => {
        return;
    }
    handleOutput = async (data: string[]) => {
        const outputString = data.join('');
        if (!this.tab.frontend.saveState) {
            this.logger.debug("当前终端不支持saveState");
            return;
        }
        const allStateStr = this.tab.frontend.saveState();
        const lines = allStateStr.trim().split("\n");
        const lastStateLinesStr = lines.slice(-1).join("\n");

        // 重复响应判定，应对screen等停滞更新的情况
        const last5Line = lines.slice(lines.length - 5).join("\n");
        const recentStateLinesHash = simpleHash(last5Line);
        if (recentStateLinesHash == this.recentStateLineHash) {
            this.logger.messyDebug("由于重复，本次不响应", last5Line, recentStateLinesHash);
            return
        } else {
            this.recentStateLineHash = recentStateLinesHash;
        }
        // 正则匹配获取prompt prefix，先执行
        if (this.configService.store.ogAutoCompletePlugin.useRegExpDetectPrompt == true) {
            const cleanLastStateLine = cleanTerminalText(lastStateLinesStr);
            const matchResult = cleanLastStateLine.match(this.loadRegExp());
            this.logger.debug("RegExp Debug [MatchResult, lastLine]", matchResult, lastStateLinesStr);
            if (matchResult) {
                this.recentCleanPrompt = matchResult[0];
                this.cmdStatusFlag = true;
                this.recentUuid = generateUUID();
                this.usingRegExp = true;
            }
        }
        // 从 转移序列 获取prompt prefix
        if (outputString.match(new RegExp("]1337;CurrentDir="))) {
            // 获取最后一行
            const lastRawLine = outputString.split("\n").slice(-1)[0];
            const startRegExp = /.*\x1b\]1337;CurrentDir=.*?\x07/gm;
            const matchGroup = lastRawLine.match(startRegExp);
            let lastValidPrompt = "";
            this.logger.debug("最后一行原文本", lastRawLine);
            this.logger.debug("匹配到的前缀", matchGroup);
            if (matchGroup && matchGroup.length > 0) {
                lastValidPrompt = matchGroup[matchGroup.length - 1];
                // 获取清理后内容
                this.recentCleanPrompt = await this.cleanTerminalText(lastValidPrompt)
                this.logger.log("更新：清理后命令前缀", this.recentCleanPrompt);
                this.cmdStatusFlag = true;
                this.recentUuid = generateUUID();
                this.usingRegExp = false;
            } else {
                this.logger.warn("没有匹配到命令开始");
            }
        }
        // 检测命令执行，必须在原始未清理的内容中，全部输出中获取；主要用于保存历史
        // const replayCmdPrefix = "]2323;Command=";
        // if (outputString.match(new RegExp(replayCmdPrefix)) ) {
        //     const startRegExp = /.*\x1b\]2323;Command=[^\x07]*\x07/gm;
        //     const matchGroup = outputString.match(startRegExp);
        //     let cmd = "";
        //     if (matchGroup && matchGroup.length > 0) {
        //         cmd = matchGroup[matchGroup.length - 1];
        //         cmd = cmd.replace(replayCmdPrefix, "");
        //         cmd = cmd.replace("\x07", "");
        //         // cmd = cmd.trim();
        //         cmd = cmd.replace(/\s+$/, "");
        //     }
        //     // 避免把乱七八糟的转义码当做history
        //     this.logger.debug("识别到的执行命令", cmd);
        //     const cleanedCmd = await this.cleanTerminalText(cmd);
        //     // 存在转义符的、空格开始的命令不计入历史
        //     this.logger.debug("检查历史保存判定", cleanedCmd, cleanedCmd == cmd);
        //     if (isValidStr(cmd) && cleanedCmd == cmd && !cmd.startsWith(" ")) {
        //         // 处理black list，一些类型的不保存到历史
        //         this.logger.log("广播命令", cmd);
        //         this.addMenuService.broadcastNewCmd(cmd, this.sessionUniqueId, this.tab);
        //     }
        // }

        // 发送并处理正在输入的命令
        this.logger.messyDebug("lastSerialLine", lastStateLinesStr);
        this.getCmdAndSuggest(await this.getLastStateLine());
    }
    /**
     * 获取输出内容中的文本
     * @returns 
     */
    getLastStateLine = async (): Promise<LastStateLinesObj> => {
        if (!this || !this.tab || !this.tab.frontend) {
            this.logger.debug("WARN, lost frontend", this.tab);
        }
        let allStateStr = this.tab.frontend.saveState();
        try {
            // @ts-ignore
            if (this.tab.frontend.xterm._addonManager._addons) {
                let serializeAddon = null;
                // @ts-ignore
                for (let i of this.tab.frontend.xterm._addonManager._addons) {
                    if (i.instance?.serialize) {
                        serializeAddon = i.instance;
                        break;
                    }
                }
                // @ts-ignore
                allStateStr = serializeAddon.serialize({
                    excludeAltBuffer: false,
                    excludeModes: true,
                    scrollback: 200,
                });
                this.logger.debug("使用xterm内部Serialze api");
                // @ts-ignore
                this.logger.debug("使用xterm内部Serialze api", this.tab.frontend?.xterm);
            } else {
                this.logger.debug("使用包装API");
            }
        } catch (e) {
            this.logger.error("During getting serial state (beta), an ERROR occured. Fallback to origin API. ", e);
        }
        
        const cleanedAllStateStr = await cleanTextByNewXterm(allStateStr);
        const cleanedLines = cleanedAllStateStr.trim().split("\n");
        const lastCleanedStateLineStr = cleanedLines.slice(-1).join("\n");
        
        // FIX: 有时state捕捉到空白行的问题
        const lines = allStateStr.split("\n");
        const lastRawStateLineStr = lines.slice(-1).join("\n");
        return {
            "raw": lastRawStateLineStr, 
            "cleaned": lastCleanedStateLineStr
        } as LastStateLinesObj
    }
    /**
     * 从输入字符串中，获取用户输入的命令
     * @param rawLine 原始stateline，取最后一行
     * @param cleanedLine 清理转义符后的stateline，取最后一行
     * @returns 用户输入的命令，可能为空字符串
     */
    async getCmd(rawLine: string, cleanedLine: string): Promise<[string, number]> {
        let cmd = "";
        // some times [1B still not provided in vim, tmux or screen
        // "[1B" means cursor go to next line. in most cases, it means the command is finished
        const moveDownRegExp = /\x1b\[[0-9]*B/gm;
        const moveUpRegExp = /\x1b\[[0-9]*A/gm;
        const containMoveDownFlag = rawLine.match(moveDownRegExp);
        const containMoveUpFlag = rawLine.match(moveUpRegExp);
        const cleanedLastStateLineStr = await cleanTextByNewXterm(rawLine);
        if (this.recentCleanPrompt && cleanedLastStateLineStr.includes(this.recentCleanPrompt) && !containMoveDownFlag) {
            const actualLastLine = containMoveUpFlag ? cleanedLine : cleanedLastStateLineStr;
            const firstValieIndex = actualLastLine.lastIndexOf(this.recentCleanPrompt) + this.recentCleanPrompt.length;
            cmd = actualLastLine.slice(firstValieIndex);
            this.logger.messyDebug("命令为", cmd);
        } else if (this.tab.hasFocus) {
            this.logger.messyDebug("getCmd未匹配 [recentCleanPrompt, isIncludeCleanPrompt, isContainMoveDown, cmdStatus]", this.recentCleanPrompt, cleanedLastStateLineStr.includes(this.recentCleanPrompt), !containMoveDownFlag, this.cmdStatusFlag)
        }
        let cursorIndexAt = cmd.length;
        try {
            // @ts-ignore
            cursorIndexAt = this.tab.frontend.xterm.buffer.active.cursorX - this.recentCleanPrompt.length;
            // @ts-ignore
            this.logger.messyDebug("命令位置检查", this.tab.frontend.xterm.buffer.active.cursorX, this.tab.frontend.xterm.buffer.active.cursorY, this.tab.frontend.xterm.buffer.active.cursorX - this.recentCleanPrompt.length, cmd.slice(0, this.tab.frontend.xterm.buffer.active.cursorX - this.recentCleanPrompt.length));
        } catch (e) {
            this.logger.messyDebug("ERROR: 定位光标位置失败")
        } finally {
            if (cursorIndexAt <= -1 || cursorIndexAt > cmd.length) {
                cursorIndexAt = cmd.length; 
            }
        }
        return [cmd, cursorIndexAt];
    }
    /**
     * 发送命令，给出提示菜单
     * @param cmd 提示的命令
     */
    sendCmd(cmd: string, cursorIndexAt = -1, force: boolean = false) {
        if (isValidStr(cmd) && this.tab.hasFocus) {
            this.logger.messyDebug("menu sending", cmd);
            this.addMenuService.sendCurrentText(cmd, cursorIndexAt, this.recentUuid, this.sessionUniqueId, this.tab, force);
        } else if (this.tab.hasFocus) {
            if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                this.logger.debug("menu close");
            }
            this.addMenuService.hideMenu();
        }
    }
    /**
     * 
     * @param lastStateLineStr 
     * @param force 忽略当前禁用状态，强制提出提示菜单
     */
    async getCmdAndSuggest(lastStateLineObj: LastStateLinesObj, force: boolean=false) {
        const cleanedLastSerialLinesStr = cleanTerminalText(lastStateLineObj.raw);
        const [cmd, cursorIndexAt] = await this.getCmd(lastStateLineObj.raw, lastStateLineObj.cleaned);
        if (isValidStr(cmd) && this.cmdStatusFlag) {
            this.logger.messyDebug("命令为", cmd);
            this.sendCmd(cmd, cursorIndexAt, force);
        } else if (this.tab.hasFocus) {
            this.logger.messyDebug("menu close by not match or cmd disabled", this.recentCleanPrompt,  cleanedLastSerialLinesStr.includes(this.recentCleanPrompt), !lastStateLineObj.raw.includes("["));
            this.addMenuService.hideMenu();
        }
    }
    async suggestNow() {
        if (!this.tab.hasFocus) {
            return;
        }
        this.recentUuid = generateUUID();
        this.getCmdAndSuggest(await this.getLastStateLine(), true);
    }
    handleSessionChanged = (session) => {
        this.logger.log("session changed", session);
        this.addMenuService.hideMenu();
        this.sessionUniqueId = generateUUID();
    }
    async cleanTerminalText(text: string): Promise<string> {
        const cleanByRegExp = cleanTerminalText(text);
        this.logger.debug("清理后命令(一致？)", cleanByRegExp == text, cleanByRegExp);
        const cleanByXterm = await cleanTextByNewXterm(text);
        // if (!isValidStr(cleanByXterm?.trim())) {
        //     return cleanByRegExp;
        // }
        // if (cleanByRegExp !== cleanByXterm && this.configService.store.ogAutoCompletePlugin.debugLevel < 2) {
        //     this.notification.error("[tabbyquick-hint-debug-report]清理不一致");
        //     this.logger.warn("清理不一致", cleanByRegExp + " != " + cleanByXterm);
        // }
        return cleanByXterm;

    }
    loadRegExp() {
        let regExp = /[^$#\n]*([a-zA-Z0-9_]+@[a-zA-Z0-9_-]+(:| )\S*)([\$\#]) {0,1}/;
        if (!isValidStr(this.configService.store.ogAutoCompletePlugin.customRegExp?.trim())) {
            return regExp;
        }
        try {
            regExp = new RegExp(this.configService.store.ogAutoCompletePlugin.customRegExp)
        } catch (e) {
            this.logger.error("Custom RegExp ERROR", e);
        }
        return regExp;
    }
}