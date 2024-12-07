import { ConfigService } from 'tabby-core';
import { BaseTerminalProfile, BaseTerminalTabComponent } from 'tabby-terminal';

interface EnvBasicInfo {
    config: ConfigService; // tabby提供的设置服务
    document: Document; // window.document
    tab: BaseTerminalTabComponent<BaseTerminalProfile>; // tabby提供的tab组件
    sessionId: string; // 插件自行赋予的id，用于区分不同的会话，重新到相同主机连接时会变化
}

interface TerminalSessionInfo {
    config: ConfigService;
    tab: BaseTerminalTabComponent<BaseTerminalProfile>;
    sessionId: string;
}
export interface OptionItem {
    name: string; // 显示在候选区中的名称
    content: string; // 实际上屏内容
    type: string; // 类型，请仅一个字母或符号表示
    desp: string; // 描述，这将显示在所有候选项的下方
    callback?: () => OptionItem[] | null; // 回调函数，用于生成下一级候选项，返回null则认为Provider自行实现了下一级，或其他插入方式
    color?: string; // 颜色，为了用户自定义可能会移除
}