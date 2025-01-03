import { EnvBasicInfo, OptionItem, TerminalSessionInfo } from "api/pluginType";
import { MyLogger } from "services/myLogService";

export interface OptionItemResultWrap {
    optionItem: OptionItem[];
    envBasicInfo: EnvBasicInfo;
    type: string;
}

export class BaseContentProvider {
    protected static providerTypeKey: string = "ERROR_THIS_NOT_USED_FOR_PROVIDER";
    constructor(
        protected logger: MyLogger,
    ) {

    }
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        // do sth
        
        return null;
    }
    async userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): Promise<void> {

    }
    userSelectedCallback(inputCmd: string): void {

    }
}