import { Component } from '@angular/core'
import { OptionItem } from '../api/pluginType'

@Component({
    template: require('./autoCompleteHintMenu.pug'),
})
export class AutoCompleteHintMenuComponent {
    showStatus: boolean = false;
    options: OptionItem[] = [];
    currentItemIndex: number = -1;
    constructor (
    ) {
        console.log("hint menu", document);
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


}
