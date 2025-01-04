import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { ConfigService } from "tabby-core";

@Injectable({providedIn: 'root'})
export class StyleService {
    constructor(
        @Inject(DOCUMENT) private document: Document,
        private configService: ConfigService
    ) {
        const styleElem = this.document.createElement('style');
        styleElem.setAttribute("id", "og-tac-style")
        styleElem.textContent = `
    app-root>.content .tab-bar .btn-tab-bar svg.og-tac-tool-btn {
        fill: none;
    }
        `;
        this.document.head.appendChild(styleElem);
    }
}