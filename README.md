# tabby-quick-cmds-hint

[中文](README_zh-CN.md) | **English**

This is a simple complete hint (i.e. auto-complete) plugin for [Tabby](https://github.com/Eugeny/tabby). 

## Quick Start

> [!NOTE]
> 
> - This plugin is still in development.
> - It may not be compatible with shells other than Bash, or with systems other than Ubuntu. See [docs/INIT.md](./docs/INIT.md) for more info.
> - The console log output may also be quite messy.

1. 
   - For `bash` user:  
      - basic function: add the following scripts to `~/.bashrc`
         ```bash
         export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
         ```
      - history: add the following scripts to `~/.bashrc`
         ```bash
         function preexec_invoke_exec() {
            printf "\033]2323;Command=%s\007" "$1"
         }
         trap 'preexec_invoke_exec "$BASH_COMMAND"' DEBUG
         ```
2. Download and enable `tabby-quick-cmds` plugin. Add some commands.
3. Start annoying hint experience.


## TODO

- [x] The cmds saved in `tabby-quick-cmds`
- [x] Use AI to complete cmds (Available only when triggered by a shortcut key)
- [ ] Command arguments
- [x] History
- [x] Multilingual support

## Reference & Appreciations

> Some *developers* or *packages directly used in this plugin* are not listed. Please refer to the contributors list or `package.json`.

- [tabby-clippy](https://github.com/Eugeny/tabby-clippy) An example plugin for Tabby
- [minyoad/terminus-quick-cmds](https://github.com/minyoad/terminus-quick-cmds) / [Domain/terminus-quick-cmds](https://github.com/Domain/terminus-quick-cmds)
- [lucide-icon](https://lucide.dev/) the SVG icon