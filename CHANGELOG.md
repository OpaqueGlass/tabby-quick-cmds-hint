## 更新日志

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