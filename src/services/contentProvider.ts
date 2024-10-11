import {
    Inject,
    Injectable,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigService } from 'tabby-core';
import { OptionItem } from 'api/pluginType';
import { QuickCmdContentProvider } from './provider/quickCmdContentProvider';

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
        const envBasicInfo = {config: this.config, document: this.document};
        result.push(...QuickCmdContentProvider.getQuickCmdList(inputCmd, envBasicInfo));
        return result;
    }
}

interface EnvBasicInfo {
    config: ConfigService;
    document: Document;
}
