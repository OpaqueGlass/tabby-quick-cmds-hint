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

/**
 * getQuickCmdList 的返回值形态（三种）：
 * - Promise：异步产出结果，例如 AI 补全，结果可能延迟到达，且 resolve 出来的值可能为 null
 * - OptionItemResultWrap：同步产出结果
 * - null：本次无结果
 *
 * 调用方需自行归一化（如 Promise.resolve(...)）后再处理。
 */
export type QuickCmdListResult = Promise<OptionItemResultWrap | null> | OptionItemResultWrap | null;

export class BaseContentProvider {
    protected static providerTypeKey: string = "ERROR_THIS_NOT_USED_FOR_PROVIDER";
    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
    ) {

    }
    getQuickCmdList(inputCmd: string, cursorIndexAt: number, envBasicInfo: EnvBasicInfo): QuickCmdListResult {
        // do sth
        
        return null;
    }
    async userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): Promise<void> {

    }
    userSelectedCallback(inputCmd: string): void {

    }
}