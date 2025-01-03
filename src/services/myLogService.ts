import { Injectable } from '@angular/core';
import { ConfigService, Logger, LogService } from 'tabby-core';

@Injectable({
    providedIn: 'root'
})
export class MyLogger {
    private logger: Logger;
    private name: string;
    constructor(
        log: LogService,
        private configService: ConfigService
      ) {
        this.name = 'quick-cmds-hint';
        // tabby的Logger不支持,继续传参，只能类似%d这样的模板字符串，我们这边还是自定义省心点
        this.logLevel = configService.store?.ogAutoCompletePlugin?.debugLevel ?? 3;
        configService.changed$.subscribe(() => {
            this.setLogLevel(configService.store.ogAutoCompletePlugin.debugLevel);
        });
    }

    private logLevel: number = 3;

    setLogLevel(level: number) {
        this.logLevel = level;
    }
    getLogLevel() {
        return this.logLevel;
    }

    messyDebug(...args: any[]) {
        if (this.logLevel <= -1) {
            console.debug(`%c[${this.name}] `, "color: #aaa", ...args);
        }
    }

    debug(...args: any[]) {
        if (this.logLevel <= 0) {
            console.debug(`%c[${this.name}] `, "color: #aaa", ...args);
        }
    }

    log(...args: any[]) {
        if (this.logLevel <= 1) {
            console.info(`%c[${this.name}] `, "color: #aaa", ...args);
        }
    }

    warn(...args: any[]) {
        if (this.logLevel <= 2) {
            console.warn(`%c[${this.name}] `, "color: #aaa", ...args);
        }
    }

    error(...args: any[]) {
        if (this.logLevel <= 3) {
            console.error(`%c[${this.name}] `, "color: #aaa", ...args);
        }
    }
}