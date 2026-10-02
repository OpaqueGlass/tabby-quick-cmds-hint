import { Injectable } from '@angular/core';
import { BaseTerminalProfile, BaseTerminalTabComponent } from 'tabby-terminal';
import type { SimpleManager } from 'services/manager/simpleContentManager';

/**
 * 终端内容上下文：按 tab 登记 SimpleManager
 */
@Injectable({ providedIn: 'root' })
export class TerminalContextService {
    private managers = new Map<BaseTerminalTabComponent<BaseTerminalProfile>, SimpleManager>();

    register(tab: BaseTerminalTabComponent<BaseTerminalProfile>, manager: SimpleManager) {
        if (!tab || !manager) {
            return;
        }
        this.managers.set(tab, manager);
    }

    /**
     * tab 销毁时必须注销，否则 Map 会一直持有 tab 与 manager 的引用。
     */
    unregister(tab: BaseTerminalTabComponent<BaseTerminalProfile>) {
        if (tab) {
            this.managers.delete(tab);
        }
    }

    /**
     * 该 tab 是否有对应的采集器。没有则无法取到终端输出（例如当前页不是终端页）。
     */
    hasManager(tab: any): boolean {
        return !!tab && this.managers.has(tab);
    }

    /**
     * shell 集成（OSC 1337）采集到的当前工作目录，取不到返回空串。
     */
    getCwd(tab: any): string {
        return this.managers.get(tab)?.cwd ?? '';
    }

    /**
     * 抓取当前终端屏幕的最后一段文本（已清理转义符并截断）。
     * 任何异常都降级为空串，调用方无需 try-catch。
     */
    async captureRecentOutput(tab: any): Promise<string> {
        const manager = this.managers.get(tab);
        if (!manager) {
            return '';
        }
        try {
            const state = await manager.getLastStateLine();
            return state?.full ?? '';
        } catch (err) {
            return '';
        }
    }
}
