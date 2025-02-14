import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({providedIn: 'root'})
export class MySignalService {
    private menuStatusNS: Subject<void> = new Subject<void>();
    public menuStatus$ = this.menuStatusNS.asObservable();

    private startCompleteNowNS: Subject<void> = new Subject<void>();
    public startCompleteNow$ = this.startCompleteNowNS.asObservable();

    public changeMenuStatus() {
        this.menuStatusNS.next();
    }

    public hintNow() {
        this.startCompleteNowNS.next();
    }
}