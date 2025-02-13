# 初次使用说明和插件实现方式的解释

> 最后更新于：v0.1.2 更新时。

## 插件实现方式说明

### 1. 命令开始输入判断

插件通过正则匹配原始输出中的`CurrentDir.*\a`确认命令输入prompt的结束位置，清理其中的转义符
，并由此判断prompt的结束和命令的开始。

因此，`CurrentDir`相关的提示必须在命令输入提示prompt的末尾出现。否则插件将会把prompt错误
识别为命令的一部分。


### 2. 历史命令记录

> 我正在尝试移除这个前置条件。
> 
> 因为这样获得的命令将是实际执行的，可能包含不需要的信息（如`[[]]`判断、alias）。

插件基于执行命令后，shell通过`]2323;Command=$(cmd)\x07`返回执行的命令记录。这里是自定义
的转义序列，没有参考来源。如果和其他已有实现冲突，请反馈。


## 针对一些shell的配置参考

> 开发者仅针对 Ubuntu下bash 进行开发与测试，不保证在其他shell中的可用性。
>
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