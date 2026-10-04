/*  
*  tabby-quick-cmds-hint: A simple complete hint plugin for tabby.
*  Copyright (C) 2025 OpaqueGlass
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

import {
    cleanTerminalText,
    cleanTextByNewXterm,
    generateUUID,
    isValidStr,
    RECENT_OUTPUT_MAX_CHARS,
    RECENT_OUTPUT_MAX_LINES,
    simpleHash,
    truncateTerminalOutput,
} from "utils/commonUtils";
import { BaseManager } from "./baseManager";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";
import { MyLogger } from "services/myLogService";
import { AddMenuService } from "services/menuService";
import { ConfigService, NotificationsService } from "tabby-core";
import { MySignalService } from "services/signalService";

interface LastStateLinesObj {
    raw: string;
    cleaned: string;
    /**
     * 清理后的终端输出（末尾若干行，已按行数与字符数双重截断）。
     * 内联补全与 AI 弹窗两个渠道都取这个字段，保证"预览看到的"与"实际发送的"是同一个字符串。
     */
    full: string;
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
    /** 由 OSC 1337 采集到的当前工作目录 */
    private currentCwd: string = "";
    /** 最近一次采集到的终端输出（仅在用户开启采集时非空） */
    private recentOutputFull: string = "";
    /**
     * 用户按 Escape 取消了本行提示。
     * 置位期间不再向菜单推送内容，直到回车换行 / 会话切换 / 用户用快捷键主动呼出。
     */
    private escapeDismissed: boolean = false;
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
        this.subscriptionList.push(addMenuService.escapeNotification$.subscribe(this.dismissCurrentLine.bind(this)));
        this.subscriptionList.push(signalService.startCompleteNow$.subscribe(this.suggestNow.bind(this)));
    }
    /**
     * 用户按 Escape：本行不再展示提示。
     * 只作用于当前获得焦点的终端。
     */
    dismissCurrentLine() {
        if (!this.tab.hasFocus) {
            return;
        }
        this.escapeDismissed = true;
        this.logger.debug("Hint dismissed by Escape until the next line");
    }

    async endCmdStatus() {
        this.logger.debug("收到Enter信号", this)
        this.cmdStatusFlag = false;
        if (!this.tab.hasFocus) {
            return;
        }
        // 回车意味着本行结束，解除 Escape 屏蔽
        this.escapeDismissed = false;
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
            this.logger.messyDebug("本次响应", outputString, recentStateLinesHash);
            this.recentStateLineHash = recentStateLinesHash;
        }
        // 正则匹配获取prompt prefix，先执行
        if (this.configService.store.ogAutoCompletePlugin.useRegExpDetectPrompt == true) {
            const cleanLastStateLine = cleanTerminalText(lastStateLinesStr);
            const matchResult = cleanLastStateLine.match(this.loadRegExp());
            this.logger.debug("RegExp Debug [MatchResult, lastLine]", matchResult, lastStateLinesStr);
            if (matchResult) {
                const newPrompt = matchResult[0];
                // 正则识别 prompt 时，每敲一个字符都会重新命中同一行 prompt。
                // 若每次都换 uuid，"本次输入"的标识就失去了意义，
                // Escape 记下的"本行不再提示"也会在下一个字符就失效。
                // 因此只有在新的一行开始（cmdStatusFlag 为 false）或 prompt 变化时才换 uuid。
                if (!this.cmdStatusFlag || newPrompt !== this.recentCleanPrompt) {
                    this.recentUuid = generateUUID();
                }
                this.recentCleanPrompt = newPrompt;
                this.cmdStatusFlag = true;
                this.usingRegExp = true;
            }
        }
        // 从 转移序列 获取prompt prefix
        this.logger.messyDebug("最后一行原文本", outputString.split("\n").slice(-1)[0])
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
                // 顺带取出 CurrentDir 的值作为当前工作目录
                const dirMatch = lastValidPrompt.match(/CurrentDir=([^\x07\x1b]*)/);
                if (dirMatch && isValidStr(dirMatch[1])) {
                    this.currentCwd = dirMatch[1];
                    this.logger.debug("更新当前目录", this.currentCwd);
                }
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
        // full 始终计算，便于 AI 弹窗等外部场景按需取用
        const fullStateStr = truncateTerminalOutput(
            cleanedAllStateStr,
            this.getRecentOutputMaxLines(),
            this.getRecentOutputMaxChars(),
        );
        const result = {
            "raw": lastRawStateLineStr, 
            "cleaned": lastCleanedStateLineStr,
            "full": fullStateStr,
        } as LastStateLinesObj;
        this.recentOutputFull = this.needRecentOutput() ? fullStateStr : "";
        return result;
    }

    /**
     * 当前工作目录（依赖 shell 集成上报），供 AI 请求上下文使用。
     */
    public get cwd(): string {
        return this.currentCwd ?? "";
    }

    /**
     * 是否需要采集最近的终端输出。
     * 仅在 AI 功能非关闭、且用户显式开启时采集：
     * auto 档不采集（内联补全不打扰用户输入），故限定为 manual 档。
     */
    private needRecentOutput(): boolean {
        const ai = this.configService.store?.ogAutoCompletePlugin?.ai;
        return ai?.enable === 'manual' && ai?.includeLastOutput === true;
    }

    /**
     * 采集终端输出的最大行数，可在设置中调整（ai.recentOutputMaxLines）。
     * 非法值回退到默认值。
     */
    private getRecentOutputMaxLines(): number {
        return this.readPositiveNumberConfig('recentOutputMaxLines', RECENT_OUTPUT_MAX_LINES);
    }

    /**
     * 采集终端输出的最大字符数，可在设置中调整（ai.recentOutputMaxChars）。
     * 行数限制之外的第二道保险，非法值回退到默认值。
     */
    private getRecentOutputMaxChars(): number {
        return this.readPositiveNumberConfig('recentOutputMaxChars', RECENT_OUTPUT_MAX_CHARS);
    }

    /**
     * 读取 ai 配置中的正整数项，缺失或非法时返回默认值。
     */
    private readPositiveNumberConfig(key: string, fallback: number): number {
        const n = Number(this.configService.store?.ogAutoCompletePlugin?.ai?.[key]);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
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
    sendCmd(cmd: string, cursorIndexAt: number, force: boolean = false) {
        if (this.escapeDismissed) {
            // 用户已用 Escape 取消本行提示，不再推送内容给菜单
            this.logger.debug("Skipped hint: dismissed by Escape in this line");
            return;
        }
        if (isValidStr(cmd) && this.tab.hasFocus) {
            this.logger.messyDebug("menu sending", cmd);
            this.addMenuService.sendCurrentText(
                cmd, cursorIndexAt, this.recentUuid, this.sessionUniqueId, this.tab, force,
                { cwd: this.currentCwd, recentOutput: this.recentOutputFull }
            );
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
        // 出现一个全新的空 prompt（Ctrl+C 之后等）也意味着换了新的一行，解除 Escape 屏蔽
        if (!isValidStr(cmd.trim()) && isValidStr(this.recentCleanPrompt)
            && lastStateLineObj.cleaned.includes(this.recentCleanPrompt)) {
            this.escapeDismissed = false;
        }
        // force（快捷键主动呼出）时不再要求 cmdStatusFlag，跳过检查
        if (isValidStr(cmd) && (force || this.cmdStatusFlag)) {
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
        // 用户用快捷键主动呼出，解除 Escape 屏蔽
        this.escapeDismissed = false;
        this.recentUuid = generateUUID();
        try {
            await this.getCmdAndSuggest(await this.getLastStateLine(), true);
        } catch (err) {
            // 取终端状态失败时不要抛到调用方（会变成未处理的 Promise 异常），记录即可
            this.logger.error("Suggest now failed", err);
        }
    }
    handleSessionChanged = (session) => {
        this.logger.log("session changed", session);
        this.escapeDismissed = false;
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
        return cleanByXterm.trim();

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