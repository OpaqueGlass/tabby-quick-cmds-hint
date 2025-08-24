import { OptionItem, EnvBasicInfo } from "../../api/pluginType";
import Fuse from 'fuse.js';
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";
import { MyLogger } from "services/myLogService";
import { Injectable } from "@angular/core";
import { ConfigService, TranslateService } from "tabby-core";
import { isValidStr } from "utils/commonUtils";
import * as yaml from 'js-yaml';
import yamlFileContent from '../../static/autoComplete.yaml';

/**
 * 命令参数自动补全提供器
 * 
 * 字段说明：
 * - name: 显示名称，支持占位符（如 <files>），会在 UI 中显示给用户
 * - content: 实际输入内容，用户选择该项后实际输入到终端的内容
 * - despLangKey: 可选，描述的翻译键，格式为 i18n.yaml 中的路径
 * 
 * 示例：
 * - name: "add <files>"        // 显示：add <files>
 *   content: "add"             // 输入：add（不包含占位符）
 *   despLangKey: "arguments_complete.git.add"  // 翻译：将文件添加到暂存区
 * 
 * 如果不提供 despLangKey，将使用 name 作为描述显示
 */

interface CommandExample {
    text: string;
    desc: string;
}

/**
 * 命令参数配置接口
 */
interface CommandArgument {
    /** 显示名称，支持占位符如 <files>，在UI中显示给用户 */
    name: string;
    /** 实际输入内容，用户选择后输入到终端的内容 */
    content: string;
    /** 可选，描述的翻译键，如 "arguments_complete.git.add" */
    despLangKey?: string;
}

/**
 * 命令配置接口
 */
interface CommandConfig {
    /** 命令名称，如 "git", "docker" */
    command: string;
    /** 参数列表 */
    arguments: CommandArgument[];
}

interface AutoCompleteConfig {
    commands: CommandConfig[];
}


@Injectable({
    providedIn: 'root'
})
export class ArgumentsContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = "a";
    private yamlConfig: AutoCompleteConfig | null = null;
    private fuseOptions = {
        keys: ['name', 'content', 'desp'],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true
    };

    constructor(
        protected logger: MyLogger,
        protected configService: ConfigService,
        protected translateService: TranslateService,
    ) {
        super(logger, configService);
        this.loadYamlConfig();
    }

    /**
     * 加载YAML配置文件
     */
    private loadYamlConfig(): void {
        try {
            this.yamlConfig = yaml.load(yamlFileContent) as AutoCompleteConfig;
            this.logger.log("YAML配置加载成功", this.yamlConfig);
        } catch (error) {
            this.logger.log("YAML配置加载失败", error);
            this.yamlConfig = null;
        }
    }

    /**
     * 根据命令名称查找对应的参数配置
     */
    private findCommandConfig(commandName: string): CommandConfig | null {
        if (!this.yamlConfig || !this.yamlConfig.commands) {
            return null;
        }
        return this.yamlConfig.commands.find(cmd => cmd.command === commandName) || null;
    }

    /**
     * 将命令参数转换为OptionItem数组
     */
    private convertArgumentsToOptionItems(commandConfig: CommandConfig, inputCmd: string): OptionItem[] {
        const result: OptionItem[] = [];
        
        if (!commandConfig.arguments) {
            return result;
        }

        // 遍历所有参数
        commandConfig.arguments.forEach(arg => {
            let description = arg.name; // 默认使用 name 作为描述
            
            // 如果提供了翻译键，尝试获取翻译
            if (arg.despLangKey) {
                const translatedDesc = this.translateService.instant(arg.despLangKey);
                // 如果翻译成功（返回值不等于翻译键本身），使用翻译结果
                if (translatedDesc !== arg.despLangKey) {
                    description = translatedDesc;
                }
            }
            
            // 创建参数选项
            const optionItem: OptionItem = {
                name: arg.name,           // 显示名称，包含占位符提示
                content: arg.content,     // 实际输入内容
                desp: description,        // 描述：翻译结果或回退到 name
                type: ArgumentsContentProvider.providerTypeKey,
                doNotEnterExec: true,
                clearThenInput: false,
            };
            result.push(optionItem);
        });

        return result;
    }
    
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        if (!envBasicInfo.config.store.ogAutoCompletePlugin.arguments.enable) {
            return null;
        }

        const result: OptionItem[] = [];
        
        // 清理并解析输入命令
        const cleanCmd = inputCmd.replace(new RegExp("\\s+", "g"), " ").trim();
        const cmdParts = cleanCmd.split(" ");
        const mainExecCmd = cmdParts[0];

        if (!isValidStr(mainExecCmd)) {
            return null;
        }

        this.logger.log("处理命令参数补全", { inputCmd, mainExecCmd, cmdParts });

        // 从YAML配置中查找对应的命令
        const commandConfig = this.findCommandConfig(mainExecCmd);
        
        if (commandConfig) {
            // 获取YAML配置中的参数建议
            const yamlBasedOptions = this.convertArgumentsToOptionItems(commandConfig, inputCmd);
            result.push(...yamlBasedOptions);
            
            this.logger.log(`找到${mainExecCmd}命令的${yamlBasedOptions.length}个参数建议`);
        }
        // 如果有结果，使用Fuse.js进行二次过滤和排序
        if (result.length > 0) {
            const currentInput = cmdParts.slice(1).join(" "); // 除了主命令之外的部分
            if (currentInput) {
                const fuse = new Fuse(result, this.fuseOptions);
                const filteredResults = fuse.search(currentInput);
                return {
                    optionItem: filteredResults.map(item => item.item),
                    envBasicInfo: envBasicInfo,
                    type: ArgumentsContentProvider.providerTypeKey
                };
            }
        }

        this.logger.log(`最终返回${result.length}个参数建议`);

        return {
            optionItem: result,
            envBasicInfo: envBasicInfo,
            type: ArgumentsContentProvider.providerTypeKey
        };
    }
}