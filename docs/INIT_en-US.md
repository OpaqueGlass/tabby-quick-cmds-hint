# Initial Usage Guide and Explanation of Plugin Implementation

> Last updated: During v1.1.0 release.

## Explanation of Plugin Implementation

### 1. Determining Command Input Start

When `Use regular expression to match shell prompt` is enabled, the plugin determines where the command starts by matching the leading prompt rules of Ubuntu bash commands.

When regex matching is not enabled, or when the user modifies the shell profile and introduces the OSC 1337 `CurrentDir` sequence, the plugin determines the command start position through that sequence.

Therefore, the OSC 1337 `CurrentDir` related prompt must **appear at the end of the command input prompt**. Otherwise, the plugin will mistakenly recognize the prompt as part of the command.

> What is a prompt?
> 
> In a terminal, the prompt is the indicator that asks the user to enter a command.
> 
> In bash, the default prompt is `$ `, that is, `$`. But in this plugin, we treat `root@ubuntu:~$` as prompt.
> ```bash
> root@ubuntu:~$
> ```


> Starting from tabby v1.0.231, plugin versions below v1.1.0 stop working; upgrading this plugin to v1.1.0 mitigates this issue.
>  `tabby-terminal/src/middleware/oscProcessing.ts`
>
> Upgrading this plugin to v1.1.0 can mitigate this issue.
>
> Related issues
> https://github.com/Eugeny/tabby/issues/11144
> https://github.com/Eugeny/tabby/issues/11283

### 2. Recording Historical Commands

> We removed this prerequisite.
> 
> Because the commands obtained this way will be the actual executed ones, they may contain unnecessary information (such as `[[ ]]` judgments, alias).

~The plugin records executed commands based on the shell's return of the command via `]2323;Command=$(cmd)\x07` after execution. This uses a custom escape sequence with no external references. If this conflicts with other existing implementations, please provide feedback.~ 


## Configuration References for Non-bash Shells

> Theoretically, as long as a shell satisfies the rules described in the "Explanation of Plugin Implementation" section, it can be recognized, but there may be differences between shells.
> 
> If you encounter issues with bash, please report a bug. If you encounter issues with other shells, please consider submitting a pull request (PR).

#### bash

Refer directly to [tabby/wiki/Shell-working-directory-reporting#bash](https://github.com/Eugeny/tabby/wiki/Shell-working-directory-reporting#bash).

Basic functionality:

```bash
export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
```

> Command history recording:
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

You need to modify the default `fish_prompt` function.

You can find the original function code at `/usr/share/fish/functions/fish_prompt.fish @ line 4` (or by running `type fish_prompt` in the Fish shell).

Add the following `echo` statement at the end of the function:

```fish
echo -en "\e]1337;CurrentDir=$PWD\x7"
```

#### powershell

Open your profile:
```powershell
notepad $PROFILE
```

Add the following to the profile:
```powershell
function prompt {
    $loc = $executionContext.SessionState.Path.CurrentLocation
    $esc = [char]27   # ESC, do not use "`e" (not supported in PS 5.1)
    $bel = [char]7    # BEL, sequence terminator
    # Non-filesystem drives (e.g. Registry::) have no real path, fall back here
    $dir = if ($loc.Provider.Name -eq 'FileSystem') { $loc.ProviderPath } else { $loc.Path }
    # The visible prompt comes first, the OSC sequence must be placed last
    "PS $loc$('>' * ($nestedPromptLevel + 1)) " + "$esc]1337;CurrentDir=$dir$bel"
}
```

#### Using Regular Expression Matching

You can define a custom regular expression to match the prompt (in the Debug section of the plugin settings page; you also need to enable the "Use regular expression to match shell prompt" option). Note that the regular expression must fully match both the leading content and the prompt, and the remaining content should be the command entered by the user.

> ```bash
> root@ubuntu:~$
> ```
>
> Your custom regular expression should be able to match the entire `root@ubuntu:~$` string.

As a reference, the default regular expression used can be found in the `loadRegExp` function implementation in `SimpleManager.ts`.
