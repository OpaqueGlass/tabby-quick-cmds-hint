import { Subscription } from "rxjs";
import { AddMenuService } from "services/menuService";
import { MyLogger } from "services/myLogService";
import { ConfigService } from "tabby-core";
import { BaseTerminalProfile, BaseTerminalTabComponent } from "tabby-terminal";
import { generateUUID } from "utils/commonUtils";

export class BaseManager {
    protected sessionUniqueId: string;
    protected profileUniqueId: string;
    protected subscriptionList: Array<Subscription>;
    constructor(
        public tab: BaseTerminalTabComponent<BaseTerminalProfile>, 
        public logger: MyLogger, 
        public addMenuService: AddMenuService, 
        public configService: ConfigService
    ) {
        this.profileUniqueId = tab.profile.id;
        this.sessionUniqueId = generateUUID();
        this.subscriptionList = new Array();
    }
    handleInput: (buffers: Buffer[])=>void | null = null;
    handleOutput:(data: string[])=>void | null = null;
    destory():void {
        for (let subscription of this.subscriptionList) {
            subscription?.unsubscribe();
        }
    }
}