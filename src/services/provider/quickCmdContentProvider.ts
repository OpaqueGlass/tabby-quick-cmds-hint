import { OptionItem, EnvBasicInfo } from "../../api/pluginType";
import Fuse from 'fuse.js';
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";
import { MyLogger } from "services/myLogService";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class QuickCmdContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = "q";
    constructor(
        protected logger: MyLogger
    ) {
        super(logger);
    }
    
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        const result: OptionItem[] = [];
        const options = {
            keys: ['name'], // 搜索的字段
            threshold: 0.3, // 控制匹配的模糊度
            includeScore: true // 包含得分
        };
        const dataList = envBasicInfo.config.store.qc.cmds.map((oneCmd) => {
            return {
                name: oneCmd.name,
                content: oneCmd.text,
                desp: "",
                type: QuickCmdContentProvider.providerTypeKey
            } as OptionItem;
        });
        const fuse = new Fuse(dataList, options);
        this.logger.log("匹配结果", fuse.search(inputCmd));
        result.push(...fuse.search(inputCmd).map((value)=>value.item as OptionItem));
        return {
            optionItem: result,
            envBasicInfo: envBasicInfo
        };
    }
}