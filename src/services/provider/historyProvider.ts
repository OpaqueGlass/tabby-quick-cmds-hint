import { EnvBasicInfo, OptionItem, TerminalSessionInfo } from "api/pluginType";
import { MyLogger } from "services/myLogService";
import { BaseContentProvider, OptionItemResultWrap } from "./baseProvider";

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
        // do sth
        return null;
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
        const request = indexedDB.open(this.dbName, 1);
        return new Promise((resolve, reject) => {
            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
                }
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
    async getHistoryFromDB(db: IDBDatabase, profileId: string, limit: number, startTime: Date, endTime: Date): Promise<any[]> {
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
                        && (endTime == null || record.time <= endTime)) {
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
    async findExactCmdHistory(db: IDBDatabase, cmd: string, profileId: string): Promise<any> {
        if (await this.isIndexedDBEmpty(db)) {
            return null;
        }
        return new Promise((resolve, reject) => {
            
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const index = store.index("cmd");
            const query = index.openCursor(IDBKeyRange.only(cmd));
            query.onsuccess = (event) => {
                const cursor = query.result;
                if (cursor) {
                    if (cursor.value.profileId === profileId) {
                        resolve(cursor.value);
                        return;
                    }
                    cursor.continue();
                } else {
                    resolve(null);
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
        const existingRecord = await this.findExactCmdHistory(db, cmdHistory.cmd, cmdHistory.profileId);
        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
    
        if (existingRecord) {
            existingRecord.count += 1;
            existingRecord.time = cmdHistory.time;
            store.put(existingRecord);
        } else {
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