import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from 'tabby-core';
import { MyLogger } from 'services/myLogService';

/**
 * AI 请求发送前的人工确认弹窗。
 * 仅在用户开启"附带最近终端输出"且通过列表入口显式触发时出现，
 * 用于让用户看到（并可编辑）即将发送给 AI 的完整内容。
 */
@Component({
    template: require('./aiPromptConfirmDialog.pug'),
    styles: [require('./aiPromptConfirmDialog.scss')],
})
export class AIPromptConfirmDialogComponent {
    promptText: string = '';
    neverAskAgain: boolean = false;

    constructor(
        private activeModal: NgbActiveModal,
        private logger: MyLogger,
        private translate: TranslateService,
    ) { }

    /**
     * 确认发送。返回编辑后的 prompt 与"本次会话内不再询问"选择。
     */
    confirm() {
        this.activeModal.close({
            prompt: this.promptText,
            neverAskAgain: this.neverAskAgain,
        });
    }

    cancel() {
        this.activeModal.dismiss();
    }

    t(key: string, params?: any): string {
        return this.translate.instant(key, params);
    }
}
