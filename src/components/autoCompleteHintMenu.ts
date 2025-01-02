import { Component, ElementRef, Inject, Input, Renderer2, SimpleChanges, type OnChanges, ChangeDetectorRef } from '@angular/core'
import { OptionItem } from '../api/pluginType'
import { AppService, ConfigService } from 'tabby-core';
import { isValidStr, sendInput } from 'utils/commonUtils';
import { MyLogger } from 'services/myLogService';
import { DOCUMENT } from '@angular/common';

@Component({
    template: require('./autoCompleteHintMenu.pug'),
    styles: [require('./autoCompleteHintMenu.scss')],
})
export class AutoCompleteHintMenuComponent {
    mainText: string = "Hello, world! This is the tabby-auto-complete plugin speaking~";
    showStatus: boolean = false;
    options: OptionItem[] = [];
    currentItemIndex: number = -1;
    recentTargetElement: HTMLElement;
    showingFlag: boolean = false;
    contentGroups: {[key: string]: OptionItem[]} = {};
    constructor(
        private renderer: Renderer2,
        private elRef: ElementRef,
        private app: AppService,
        private logger: MyLogger,
        @Inject(DOCUMENT) private document: Document,
        private configService: ConfigService
    ) {
        this.currentItemIndex = -1;
        this.showStatus = false;
        this.contentGroups = {
            "q": [],// quick cmd
            "h": [],// highlight
            "a": [],// ai
        }
    }

    private doRegetItems() {
        // 记录当前的option
        const currentOption = this.getCurrentItem();

        // 按照 contentGroups中的key顺序，遍历，将结果加入到options中
        this.options = [];
        for (let key in this.contentGroups) {
            this.options = this.options.concat(this.contentGroups[key]);
        }
        if (this.options.length == 0) {
            this.hideAutocompleteList();
            return;
        } else {
            this.showAutocompleteList(this.document.querySelector('.content-tab-active.active .focused .xterm-helper-textarea'))
        }
        // 调整后，仍然选择之前的option
        if (currentOption) {
            const newIndex = this.options.findIndex(option => option.content === currentOption.content && option.type === currentOption.type);
            this.currentItemIndex = newIndex !== -1 ? newIndex : -1;
        } else {
            this.currentItemIndex = -1;
        }
    }


    public setContent(newVal: OptionItem[]) {
        this.contentGroups[newVal[0].type] = newVal;
        this.doRegetItems();
        // this.options = newVal;
        // this.currentItemIndex = -1;
    }

    public show() {
        this.showStatus = true;
    }

    public test(text: string) {
        this.mainText = text;
    }
    private refreshMainText() {
        if (this.currentItemIndex < 0 || this.currentItemIndex >= this.options.length) {
            this.mainText = "No such item";
            return;
        }
        this.mainText = this.options[this.currentItemIndex].content ?? "";
    }

    private clearContent() {
        this.showStatus = false;
        this.options = [];
        this.currentItemIndex = -1;
        for (let key in this.contentGroups) {
            this.contentGroups[key] = [];
        }
    }

    public clearSelection() {
        this.currentItemIndex = -1;
    }

    // 在输入框的事件中调用此函数
    showAutocompleteList(targetElement: HTMLElement) {
        const listEl = this.elRef.nativeElement.children[0];
        this.recentTargetElement = targetElement;
        // make sure adjustPosition is called after the list is shown
        setTimeout(this.adjustPosition.bind(this), 0);
        // 显示自动完成列表
        this.renderer.setStyle(listEl, 'display', 'block');
        this.showingFlag = true;
    }

    adjustPosition() {
        const listEl = this.elRef.nativeElement.children[0];
        const targetRect = this.recentTargetElement.getBoundingClientRect();
        // 获取窗口的高度
        const viewportHeight = window.document.querySelector("ssh-tab .terminal.xterm")?.clientHeight || window.innerHeight;

        // 下方位置和上方位置
        const belowPosition = targetRect.bottom;
        const abovePosition = targetRect.top - listEl.offsetHeight;
        this.logger.debug("height(liOffset, belowPosition, viewport)", listEl.clientHeight, belowPosition, viewportHeight)
        // 决定显示在下方还是上方
        let topPosition: number;
        const fontSize: number = this.configService.store.terminal.fontSize;
        if (belowPosition + listEl.offsetHeight + fontSize <= viewportHeight) {
            // 下方有足够空间
            topPosition = belowPosition;
            this.logger.debug("Down")
        } else {
            // 上方有足够空间
            topPosition = abovePosition;
        }

        // 设置位置样式
        this.renderer.setStyle(listEl, 'top', `${topPosition}px`);
        this.renderer.setStyle(listEl, 'left', `${targetRect.left}px`);
        // this.renderer.setStyle(listEl, 'width', `${targetRect.width}px`);
    }

    // 隐藏自动完成列表
    public hideAutocompleteList() {
        this.clearContent();
        const listEl = this.elRef.nativeElement.children[0];
        if (listEl) {
            this.renderer.setStyle(listEl, 'display', 'none');
        }
        this.showingFlag = false;
    }

    selectUp() {
        if (!this.showingFlag) {
            this.logger.log("不再显示")
            return null;
        }
        if (this.currentItemIndex >= 0) {
            this.currentItemIndex--;
        } else {
            this.logger.log("???", this.currentItemIndex);
            return null;
        }
        this.refreshMainText();
        return this.currentItemIndex;
    }
    selectDown() {
        if (!this.showingFlag) {
            return null;
        }
        if (this.currentItemIndex < this.options.length - 1) {
            this.currentItemIndex++;
            // setTimeout(this.adjustPosition.bind(this), 0);
        } else {
            return null;
        }
        this.refreshMainText();
        return this.currentItemIndex;
    }

    getCurrentItem() {
        if (this.currentItemIndex < 0) {
            return null;
        }
        return this.options[this.currentItemIndex];
    }

    getCurrentIndex() {
        return this.currentItemIndex;
    }

    /**
     * 将用户选择项目上屏
     * @param index cmd index
     * @param type 类型：0 仅上屏 1上屏并回车
     */
    inputItem(index: number, type: number) {
        this.logger.log(`Selected index: ${index}, type: ${type}, content: ${JSON.stringify(this.options)}`);
        if (this.options[index].callback) {
            const newOptionList = this.options[index].callback();
            if (newOptionList == null || newOptionList.length == 0) {
                this.hideAutocompleteList();
                return;
            } else {
                this.clearContent();
                this.setContent(newOptionList);
                return;
            }
        }
        sendInput({
            tab: this.app.activeTab,
            cmd: this.options[index].content,
            appendCR: type == 1,
            singleLine: false,
            clearFirst: true,
            refocus: true
        });
        if (type == 1) {
            this.hideAutocompleteList();
        }
        this.clearSelection();
        // 上屏完毕可能还需要调用focus
    }
    isValidStr(str: string) {
        return isValidStr(str);
    }
}
