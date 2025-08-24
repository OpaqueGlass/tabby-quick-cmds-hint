/*  
*  tabby-quick-cmds-hint: A simple complete hint plugin for tabby.
*  Copyright (C) 2025 OpaqueGlass and other developers
*
*  This program is free software: you can redistribute it and/or modify
*  it under the terms of the GNU Affero General Public License as published
*  by the Free Software Foundation, either version 3 of the License, or
*  (at your option) any later version.
*
*  This program is distributed in the hope that it will be useful,
*  but WITHOUT ANY WARRANTY; without even the implied warranty of
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*  GNU Affero General Public License for more details.
*
*  You should have received a copy of the GNU Affero General Public License
*  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { Component, ElementRef, Inject, Input, Renderer2, SimpleChanges, type OnChanges, ChangeDetectorRef } from '@angular/core'
import { OptionItem } from '../api/pluginType'
import { AppService, ConfigService, PlatformService, ThemesService } from 'tabby-core';
import { isValidStr, sendInput } from 'utils/commonUtils';
import { MyLogger } from 'services/myLogService';
import { DOCUMENT } from '@angular/common';

@Component({
    template: require('./autoCompleteHintMenu.pug'),
    styles: [require('./autoCompleteHintMenu.scss')],
})
export class AutoCompleteHintMenuComponent {
    mainText: string = "Hello, world! This is the tabby-auto-complete plugin speaking~";
    options: OptionItem[] = [];
    currentItemIndex: number = -1;
    recentTargetElement: HTMLElement;
    showingFlag: boolean = false;
    contentGroups: {[key: string]: OptionItem[]} = {};
    themeMode: string = "dark";
    themeName: string = "NotSet";
    constructor(
        private renderer: Renderer2,
        private elRef: ElementRef,
        private app: AppService,
        private logger: MyLogger,
        @Inject(DOCUMENT) private document: Document,
        private configService: ConfigService,
        private themeService: ThemesService,
        private platformService: PlatformService,
    ) {
        this.currentItemIndex = -1;
        this.contentGroups = {
            "q": [],// quick cmd
            "h": [],// highlight
            "a": [],// ai
        };
        this.themeChanged();
        this.themeService.themeChanged$.subscribe(()=>{
            this.themeChanged();
        })
    }

    themeChanged() {
        this.themeMode = this.configService.store.appearance.colorSchemeMode;
        let theme: 'dark'|'light' = 'dark'
        if (this.configService.store.appearance.colorSchemeMode === 'light') {
            theme = 'light'
        } else if (this.configService.store.appearance.colorSchemeMode === 'auto') {
            //@ts-ignore
            theme = this.platformService?.getTheme() ?? 'dark';
        }
        this.themeMode = theme;

        if (theme === 'light') {
            this.themeName = this.configService.store.terminal.lightColorScheme.name
        } else {
            this.themeName =  this.configService.store.terminal.colorScheme.name
        }
    }

    private doRegetItems() {
        // 记录当前的option
        const currentOption = this.getCurrentItem();

        // 按照 contentGroups中的key顺序，遍历，将结果加入到options中
        this.options = [];
        // 限制个数
        let totalItemCount = 0;
        for (let key in this.contentGroups) {
            totalItemCount += this.contentGroups[key].length;
        }
        // 计算每组的最大显示数
        const maxTotal = this.configService.store.ogAutoCompletePlugin.menuShowItemMaxCount;
        const groupKeys = Object.keys(this.contentGroups);
        const groupCount = groupKeys.length;
        // 统计每组实际数量
        const groupActualCounts = groupKeys.map(key => this.contentGroups[key].length);
        // 先分配平均值
        let perGroupMax = Math.floor(maxTotal / groupCount);
        // 计算每组实际可分配的数量
        let groupShowCounts = groupActualCounts.map(count => Math.min(count, perGroupMax));
        // 计算剩余可分配数量
        let used = groupShowCounts.reduce((a, b) => a + b, 0);
        let left = maxTotal - used;
        // 按顺序分配剩余数量给还有剩余的组
        while (left > 0) {
            let distributed = false;
            for (let i = 0; i < groupCount && left > 0; i++) {
                if (groupActualCounts[i] > groupShowCounts[i]) {
                    groupShowCounts[i]++;
                    left--;
                    distributed = true;
                }
            }
            if (!distributed) break; // 没有可分配的了
        }
        // 合并结果
        for (let i = 0; i < groupCount; i++) {
            this.options = this.options.concat(this.contentGroups[groupKeys[i]].slice(0, groupShowCounts[i]));
        }
        if (this.options.length == 0) {
            this.hideAutocompleteList();
            return;
        } else {
            this.showAutocompleteList(this.document.querySelector('.content-tab-active.active .focused .xterm-helper-textarea'));
        }
        // 调整后，仍然选择之前的option
        if (currentOption) {
            const newIndex = this.options.findIndex(option => option.content === currentOption.content && option.type === currentOption.type);
            this.currentItemIndex = newIndex !== -1 ? newIndex : -1;
        } else {
            this.currentItemIndex = -1;
        }
    }


    public setContent(newVal: OptionItem[], type: string) {
        this.contentGroups[type] = newVal;
        this.doRegetItems();
        // this.options = newVal;
        // this.currentItemIndex = -1;
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
        this.showingFlag = false;
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
        if (this.showingFlag) {
            this.logger.debug("已经显示，不再多次处理");
            setTimeout(this.adjustPosition.bind(this), 0);
            return;
        }
        const listEl = this.elRef.nativeElement.children[0];
        this.recentTargetElement = targetElement;
        // make sure adjustPosition is called after the list is shown
        setTimeout(this.adjustPosition.bind(this), 0);
        // 显示自动完成列表
        this.renderer.setStyle(listEl, 'opacity', '1');
        this.renderer.setStyle(listEl, 'pointer-events', 'auto');
        this.showingFlag = true;
    }

    adjustPosition() {
        const listEl = this.elRef.nativeElement.children[0];
        const targetRect = this.recentTargetElement.getBoundingClientRect();
        // 获取窗口的高度
        const viewportHeight = window.document.querySelector("ssh-tab .terminal.xterm")?.clientHeight || window.innerHeight;
        const viewportWidth = window.document.querySelector("ssh-tab .terminal.xterm")?.clientWidth || window.innerWidth;

        // 下方位置和上方位置
        const belowPosition = targetRect.bottom;
        const abovePosition = targetRect.top - listEl.offsetHeight;
        this.logger.debug("height(liOffset, belowPosition, viewport)", listEl.clientHeight, belowPosition, viewportHeight);
        this.logger.debug("width(liOffset, rightPositionLeft, viewport)", listEl.clientWidth, viewportWidth - targetRect.left, viewportWidth, targetRect)

        // 决定显示在下方还是上方
        let topPosition: number;
        let leftPosition: number;
        const fontSize: number = this.configService.store.terminal.fontSize;
        if (belowPosition + listEl.offsetHeight + fontSize <= viewportHeight) {
            // 下方有足够空间
            topPosition = belowPosition;
            this.logger.debug("Down")
        } else {
            // 上方有足够空间
            topPosition = abovePosition;
        }
        // 需要判定左右空间
        if (targetRect.left - listEl.offsetWidth >= 0 && targetRect.left + listEl.offsetWidth > viewportWidth) {
            leftPosition = targetRect.left - listEl.offsetWidth;
        } else {
            leftPosition = targetRect.left;
        }
        // 设置max-height:

        // 设置位置样式
        this.renderer.setStyle(listEl, 'top', `${topPosition}px`);
        this.renderer.setStyle(listEl, 'left', `${leftPosition}px`);
        // this.renderer.setStyle(listEl, 'width', `${targetRect.width}px`);
    }

    // 隐藏自动完成列表
    public hideAutocompleteList() {
        this.clearContent();
        const listEl = this.elRef.nativeElement.children[0];
        if (listEl) {
            this.renderer.setStyle(listEl, 'opacity', '0');
            this.renderer.setStyle(listEl, 'pointer-events', 'no');
        }
        this.showingFlag = false;
    }

    public getShowingStatus() {
        return this.showingFlag;
    }

    selectUp() {
        if (!this.showingFlag) {
            this.logger.log("不再显示")
            return null;
        }
        if (this.currentItemIndex >= 0) {
            this.currentItemIndex--;
            setTimeout(this.scrollIntoVisible.bind(this), 0);
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
            setTimeout(this.scrollIntoVisible.bind(this), 0);
            // setTimeout(this.adjustPosition.bind(this), 0);
        } else {
            return this.currentItemIndex;
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
                this.setContent(newOptionList, this.options[index].type);
                return;
            }
        }
        sendInput({
            tab: this.app.activeTab,
            cmd: this.options[index].content,
            appendCR: type == 1 && !this.options[index].doNotEnterExec,
            singleLine: false,
            clearFirst: this.options[index].clearThenInput === undefined ? true : this.options[index].clearThenInput,
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
    scrollIntoVisible() {
        // const outerContainer = categoriesContainer.value;
        // let container = this.elRef.nativeElement.querySelector(".og-autocomplete-item-list");
        let container = null;
        // danger: 这和DOM结构密切相关；由于缓存和更新延迟，不能直接使用querySelector定位
        const selectedElement = this.elRef.nativeElement.querySelector(".og-tac-selected");
        if (selectedElement) {
            container = selectedElement.closest('.og-autocomplete-item-list');
            const containerRect = container.getBoundingClientRect();
            const elementRect = selectedElement.getBoundingClientRect();
            if (elementRect.top < containerRect.top) {
                container.scrollTop -= (containerRect.top - elementRect.top) + elementRect.height;
            } else if (elementRect.bottom > containerRect.bottom) {
                container.scrollTop += (elementRect.bottom - containerRect.bottom) + elementRect.height;
            }
        }
    }
}
