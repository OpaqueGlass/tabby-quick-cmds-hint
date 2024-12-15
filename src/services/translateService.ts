import { Injectable } from "@angular/core";
import { TranslateService } from "tabby-core";
import yaml from 'js-yaml';
import yamlFileContent from '../static/i18n.yaml';

@Injectable({providedIn: 'root'})
export class AutoCompleteTranslateService {
    constructor(
        private translate: TranslateService,
    ) {
        this.initMyTranslate();
    }
    initMyTranslate() {
        const data = yaml.load(yamlFileContent);
        // 遍历所有数组元素，提取 zh_CN 等值作为单独的列表
        const availableLanguages = Object.keys(data[Object.keys(data)[0]]).filter(lang => lang !== 'en_US');
        for (let langKey of availableLanguages) {
            // 遍历data，提取en_US作为key, 提取  langKey作为Value
            let result = {};
            for (let item of data) {
                result[item["en_US"]] = item[langKey];
            }
            console.warn("set Trans", langKey, result)
            this.translate.setTranslation(langKey.replace("_", "-"), result, true);
        }
    }
    test() {

    }
}