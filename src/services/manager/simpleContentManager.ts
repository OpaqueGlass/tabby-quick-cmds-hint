import { cleanTerminalText, cleanTextByNewXterm, generateUUID, isValidStr, simpleHash } from "utils/commonUtils";
import { BaseManager } from "./baseManager";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";
import { MyLogger } from "services/myLogService";
import { AddMenuService } from "services/menuService";
import { ConfigService, NotificationsService } from "tabby-core";
import { MySignalService } from "services/signalService";

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
        this.subscriptionList.push(addMenuService.enterNotification$.subscribe(this.endCmdStatus));
        signalService.startCompleteNow$.subscribe(this.suggestNow.bind(this));
    }
    endCmdStatus = async () => {
        this.logger.debug("收到Enter信号")
        this.cmdStatusFlag = false;
        const lastStateLine = this.getLastStateLine();
        // 检查
        const cmd = await this.getCmd(lastStateLine, cleanTerminalText(lastStateLine));
        if (isValidStr(cmd) && cmd[0] != " " && !cmd.trim().endsWith("/")) {
            this.logger.log("广播命令", cmd);
            this.addMenuService.broadcastUserEnteredCmd(cmd, this.sessionUniqueId, this.tab, this.usingRegExp);
        }
    }
    handleInput = (buffers: Buffer[]) => {
        return;
        // 还需要判断当前是否是输入命令的状态，其他vim文本输入等情况不做处理
        // 将接收到的缓冲区内容拼接起来
        const inputString = Buffer.concat(buffers).toString();
        if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
            this.logger.log("近期输入", inputString, JSON.stringify(inputString));
        }
        // ssh连接ubuntu 实测换行为\r
        if (inputString.includes("\n") || inputString.includes("\r")) {
            const lastNewlineIndex = inputString.lastIndexOf('\r') == -1 ? inputString.lastIndexOf('\n') : inputString.lastIndexOf('\r');
            this.logger.debug("当前行内容", this.currentLine);
            // 如果输入中包含 \n 或 \r\n，说明用户已经按下了Enter，则重置currentLine，考虑到采样间隔，保留最后一行
            this.currentLine = '';
            this.logger.debug("重置", lastNewlineIndex + 1 < inputString.length)
            if (lastNewlineIndex + 1 < inputString.length) {
                this.currentLine = inputString.slice(lastNewlineIndex + 1);
            }
            // 判定停止用户命令输入状态 bug: 在回车后可能立刻就下一个命令的输入，这个时候似乎判定由于pipe的延迟导致出现被停止输入状态的情况
            // if (this.cmdStatusFlag == true) {
            //     this.cmdStatusFlag = false;
            //     this.logger.log("判定停止用户输入状态");
            //     this.addMenuService.hideMenu();
            // }
            this.userImputedFlag = true;
        } else {
            // 如果输入中不包含 \n 或 \r\n，说明用户正在键入，将当前输入追加到 currentLine
            this.currentLine += inputString;
        }
        // ssh连接ubuntu，实测删除为\u007F
        // if (this.currentLine.includes('\u007F') || this.currentLine.includes("\b")) {
        //     this.logger.log("字符串中包含退格");
        //     this.currentLine = this.processBackspaces(currentLine);
        // }
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
        this.getCmdAndSuggest(lastStateLinesStr);
    }
    getLastStateLine() {
        const allStateStr = this.tab.frontend.saveState();
        const lines = allStateStr.trim().split("\n");
        const lastStateLineStr = lines.slice(-1).join("\n");
        return lastStateLineStr
    }
    /**
     * 从输入字符串中，获取用户输入的命令
     * @param lastStateLineStr 最后一行statel
     * @param cleanedLastStateLineStr 清理转义符后的stateline
     * @returns 用户输入的命令，可能为空字符串
     */
    async getCmd(lastStateLineStr: string, cleanedLastStateLineStr: string) {
        let cmd = "";
        // some times [1B still not provided in vim, tmux or screen
        // "[1B" means cursor go to next line. in most cases, it means the command is finished
        if (this.recentCleanPrompt && cleanedLastStateLineStr.includes(this.recentCleanPrompt) && !lastStateLineStr.includes("[1B")) {
            const firstValieIndex = cleanedLastStateLineStr.lastIndexOf(this.recentCleanPrompt) + this.recentCleanPrompt.length;
            cmd = cleanedLastStateLineStr.slice(firstValieIndex);
            this.logger.messyDebug("命令为", cmd);
        } else if (this.tab.hasFocus) {
            this.logger.messyDebug("getCmd未匹配", this.recentCleanPrompt, cleanedLastStateLineStr.includes(this.recentCleanPrompt), !lastStateLineStr.includes("[1B"), this.cmdStatusFlag)
        }
        return cmd;
    }
    /**
     * 发送命令，给出提示菜单
     * @param cmd 提示的命令
     */
    sendCmd(cmd: string, force: boolean = false) {
        if (isValidStr(cmd) && this.tab.hasFocus) {
            this.logger.messyDebug("menu sending", cmd);
            this.addMenuService.sendCurrentText(cmd, this.recentUuid, this.sessionUniqueId, this.tab, force);
        } else if (this.tab.hasFocus) {
            if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                this.logger.debug("menu close");
            }
            this.addMenuService.hideMenu();
        }
    }
    async getCmdAndSuggest(lastStateLineStr: string, force: boolean=false) {
        const cleanedLastSerialLinesStr = cleanTerminalText(lastStateLineStr);
        const cmd = await this.getCmd(lastStateLineStr, cleanedLastSerialLinesStr);
        if (isValidStr(cmd) && this.cmdStatusFlag) {
            this.logger.messyDebug("命令为", cmd);
            this.sendCmd(cmd, force);
        } else if (this.tab.hasFocus) {
            this.logger.messyDebug("menu close by not match or cmd disabled", this.recentCleanPrompt,  cleanedLastSerialLinesStr.includes(this.recentCleanPrompt), !lastStateLineStr.includes("[1B"));
            this.addMenuService.hideMenu();
        }
    }
    suggestNow() {
        if (!this.tab.hasFocus) {
            return;
        }
        this.recentUuid = generateUUID();
        this.getCmdAndSuggest(this.getLastStateLine(), true);
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
        if (!isValidStr(cleanByXterm?.trim())) {
            return cleanByRegExp;
        }
        if (cleanByRegExp !== cleanByXterm && this.configService.store.ogAutoCompletePlugin.debugLevel < 2) {
            this.notification.error("[tabbyquick-hint-debug-report]清理不一致");
            this.logger.warn("清理不一致", cleanByRegExp + " != " + cleanByXterm);
        }
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