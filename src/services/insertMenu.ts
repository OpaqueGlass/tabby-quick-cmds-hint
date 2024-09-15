import {
    ApplicationRef,
    Injector,
    EmbeddedViewRef,
    Inject,
    Injectable,
    ComponentFactoryResolver
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AutoCompleteHintMenuComponent } from '../components/autoCompleteHintMenu';

@Injectable({
providedIn: 'root'
})
export class AddMenuService {
    constructor(
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        @Inject(DOCUMENT) private document: Document
    ) {}

    // 插入组件的方法
    public insertComponent() {
        console.log("插入组件");
        // 获取目标 DOM 元素
        const target = this.document.querySelector('app-root');
        
        if (target) {
            const componentFactory = this.componentFactoryResolver.resolveComponentFactory(AutoCompleteHintMenuComponent);
            const componentRef = componentFactory.create(this.injector);
            // 将组件加入 Angular 的变更检测
            this.appRef.attachView(componentRef.hostView);

            // 获取组件的 DOM 元素
            const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;

            // 使用 Renderer2 安全地插入元素
            target.appendChild(domElem);
        }
    }

    public setMenuContent() {
        console.log("设置内容");
    }
}
  