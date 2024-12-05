import { EnvBasicInfo, OptionItem } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { TerminalSessionInfo } from "./baseProvider";

export class BaseContentProvider {
    constructor(
        private logger: MyLogger
    ) {
        
    }
    static getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): OptionItem[] {
        // do sth
        
        return null;
    }
    static userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): void {

    }
    static userSelectedCallback(inputCmd: string): void {

    }
    private static saveCmdToDB(cmd: string): void {

    }
}