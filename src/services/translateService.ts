import { Injectable } from "@angular/core";
import { TranslateService } from "tabby-core";
import yaml from 'js-yaml';
import yamlFileContent from '../static/i18n.yaml';

@Injectable({ providedIn: 'root' })
export class AutoCompleteTranslateService {
    constructor(
        private translate: TranslateService,
    ) {
    }
    initMyTranslate() {
        const supportedLangs = this.translate.getLangs().length > 0 
                               ? this.translate.getLangs() 
                               : ['en', 'zh-CN', 'ja-JP'];

        const data = yaml.load(yamlFileContent);

        const transform = (obj) => {
            const result = {};

            const recurse = (current, path) => {
                if (typeof current === "object" && !Array.isArray(current)) {
                    const keys = Object.keys(current);
                    const allStrings = keys.every(k => typeof current[k] === "string");

                    if (allStrings) {
                        // 找到英文原文作为兜底内容 (优先 en_US, 其次 en, 实在没有取第一个)
                        const fallbackContent = current['en_US'] || current['en'] || current[keys[0]];

                        // 遍历所有支持的语言，确保每个语言都有值
                        supportedLangs.forEach(lang => {
                            // 转换 key 格式以匹配 YAML 中的下划线风格 (如 en-US -> en_US)
                            const yamlLangKey = lang.replace("-", "_");
                            const content = current[yamlLangKey] || fallbackContent;

                            if (!result[lang]) result[lang] = {};
                            setByPath(result[lang], path, content);
                        });
                    } else {
                        keys.forEach(k => recurse(current[k], path.concat(k)));
                    }
                }
            }

            const setByPath = (obj, path, value) => {
                let cur = obj;
                for (let i = 0; i < path.length - 1; i++) {
                    if (!cur[path[i]]) cur[path[i]] = {};
                    cur = cur[path[i]];
                }
                cur[path[path.length - 1]] = value;
            }

            recurse(obj, []);
            return result;
        }

        const result = transform(data);

        // 2. 注入翻译数据
        Object.keys(result).forEach(lang => {
            // 注入原始语言
            this.translate.setTranslation(lang, result[lang], true);
            
            // 特殊处理：如果注入的是 en-US，额外同步给 en-UK (保留您原有的逻辑)
            if (lang === "en-US" || lang === "en_US") {
                this.translate.setTranslation("en-UK", result[lang], true);
            }
        });
    }
    test() {

    }
}