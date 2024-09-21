import {
    ApplicationRef,
    Injector,
    EmbeddedViewRef,
    Inject,
    Injectable,
    ComponentFactoryResolver,
    ComponentRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AutoCompleteHintMenuComponent } from '../components/autoCompleteHintMenu';
import { ContentProviderService } from './contentProvider';

@Injectable({
providedIn: 'root'
})
export class AddMenuService {
    private componentRef: ComponentRef<AutoCompleteHintMenuComponent>;
    private lastCmd: string;
    constructor(
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        @Inject(DOCUMENT) private document: Document,
        private contentProvider: ContentProviderService,
    ) {}

    // 插入组件的方法
    public insertComponent() {
        console.log("插入组件");
        // 获取目标 DOM 元素
        const target = this.document.querySelector('app-root');
        
        if (target) {
            const componentFactory = this.componentFactoryResolver.resolveComponentFactory(AutoCompleteHintMenuComponent);
            this.componentRef = componentFactory.create(this.injector);
            this.appRef.attachView(this.componentRef.hostView);
            const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
            target.appendChild(domElem);
        }
        // this.document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    }

    public showMenu() {
        this.componentRef.instance.showAutocompleteList(this.document.querySelector('.xterm-helper-textarea'));
    }

    public hideMenu() {
        this.componentRef.instance.hideAutocompleteList();
    }

    public sendCurrentText(text: string) {
        if (this.lastCmd === text) {
            // 和上一个一致，无需处理
            return;
        }
        if (text.length < 3) {
            this.hideMenu();
            return;
        }
        // 获取结果
        this.componentRef.instance.setContent(this.contentProvider.getContentList(text));
        this.componentRef.instance.showAutocompleteList(this.document.querySelector('.content-tab-active.active .focused .xterm-helper-textarea'));
        this.componentRef.instance.test(text);
        this.lastCmd = text;
    }

    private handleKeyDown(event: KeyboardEvent) {
        const key = event.key;
        console.log("handle key down");
        
        

    }


}
  