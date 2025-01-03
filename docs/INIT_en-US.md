# Initial Usage Guide and Explanation of Plugin Implementation

> Last updated: During v0.1.0 release.

## Explanation of Plugin Implementation

### 1. Determining Command Input Start

The plugin uses a regular expression to match `CurrentDir.*\a` in the raw output to identify the end of the command input prompt. It cleans up any escape characters in this section, thus determining the prompt's end and the command's start.

As a result, the `CurrentDir`-related prompt must appear at the end of the command input prompt. Otherwise, the plugin will not function correctly.

### 2. Recording Historical Commands (Executed Commands)

The plugin records executed commands based on the shell's return of the command via `]2323;Command=$(cmd)\x07` after execution. This uses a custom escape sequence with no external references. If this conflicts with other existing implementations, please provide feedback.

## Configuration References for Specific Shells

> The developer has only tested and developed this plugin on Bash under Ubuntu. Compatibility with other shells is not guaranteed.  
> 
> Theoretically, any shell that adheres to the rules described in the "Explanation of Plugin Implementation" section should work. However, variations between shells may cause issues.  
> 
> If you encounter issues with Bash, please report a bug. For issues with other shells, consider submitting a pull request (PR).

#### Bash

Refer directly to [tabby/wiki/Shell-working-directory-reporting#bash](https://github.com/Eugeny/tabby/wiki/Shell-working-directory-reporting#bash).

```bash
export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
```

To use history: 

```bash
function preexec_invoke_exec() {
    printf "\033]2323;Command=%s\007" "$1"
}

trap 'preexec_invoke_exec "$BASH_COMMAND"' DEBUG
```

#### Fish

You need to modify the default `fish_prompt` function.

You can find the original function code at `/usr/share/fish/functions/fish_prompt.fish @ line 4` (or by running `type fish_prompt` in the Fish shell).

Add the following `echo` statement at the end of the function:

```fish
echo -en "\e]1337;CurrentDir=$PWD\x7"
```