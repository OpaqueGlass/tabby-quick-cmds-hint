# tabby-quick-cmds-hint
**中文** | [English](README.md)

这是用于[Tabby](https://github.com/Eugeny/tabby)的简单命令补全提示插件。

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
         
         ```
      - 历史记录：在 `~/.bashrc` 中添加以下脚本
         ```bash

         ```
2. 下载并启用 `tabby-quick-cmds` 插件。添加一些命令。
3. 开启令人烦躁的提示体验。

## TODO (待办事项)

- [x] 在 `tabby-quick-cmds` 中保存命令
- [x] 使用 AI 补全命令（仅在快捷键触发时可用）
- [ ] 支持命令参数
- [x] 历史记录
- [x] 多语言支持

## 参考与鸣谢

> 一些 *开发者* 或 *插件直接使用的包* 未在此列出，请参考贡献者列表或 `package.json` 文件。

- [tabby-clippy](https://github.com/Eugeny/tabby-clippy) Tabby 的示例插件
- [minyoad/terminus-quick-cmds](https://github.com/minyoad/terminus-quick-cmds) / [Domain/terminus-quick-cmds](https://github.com/Domain/terminus-quick-cmds)
- [lucide-icon](https://lucide.dev/) svg图标