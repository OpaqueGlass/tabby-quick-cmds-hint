# 初次使用说明和插件实现方式的解释

> 最后更新于：v1.1.0 更新时。

## 插件实现方式说明

### 1. 命令开始输入判断

在启用`使用正则表达式匹配shell prompt`时，插件通过匹配 ubuntu bash 命令前导prompt的规则判断命令开始位置。

未启用正则匹配设置项，或用户通过修改shell profile、引入osc 1337 CurrentDir序列时，插件通过检索该序列判断命令开始位置。

因此，osc 1337`CurrentDir`相关的提示必须在**命令输入提示prompt的末尾出现**。否则插件将会把prompt错误
识别为命令的一部分。

> 什么是prompt？
> 
> 在终端中，prompt是提示用户输入命令的提示符。
> 
> 在bash中，prompt默认是`$ `，即`$`。
> ```bash
> root@ubuntu:~$
> ```


> tabby v1.0.231 开始，插件v1.1.0以下版本失效，升级本插件至 v1.1.0 可缓解此问题。
>
> 关联issue或变更
>  `tabby-terminal/src/middleware/oscProcessing.ts`
> https://github.com/Eugeny/tabby/issues/11144
> https://github.com/Eugeny/tabby/issues/11283

### 2. 历史命令记录

> 我们已经移除这个前置条件。
> 
> 因为这样获得的命令将是实际执行的，可能包含不需要的信息（如`[[]]`判断、alias）。

~插件基于执行命令后，shell通过`]2323;Command=$(cmd)\x07`返回执行的命令记录。这里是自定义
的转义序列，没有参考来源。如果和其他已有实现冲突，请反馈。~ 


## 针对非 bash 的配置参考

> 理论上只要shell满足`实现方式说明`中的规则，即可以被识别，但不同shell可能存在差异。
> 
> 如果在bash中出现问题，请反馈bug。如果在其他shell中存在问题，请考虑提交PR。

#### bash

直接参考[tabby/wiki/Shell-working-directory-reporting#bash](https://github.com/Eugeny/tabby/wiki/Shell-working-directory-reporting#bash)即可。

基本功能：

```bash
export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
```

> 命令历史记录：
> 
> ```bash
> function preexec_invoke_exec() {
>     printf "\033]2323;Command=%s\007" "$1"
> }
> 
> trap 'preexec_invoke_exec "$BASH_COMMAND"' DEBUG
>                                                       
> ```

#### fish

需要修改默认的`fish_prompt`函数。

原函数代码可以参考`/usr/share/fish/functions/fish_prompt.fish @ line 4`(或fish终端输入`type fish_prompt`)

需要在函数最后补充echo

```fish
echo -en "\e]1337;CurrentDir=$PWD\x7"
```

#### powershell

打开 profile
```powershell
notepad $PROFILE
```

在profile 中加入
```powershell
function prompt {
    $loc = $executionContext.SessionState.Path.CurrentLocation
    $esc = [char]27   # ESC，不用 "`e"（PS 5.1 不支持）
    $bel = [char]7    # BEL，序列结束符
    # 非文件系统驱动器（如 Registry::）没有真实路径，做一次兜底
    $dir = if ($loc.Provider.Name -eq 'FileSystem') { $loc.ProviderPath } else { $loc.Path }
    # 可见提示符在前，OSC 序列必须放最后
    "PS $loc$('>' * ($nestedPromptLevel + 1)) " + "$esc]1337;CurrentDir=$dir$bel"
}
```

#### 使用正则表达式匹配

你可以自定义正则表达式匹配Prompt（插件设置页-调试 部分，需同时开启 “使用正则表达式匹配shell prompt”选项），但注意，正则表达式必须完整匹配 前导内容和prompt，余下内容应当是用户输入命令。

> ```bash
> root@ubuntu:~$
> ```
>
> 你自定义的正则表达式应当能够匹配 `root@ubuntu:~$` 全部内容。

作为参考，默认使用的正则表达式参见 SimpleManager.ts loadRegExp 函数实现。