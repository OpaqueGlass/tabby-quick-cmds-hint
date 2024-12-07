import { EnvBasicInfo, OptionItem } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { BaseContentProvider, OptionItemResultWrap, TerminalSessionInfo } from "./baseProvider";

export class HistoryContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = "h";
    constructor(
        protected logger: MyLogger
    ) {
        super(logger);
    }
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        // do sth
        return null;
    }
    async userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): Promise<void> {

    }
    userSelectedCallback(inputCmd: string): void {

    }
    private async saveCmdToDB(cmd: string): Promise<void> {

    }
}