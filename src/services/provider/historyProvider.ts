import { EnvBasicInfo, OptionItem, TerminalSessionInfo } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";
import Fuse from "fuse.js";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class HistoryContentProvider extends BaseContentProvider {
    protected static providerTypeKey: string = "h";
    private dbName = "og_tac_HistoryDB";
    private storeName = "CmdHistory";
    private db: IDBDatabase;
    constructor(
        protected logger: MyLogger
    ) {
        super(logger);
        this.openDB().then((db) => {
            this.db = db;
            // 清理历史记录
            const currentDate = new Date();
            const pastDate = new Date(currentDate.setDate(currentDate.getDate() - 60));
            this.clearOldCmdHistories(db, pastDate).then(() => {
                this.logger.log("清理历史记录成功");
            }).catch((err) => {
                this.logger.error("清理历史记录失败", err);
            });
        }).catch((err)=>{
            this.logger.error("打开数据库失败", err);
        });
    }
    async getQuickCmdList(inputCmd: string, envBasicInfo: EnvBasicInfo): Promise<OptionItemResultWrap> {
        if (this.db == null) {
            return null;
        }
        const result: OptionItem[] = [];
        const dbList = await this.getHistoryFromDB(this.db, envBasicInfo.tab.profile.id, 10, null, null, 3);
        this.logger.log("db list", dbList);
        const options = {
            keys: ['cmd'], // 搜索的字段
            threshold: 0.2, // 控制匹配的模糊度
            includeScore: true // 包含得分
        };
        const fuse = new Fuse(dbList, options);
        this.logger.log("匹配结果", fuse.search(inputCmd));
        result.push(...fuse.search(inputCmd).map((value)=>{
            return {
                name: value.item.cmd,
                content: value.item.cmd,
                desp: "",
                type: HistoryContentProvider.providerTypeKey
            } as OptionItem
        }));
        this.logger.log("result", result);
        // result.push(...dbList.map((value) => {
        //     return {
        //         name: value.cmd,
        //         content: value.cmd,
        //         desp: "",
        //         type: HistoryContentProvider.providerTypeKey
        //     } as OptionItem;
        // }));
        // do sth
        return {
            optionItem: result,
            envBasicInfo: envBasicInfo,
            type: HistoryContentProvider.providerTypeKey
        } as OptionItemResultWrap;
    }
    async userInputCmd(inputCmd: string, terminalSessionInfo: TerminalSessionInfo): Promise<void> {
        if (this.db == null) {
            return null;
        }
        this.addOrUpdateCmdHistory(this.db, {time: new Date(), cmd: inputCmd, profileId: terminalSessionInfo.tab.profile.id}).catch((err)=>{
            this.logger.error(err);
        });
    }
    userSelectedCallback(inputCmd: string): void {

    }
    async openDB(): Promise<IDBDatabase> {
        const request = indexedDB.open(this.dbName, 2);
        return new Promise((resolve, reject) => {
            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
                    objectStore.createIndex("profileId", "profileId", { unique: false });
                    objectStore.createIndex("cmd", "cmd", { unique: false });
                    objectStore.createIndex("time", "time", { unique: false });
                }
                // 升级数据库也需要在这里处理！
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async addCmdHistory(db: IDBDatabase, cmdHistory: { time: Date, count: number, cmd: string, profileId: string }): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.add(cmdHistory);
            request.onsuccess = () => {
                resolve();
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    async getHistoryFromDB(db: IDBDatabase, profileId: string, limit: number, startTime: Date, endTime: Date, countLimit?: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const index = store.index("profileId");
            const range = IDBKeyRange.only(profileId);
            const query = index.openCursor(range);
            const results: any[] = [];
    
            query.onsuccess = (event) => {
                const cursor = query.result;
                if (cursor) {
                    const record = cursor.value;
                    if ((startTime == null && record.time >= startTime) 
                        && (endTime == null || record.time <= endTime) && (countLimit == null || record.count >= countLimit)) {
                        results.push(record);
                        if (results.length >= limit) {
                            resolve(results);
                            return;
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            query.onerror = () => {
                reject(query.error);
            };
        });
    }
    async clearOldCmdHistories(db: IDBDatabase, beforeDate: Date): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const index = store.index("time");
            const range = IDBKeyRange.upperBound(beforeDate);
            const query = index.openCursor(range);
    
            query.onsuccess = (event) => {
                const cursor = query.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            query.onerror = () => {
                reject(query.error);
            };
        });
    }
    async findExactCmdHistory(db: IDBDatabase, cmd: string, profileId: string): Promise<any[]> {
        if (await this.isIndexedDBEmpty(db)) {
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const index = store.index("cmd");
            const query = index.openCursor(IDBKeyRange.only(cmd));
            const results: any[] = [];
            query.onsuccess = (event) => {
                const cursor = query.result;
                if (cursor) {
                    if (cursor.value.profileId === profileId) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            query.onerror = () => {
                reject(query.error);
            };
        });
    }
    
    // 添加或更新记录
    async addOrUpdateCmdHistory(db: IDBDatabase, cmdHistory: { time: Date, cmd: string, profileId: string }): Promise<void> {
        const isEmpty = await this.isIndexedDBEmpty(db);
        const existingRecordList = await this.findExactCmdHistory(db, cmdHistory.cmd, cmdHistory.profileId);
        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        let haveExistingRecord = false;
        // let existingRecord = null;
        for (let i = 0; i < existingRecordList.length; i++) {
            const record = existingRecordList[i];
            if (record.profileId === cmdHistory.profileId) {
                record.count += 1;
                record.time = cmdHistory.time;
                store.put(record);
                haveExistingRecord = true;
                break;
            }
        }

        if (!haveExistingRecord){
            store.add({ ...cmdHistory, count: 1 });
        }
    
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }
    isIndexedDBEmpty(db: IDBDatabase) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);

            const countRequest = store.count();

            countRequest.onerror = (event) => {
                reject(event);
            };

            countRequest.onsuccess = (event) => {
                resolve(countRequest.result === 0);
            };
        });
    }
}