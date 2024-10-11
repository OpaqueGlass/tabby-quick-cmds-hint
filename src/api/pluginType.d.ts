import { ConfigService } from 'tabby-core';

interface EnvBasicInfo {
    config: ConfigService;
    document: Document;
}

interface ProviderInitInfo {
    config: ConfigService;
}
export interface OptionItem {
    name: string; // 显示在候选区中的名称
    content: string; // 实际上屏内容
    type: string; // 类型，请仅一个字母或符号表示
    desp: string; // 描述，这将显示在所有候选项的下方
    callback?: () => OptionItem[] | null; // 回调函数，用于生成下一级候选项，返回null则认为Provider自行实现了下一级，或其他插入方式
    color?: string; // 颜色，为了用户自定义可能会移除
}