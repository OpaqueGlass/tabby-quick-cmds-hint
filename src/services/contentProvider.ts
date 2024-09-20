import {
    Inject,
    Injectable,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigService } from 'tabby-core';
import { OptionItem } from 'api/pluginType';
import Fuse from 'fuse.js';

@Injectable({
providedIn: 'root'
})
export class ContentProviderService {
    constructor(
        private config: ConfigService,
        @Inject(DOCUMENT) private document: Document
    ) {}

    public getContentList(inputCmd: string): OptionItem[] {
        const result: OptionItem[] = [];
        const envBasicInfo = {config: this.config};
        result.push(...QuickCmdContentProvider.getQuickCmdList(inputCmd, envBasicInfo));
        return result;
    }
}

interface EnvBasicInfo {
    config: ConfigService;
}

class QuickCmdContentProvider {
    static getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): OptionItem[] {
        const result: OptionItem[] = [];
        const options = {
            keys: ['name'], // 搜索的字段
            threshold: 0.4, // 控制匹配的模糊度
            includeScore: true // 包含得分
        };
        const dataList = envBasicInfo.config.store.qc.cmds.map((oneCmd) => {
            return {
                name: oneCmd.name,
                content: oneCmd.text,
                desp: "",
                type: "q"
            } as OptionItem;
        });
        const fuse = new Fuse(dataList, options);
        // console.log("匹配结果", fuse.search(inputCmd));
        result.push(...fuse.search(inputCmd).map((value)=>value.item as OptionItem));
        return result;
    }
}
  