import { AddMenuService } from "services/insertMenu";
import { MyLogger } from "services/myLogService";
import { ConfigService } from "tabby-core";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";

export class BaseManager {
    sessionUniqueId: string;
    constructor(
        public tab: BaseTerminalTabComponent<BaseTerminalProfile>, 
        public logger: MyLogger, 
        public addMenuService: AddMenuService, 
        public configService: ConfigService
    ) {
        this.sessionUniqueId = tab.profile.id;
    }
    handleInput(buffers: Buffer[]) {

    }
    handleOutput(data: string[]) {

    }
}