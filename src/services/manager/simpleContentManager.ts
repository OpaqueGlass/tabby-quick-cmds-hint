import { cleanTerminalText, cleanTextByNewXterm, generateUUID, isValidStr } from "utils/commonUtils";
import { BaseManager } from "./baseManager";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";
import { MyLogger } from "services/myLogService";
import { AddMenuService } from "services/insertMenu";
import { ConfigService, NotificationsService } from "tabby-core";

export class SimpleManager extends BaseManager {
    private cmdStatusFlag: boolean;
    private userImputedFlag: boolean;
    private currentLine: string;
    private recentCleanPrefix: string;
    private recentUuid: string;
    constructor(
        public tab: BaseTerminalTabComponent<BaseTerminalProfile>, 
        public logger: MyLogger, 
        public addMenuService: AddMenuService, 
        public configService: ConfigService,
        public notification: NotificationsService
    ) {
        super(tab, logger, addMenuService, configService);
        this.logger.log("test", this.logger, tab);
        this.currentLine = "";
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
    handleOutput = (data: string[]) => {
        const outputString = data.join('');
        const allStateStr = this.tab.frontend.saveState();
        const lines = allStateStr.trim().split("\n");
        const lastSerialLinesStr = lines.slice(-1).join("\n");
        // 通过最近输出判定开始键入命令
        if (outputString.match(new RegExp("]1337;CurrentDir="))) {
            // 获取最后一行
            const lastRawLine = outputString.split("\n").slice(-1)[0];
            const startRegExp = /.*\x1b\]1337;CurrentDir=.*?\x07/gm;
            const matchGroup = lastRawLine.match(startRegExp);
            let lastValidPrefix = "";
            this.logger.debug("最后一行原文本", lastRawLine);
            this.logger.debug("匹配到的前缀", matchGroup);
            if (matchGroup && matchGroup.length > 0) {
                lastValidPrefix = matchGroup[matchGroup.length - 1];
            }
            // 获取清理后内容
            let tempPrefix = cleanTerminalText(lastValidPrefix);
            this.logger.debug("匹配到的前缀lastValidPrefix", lastValidPrefix);
            if (tempPrefix == null || tempPrefix.trim() == "") {
                this.logger.log("前缀获取异常");
            } else {
                this.recentCleanPrefix = tempPrefix//.trim();
            }
            this.logger.log("近期命令列表", lines.slice(-10).join("\n"));
            const lastMatchingLine = lines.reverse().find(line => line.includes(lastValidPrefix));
            if (lastMatchingLine) {
                const commandText = lastMatchingLine.split(lastValidPrefix).pop().trim();
                this.logger.log("命令文本", commandText);
            }
            this.logger.log("更新：清理后命令前缀", this.recentCleanPrefix);
            if (this.configService.store.ogAutoCompletePlugin.debugLevel < 2) {
                cleanTextByNewXterm(lastValidPrefix).then((result)=>{
                    if (this.recentCleanPrefix !== result) {
                        this.notification.error("[tabbyquick-hint-debug-report]清理前缀不一致", this.recentCleanPrefix + " != " + result);
                        this.logger.warn("清理前缀不一致", this.recentCleanPrefix + " != " + result);
                    }
                });
            }
            this.cmdStatusFlag = true;
            this.recentUuid = generateUUID();
        }
        // 检测命令执行，必须在原始未清理的内容中，全部输出中获取
        const replayCmdPrefix = "]2323;Command="
        if (outputString.match(new RegExp(replayCmdPrefix)) ) {
            const startRegExp = /.*\x1b\]2323;Command=[^\x07]*\x07/gm;
            const matchGroup = outputString.match(startRegExp);
            let cmd = "";
            if (matchGroup && matchGroup.length > 0) {
                cmd = matchGroup[matchGroup.length - 1];
                cmd = cmd.replace(replayCmdPrefix, "");
                cmd = cmd.replace("\x07", "");
                // cmd = cmd.trim();
                cmd = cmd.replace(/\s+$/, "");
            }
            // 避免把乱七八糟的转义码当做history
            this.logger.debug("识别到的执行命令", cmd);
            const cleanedCmd = cleanTerminalText(cmd);
            this.logger.debug("清理后命令(一致？)", cleanedCmd == cmd, cleanedCmd);
            if (isValidStr(cmd) && cleanedCmd == cmd && !cmd.startsWith(" ")) {
                // 处理black list
                if (cmd.match(new RegExp("^rm|\\[\\[", "gm"))) {
                    this.logger.debug("命令保存：Reject for black list", cmd);
                }
                this.logger.log("保存命令", cmd);
                this.addMenuService.broadcastNewCmd(cmd, this.sessionUniqueId, this.tab);
            }
        }

        // 发送并处理正在输入的命令
        const cleanedLastSerialLinesStr = cleanTerminalText(lastSerialLinesStr);
        // this.logger.debug("清理后，最近几行", cleanedLastSerialLinesStr, "PREFIX", this.recentCleanPrefix, this.cmdStatusFlag)
        if (this.recentCleanPrefix && cleanedLastSerialLinesStr.includes(this.recentCleanPrefix) && this.cmdStatusFlag) {
            const firstValieIndex = cleanedLastSerialLinesStr.lastIndexOf(this.recentCleanPrefix) + this.recentCleanPrefix.length;
            this.logger.debug("slice index", firstValieIndex);
            let cmd = cleanedLastSerialLinesStr.slice(firstValieIndex);
            if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                this.logger.debug("命令为", cmd);
            }
            if (cmd && this.tab.hasFocus) {
                if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                    this.logger.debug("menu sending", cmd);
                }
                this.addMenuService.sendCurrentText(cmd, this.recentUuid, this.sessionUniqueId, this.tab);
            } else if (this.tab.hasFocus) {
                if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                    this.logger.debug("menu close");
                }
                this.addMenuService.hideMenu();
            }
        } else if (this.tab.hasFocus) {
            if (this.configService.store.ogAutoCompletePlugin.debugLevel < 0) {
                this.logger.debug("menu close by not match or cmd disabled", this.cmdStatusFlag);
            }
            this.addMenuService.hideMenu();
        }
    }
    handleSessionChanged = (session) => {
        this.logger.log("session changed", session);
        this.addMenuService.hideMenu();
        this.sessionUniqueId = generateUUID();
    }
}