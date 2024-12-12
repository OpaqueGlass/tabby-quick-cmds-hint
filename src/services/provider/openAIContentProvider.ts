import { OptionItem, EnvBasicInfo } from "../../api/pluginType";
import Fuse from 'fuse.js';
import OpenAI from "openai";
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";
import { MyLogger } from "services/myLogService";
import { Injectable } from "@angular/core";
import { ConfigService } from "tabby-core";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { AutoCompleteAIDialogComponent } from "components/autoCompleteAIDialog";



// @Injectable({
//     providedIn: 'root'
// })
export class OpenAIContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = "a";
    openai: OpenAI;
    private recentEnvBasicInfo: EnvBasicInfo;
    private recentDialogRef: NgbModalRef;
    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
        private ngbModal: NgbModal,
    ) {
        super(logger);
    }
    
    // TODO: 需要提供给gpt具体的终端等信息
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        // xs
        // const quickCmdList = response.split("\n").map((cmd) => {
        //     return {
        //         label: cmd,
        //         description: "Quick Command",
        //         detail: "Quick Command"
        //     };
        // });
        // return quickCmdList;
        this.recentEnvBasicInfo = envBasicInfo;
        return {
            optionItem: [
                {
                    name: "ask ai for help",
                    content: inputCmd,
                    desp: "",
                    callback: this.userAskAiCallback.bind(this, inputCmd, this.recentEnvBasicInfo),
                    type: OpenAIContentProvider.providerTypeKey
                }
            ],
            envBasicInfo: envBasicInfo
        };
    }
    async userAskAiCallback(inputCmd: string, envBasicInfo: EnvBasicInfo) {
        if (this.recentDialogRef) {
            this.recentDialogRef.close();
        }
        this.logger.log("inputCmd", inputCmd);
        this.recentDialogRef = this.ngbModal.open(AutoCompleteAIDialogComponent);
        // 处理

        // 返回结果
        // this.recentDialogRef.componentInstance.inputCmd = inputCmd;
        
    }
}
