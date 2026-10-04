import { Observable, Subject } from 'rxjs';
import { SessionMiddleware } from 'tabby-terminal';

/**
 * 原始输出探针。
 *
 * tabby >= 1.0.231 后，`OSCProcessor`（tabby-terminal/src/middleware/oscProcessing.ts）
 * 不再把数据原样透传，而是重建数据流：OSC 1337（`CurrentDir`）与 OSC 52 在解析后
 * 直接被丢弃，只有其余内容才继续下发。
 * 因此 `session.output$` / `tab.output$` 里已经拿不到 `\x1b]1337;CurrentDir=...\x07`，
 * 依赖该序列判断 prompt 结束位置的逻辑会整体失效。
 *
 * 把本中间件 unshift 到 `session.middleware` 栈顶后，可以在 tabby 处理之前
 * 拿到未经剥离的原始数据，同时把数据原样继续往下传，不影响 tabby 自身行为。
 */
export class RawOutputTap extends SessionMiddleware {
    /** 未经 tabby OSC 处理的原始输出（按到达顺序，可能分块） */
    get raw$ (): Observable<Buffer> { return this.raw }

    private raw = new Subject<Buffer>();

    feedFromSession (data: Buffer): void {
        this.raw.next(data);
        // 原样交给后面的中间件（OSCProcessor 等），不改变终端实际收到的数据
        super.feedFromSession(data);
    }

    close (): void {
        this.raw.complete();
        super.close();
    }
}
