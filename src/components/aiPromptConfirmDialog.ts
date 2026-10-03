import { AfterViewInit, Component, ElementRef } from '@angular/core';
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
export class AIPromptConfirmDialogComponent implements AfterViewInit {
    promptText: string = '';
    neverAskAgain: boolean = false;

    constructor(
        private activeModal: NgbActiveModal,
        private logger: MyLogger,
        private translate: TranslateService,
        private elRef: ElementRef,
    ) { }

    /**
     * 打开后让编辑器停在开头。
     * ngb 默认会把焦点交给第一个可输入控件（模板上已用 ngbAutofocus 改指到弹窗根节点），
     * 这里再兜一次底：焦点若仍在 textarea 就交出去，避免显示光标并滚到内容末尾。
     */
    ngAfterViewInit(): void {
        setTimeout(() => this.showPromptFromStart(), 0);
    }

    /**
     * 编辑器回到开头：无焦点、滚动在顶部、光标在起始位置。
     * 只在打开时执行一次，不影响用户之后的点击 / Tab。
     */
    private showPromptFromStart(): void {
        const editor = this.elRef.nativeElement?.querySelector('textarea') as HTMLTextAreaElement | null;
        if (editor == null) {
            return;
        }
        editor.scrollTop = 0;
        try {
            editor.setSelectionRange(0, 0);
        } catch (err) {
            this.logger.debug('Skip resetting prompt editor caret', err);
        }
    }

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
