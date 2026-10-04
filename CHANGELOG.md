## 更新日志

### v1.1.0 (2026-10-04)

- 新增：在候选菜单中显示AI提示入口；
  - 支持自动/手动触发模式；
  - 支持携带上下文；
  - 支持手动为不同连接配置（Profile）关联类型和提示词；
- 改进：调整快捷键调起的ai提示入口，支持附带上下文；
- 适配：适配tabby v1.0.231及以上版本（v1.0.237）；
 
  - 在这些版本，由于`tab.$output`流不提供 OSC 转义序列，插件无法识别命令开始位置；
- 细节调整/开发者：
  - 插件匹配的 cmd 包含 prompt与命令分隔空格，前导空格不意味着用户输入的命令开头包含空格；
  - 插件匹配的 cmd 将以光标前的内容为基准，不再包含光标后的内容，以适配 fish, pwsh 等自动补全提示的场景；

> 两处相思同淋雪，此生也算共白头。
> 
> *（网络，来源未知）*

---

- Added: AI prompt entry in the candidate menu;
  - Support automatic/manual trigger mode;
  - Support with context;
  - Support manually configuring prompt words for different connections (Profiles);
- Improved: Adjusted the shortcut key to invoke the AI prompt entry, with context;
- Adapted: Adapted to tabby v1.0.231 and above;
  - In these versions, since `tab.$output` stream does not provide OSC escape sequences, the plugin cannot recognize the command start position;
- Details adjustment/developer:
  - The plugin matches the cmd that contains the prompt and command separator space, leading space does not mean that the command start with space;
  - The plugin matches the cmd will be based on the content before the cursor, no longer contains the content after the cursor, to adapt to the scenario of automatic completion prompt in fish, pwsh, etc.;

### v1.0.3 (2026-01-27)

- **修复**：非英文、中文语言下文本显示错误的问题；

---

- **Fixed**: The issue of incorrect text display in non-English and non-Chinese languages;

### v1.0.2 (2026-01-17)

- 修复：语言名称定义的较为宽泛，易和其他插件冲突的问题；

---

- Fixed: The issue that the language name definition is too broad and prone to conflicts with other plugins.

### v1.0.1 (2026-01-16)

- 修复：和其他创建Tab页插件冲突的问题；

---

- Fixed: Resolved conflicts with other tab - creating plugins.

### v1.0.0 (2025-08-24)

- 新增：为命令参数进行补全提示；
- 改进：ContentProvider API现在提供光标位置；
- 改进：单一匹配项过长时，超长部分强制隐藏；
- 变更：`i18n.yaml`文件结构；

---

- Added: Autocompletion hints for command parameters
- Improved: `ContentProvider` API now provides cursor position
- Improved: When a single match item is too long, the overflow part is forcibly hidden
- Changed: Structure of the `i18n.yaml` file

### v0.1.3 (2025年7月23日)

- 修复：由于插件Bug导致长时间运行后性能下降的问题（插件错误频繁创建临时div元素、且未删除）；

### v0.1.2 (2025年3月2日)

- 改进：命令保存的筛选过滤；排除 cd, 等
- 改进：命令保存尽量仍然使用上屏的内容，如果可以，不再使用回传；
- 改进：立即提示；（获取当前命令内容，立刻触发提示或刷新提示）
- 修复：`getLastStateLine()` （和有时出现的“抓不到最后一行命令”的错误，似乎是一同出现的。）
- 改进：提示数量限制：history provider提供5个，在有其他提示存在时，限制出现的提示总数为7，history至少2；

### v0.1.1 (2025年1月6日)

- 修复：提示菜单显示位置异常靠左；
- 修复：有覆盖浮窗时，仍接管上下方向键的问题；
- 改进：一些样式调整；