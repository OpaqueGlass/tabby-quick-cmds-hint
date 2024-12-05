import { EnvBasicInfo, OptionItem } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";

export interface TerminalSessionInfo {

}

export class BaseContentProvider {
    constructor(
        private logger: MyLogger,
        private tab: BaseTerminalTabComponent<BaseTerminalProfile>
    ) {

    }
    getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): OptionItem[] {
        // do sth
        
        return null;
    }
    userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): void {

    }
    userSelectedCallback(inputCmd: string): void {

    }
}