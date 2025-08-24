# tabby-quick-cmds-hint

[中文](README_zh-CN.md) | **English**

This is a simple complete hint (i.e. auto-complete) plugin for [Tabby](https://github.com/Eugeny/tabby). 

## Features

- Reads and matches commands saved in the `tabby-quick-cmds` plugin
- Uses AI to complete commands (available only when triggered by a shortcut key)
- Matches and suggests command parameters (first enter the full command name, then type a space followed by matching content) (the matching content is AI-generated, please verify carefully)
- Reads and matches command history


## Quick Start

> [!NOTE]
> 
> - This plugin is still in development.
> - It may not be compatible with shells other than Bash, or with systems other than Ubuntu. See [docs/INIT.md](./docs/INIT_en-US.md) for more info.
> - The console log output may also be quite messy.

1. 
   - For `bash` user:  
      - basic function: add the following scripts to `~/.bashrc`
         ```bash
         export PS1="$PS1\[\e]1337;CurrentDir="'$(pwd)\a\]'
         ```
2. Download and enable `tabby-quick-cmds` plugin. Add some commands.
3. Start annoying hint experience.

## Reference & Appreciations

> Some *developers* or *packages directly used in this plugin* are not listed. Please refer to the contributors list or `package.json`.

- [tabby-clippy](https://github.com/Eugeny/tabby-clippy) An example plugin for Tabby
- [minyoad/terminus-quick-cmds](https://github.com/minyoad/terminus-quick-cmds) / [Domain/terminus-quick-cmds](https://github.com/Domain/terminus-quick-cmds)
- [lucide-icon](https://lucide.dev/) the SVG icon