import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { ConfigService } from "tabby-core";

@Injectable({providedIn: 'root'})
export class StyleService {
    constructor(
        @Inject(DOCUMENT) private document: Document,
        private configService: ConfigService
    ) {
        this.loadStyle();
    }

    loadStyle() {
        this.removeStyle();
        const styleElem = this.document.createElement('style');
        styleElem.setAttribute("id", "og-tac-style")
        styleElem.textContent = `
app-root>.content .tab-bar .btn-tab-bar svg.og-tac-tool-btn,
app-root>.content .tab-bar .btn-tab-bar svg.og-tac-tool-btn path {
    fill: none;
}
        `;
        this.document.head.appendChild(styleElem);
    }
    removeStyle() {
        this.document.getElementById("og-tac-style")?.remove();
    }
}