# tabby-quick-cmds-hint
**中文** | [English](README.md)

这是用于[Tabby](https://github.com/Eugeny/tabby)的简单命令补全提示插件。

## 特点

- 读取匹配在 `tabby-quick-cmds` 插件中保存命令
- 使用 AI 补全命令（仅在快捷键触发时可用）
- 匹配提示命令参数（先完整输入命令名称，再空格输入匹配内容）（匹配内容由AI生成，请注意检验）
- 读取匹配历史记录

## 快速开始

> [!NOTE]
> 
> - 插件仍在开发中。
> - 插件仅针对 “ssh连接运行Ubuntu、Shell为bash的服务器” 进行测试和开发，其他情况可能存在问题。阅读[docs/INIT_zh-CN.md](./docs/INIT_zh-CN.md)了解更多信息。
> - 在控制台输出的日志比较乱。

1. 
   - 对于 `bash` 用户：  
      - 基本功能：在 `~/.bashrc` 中添加以下脚本
         ```bash
         export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
         ```
2. 下载并启用 `tabby-quick-cmds` 插件，本插件主要检索 `tabby-quick-cmds` 中保存的命令。添加一些命令。
3. 开启令人烦躁的提示体验。

> 如果这对你有帮助，请考虑Star本项目。



## 参考与鸣谢

> 一些 *开发者* 或 *插件直接使用的包* 未在此列出，请参考贡献者列表或 `package.json` 文件。

- [tabby-clippy](https://github.com/Eugeny/tabby-clippy) Tabby 的示例插件
- [minyoad/terminus-quick-cmds](https://github.com/minyoad/terminus-quick-cmds) / [Domain/terminus-quick-cmds](https://github.com/Domain/terminus-quick-cmds)
- [lucide-icon](https://lucide.dev/) svg图标