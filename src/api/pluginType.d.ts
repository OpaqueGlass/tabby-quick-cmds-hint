import { ConfigService } from 'tabby-core';
import { BaseTerminalProfile, BaseTerminalTabComponent } from 'tabby-terminal';

interface EnvBasicInfo {
    config: ConfigService; // tabby提供的设置服务
    document: Document; // window.document
    tab: BaseTerminalTabComponent<BaseTerminalProfile>; // tabby提供的tab组件
    sessionId: string; // 插件自行赋予的id，用于区分不同的会话，重新到相同主机连接时会变化
    cwd?: string; // 当前工作目录，由终端 OSC 1337 采集，取不到时不传或为空串
    recentOutput?: string; // 最近的终端输出，仅在用户显式开启时采集并传入
}

interface TerminalSessionInfo {
    config: ConfigService;
    tab: BaseTerminalTabComponent<BaseTerminalProfile>;
    sessionId: string;
    matchedByRegExp: boolean;
}
export interface OptionItem {
    name: string; // 显示在候选区中的名称
    content: string; // 实际上屏内容
    type: string; // 类型，请仅一个字母或符号表示
    desp: string; // 描述，这将显示在所有候选项的下方
    /**
     * 回调函数，用于生成下一级候选项。
     * - 返回数组：作为下一级候选列表
     * - 返回 null：Provider 自行实现了下一级，或其他插入方式
     * - 返回 Promise：菜单会先渲染 loading 占位项，resolve 后再替换为真实列表
     */
    callback?: () => OptionItem[] | null | Promise<OptionItem[] | null>;
    clearThenInput?: boolean; // 先清空整行、再进行上屏？默认为true
    doNotEnterExec?: boolean; // 请勿回车上屏并执行，默认为false，此项为true则会在
    backgroundColor?: string; // 颜色，为了用户自定义可能会移除
    color?: string; // 颜色
    loading?: boolean; // 加载中占位项：灰显不可选，方向键与回车均会跳过
    dangerRating?: number; // AI 建议的危险等级 0-5，用于着色（<=2 安全 / 3-4 警告 / 5 危险）
}