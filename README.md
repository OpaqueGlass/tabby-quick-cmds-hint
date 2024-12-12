# tabby-quick-cmds-hint

This is a simple complete hint (i.e. auto-complete) plugin for [Tabby](https://github.com/Eugeny/tabby). 

## Quick Start

> [!NOTE]
> 
> - This plugin is still in development.
> - It may not be compatible with shells other than Bash, or with systems other than Ubuntu. 
> - The console log output may also be quite messy.
> - To use this plugin, build it yourself or use pre-release, and copy to `C:\Users\<Your user name>\AppData\Roaming\tabby\plugins\node_modules` (For windows)

1. Follow the instructions in  [Tabby/Shell-working-directory-reporting](https://github.com/Eugeny/tabby/wiki/Shell-working-directory-reporting) 

   > If you want use history, please use integrated `Init AutoComplete` hotkey to initiate this feature for every session. 
   > 
   > This feature will execute a command in the session that is suitable for Ubuntu bash, which may can be referenced for setting up other terminals. 
2. Download and enable `tabby-quick-cmds` plugin. Add some commands.
3. Start annoying hint experience.


## TODO

- [x] The cmds saved in `tabby-quick-cmds`
- [ ] Use AI to complete cmds
- [ ] Command arguments
- [x] History
- [ ] Multilingual support

## Reference & Appreciations

> Some *developers* or *packages directly used in this plugin* are not listed. Please refer to the contributors list or `package.json`.

- [tabby-clippy](https://github.com/Eugeny/tabby-clippy) An example plugin for Tabby
- [minyoad/terminus-quick-cmds](https://github.com/minyoad/terminus-quick-cmds) / [Domain/terminus-quick-cmds](https://github.com/Domain/terminus-quick-cmds)
