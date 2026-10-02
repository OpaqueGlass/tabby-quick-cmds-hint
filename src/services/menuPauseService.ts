import { Injectable } from '@angular/core';

/**
 * 请求临时暂停菜单隐藏
 *
 * 背景：AI 的「发送前确认」弹窗打开后，将导致终端失焦，
 * 而 terminalDecorator 会在 focusout 后（debugLevel > 1 时）调用 hideMenu()。
 * 菜单一旦被隐藏，弹窗关闭后即使AI结果已经到达，也无法正确显示
 *
 * 此处用于记录其他组件要求暂停菜单隐藏行为
 */
@Injectable({ providedIn: 'root' })
export class MenuHidePauseService {
    private pausedCount: number = 0;

    pause() {
        this.pausedCount++;
    }

    resume() {
        this.pausedCount = Math.max(0, this.pausedCount - 1);
    }

    isPaused(): boolean {
        return this.pausedCount > 0;
    }
}
