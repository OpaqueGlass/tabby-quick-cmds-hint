import { Component, ElementRef, Renderer2 } from '@angular/core'
import { OptionItem } from '../api/pluginType'
import { AppService } from 'tabby-core';

@Component({
    template: require('./autoCompleteHintMenu.pug'),
    styles: [require('./autoCompleteHintMenu.css')],
})
export class AutoCompleteHintMenuComponent {
    mainText: string = "HelloWorld";
    showStatus: boolean = false;
    options: OptionItem[] = [];
    currentItemIndex: number = -1;
    constructor(
        private renderer: Renderer2,
        private elRef: ElementRef,
        private app: AppService,
    ) {
        this.options = [];
        this.currentItemIndex = -1;
        this.showStatus = false;
    }


    setContent(newVal: OptionItem[]) {
        this.options = newVal;
        this.currentItemIndex = -1;
    }

    show() {
        this.showStatus = true;
    }

    test(text: string) {
        this.mainText = text;
    }

    testEcho() {
        console.log("Echoed")
        return true;
    }

    ajustPosition() {

    }

    clearContent() {
        this.showStatus = false;
        this.options = [];
        this.currentItemIndex = -1;
    }

    // 在输入框的事件中调用此函数
    showAutocompleteList(targetElement: HTMLElement) {
        const listEl = this.elRef.nativeElement.children[0];
        const targetRect = targetElement.getBoundingClientRect();

        // 获取窗口的高度
        const viewportHeight = window.innerHeight;

        // 下方位置和上方位置
        const belowPosition = targetRect.bottom;
        const abovePosition = targetRect.top - listEl.offsetHeight;

        // 决定显示在下方还是上方
        let topPosition: number;
        if (belowPosition + listEl.offsetHeight <= viewportHeight) {
            // 下方有足够空间
            topPosition = belowPosition;
        } else {
            // 上方有足够空间
            topPosition = abovePosition;
        }

        // 设置位置样式
        this.renderer.setStyle(listEl, 'top', `${topPosition}px`);
        this.renderer.setStyle(listEl, 'left', `${targetRect.left}px`);
        // this.renderer.setStyle(listEl, 'width', `${targetRect.width}px`);

        // 显示自动完成列表
        this.renderer.setStyle(listEl, 'display', 'block');
    }

    // 隐藏自动完成列表
    hideAutocompleteList() {
        this.clearContent();
        const listEl = this.elRef.nativeElement.children[0];
        this.renderer.setStyle(listEl, 'display', 'none');
    }

    selectUp() {
        if (this.currentItemIndex >= 0) {
            this.currentItemIndex--;
        }
    }
    selectDown() {
        if (this.currentItemIndex < this.options.length - 1) {
            this.currentItemIndex++;
        }
    }

    getCurrentItem() {
        return this.options[this.currentItemIndex];
    }

    /**
     * 将用户选择项目上屏
     * @param index cmd index
     * @param type 类型：0 仅上屏 1上屏并回车
     */
    inputItem(index: number, type: number) {
        console.log(`Selected index: ${index}, type: ${type}`);
        // 你的逻辑...
    }

}
