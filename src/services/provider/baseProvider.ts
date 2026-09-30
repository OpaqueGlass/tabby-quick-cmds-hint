import { EnvBasicInfo, OptionItem, TerminalSessionInfo } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { ConfigService } from "tabby-core";

export interface OptionItemResultWrap {
    optionItem: OptionItem[];
    envBasicInfo: EnvBasicInfo;
    type: string;
    /**
     * 为 true 时，若菜单当前未显示则丢弃本次结果。
     * 用于异步到达的结果（如 AI 自动补全），避免用户已隐藏菜单后又被重新点亮。
     */
    dropIfMenuHidden?: boolean;
}

export class BaseContentProvider {
    protected static providerTypeKey: string = "ERROR_THIS_NOT_USED_FOR_PROVIDER";
    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
    ) {

    }
    async getQuickCmdList(inputCmd: string, cursorIndexAt: number, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        // do sth
        
        return null;
    }
    async userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): Promise<void> {

    }
    userSelectedCallback(inputCmd: string): void {

    }
}