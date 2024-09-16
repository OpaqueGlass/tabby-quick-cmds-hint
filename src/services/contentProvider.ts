import {
    Inject,
    Injectable,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigService } from 'tabby-core';
import { OptionItem } from 'api/pluginType';

@Injectable({
providedIn: 'root'
})
export class ContentProviderService {
    constructor(
        private config: ConfigService,
        @Inject(DOCUMENT) private document: Document
    ) {}

    public getContentList(inputCmd: String): OptionItem[] {
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
    static getQuickCmdList(inputCmd: String, envBasicInfo: EnvBasicInfo): OptionItem[] {
        const result: OptionItem[] = [];
        for (let oneCmd of envBasicInfo.config.store.qc.cmds) {
            if (oneCmd.name.includes(inputCmd)) {
                result.push({
                    name: oneCmd.name,
                    content: oneCmd.text + oneCmd.appendCR ? "\n" : "",
                    desp: "",
                    type: "q"   
                } as OptionItem);
            }
        }
        return result;
    }
}
  