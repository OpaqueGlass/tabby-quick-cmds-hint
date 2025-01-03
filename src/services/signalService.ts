import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({providedIn: 'root'})
export class MySignalService {
    private menuStatusNS: Subject<void> = new Subject<void>();
    public menuStatus$ = this.menuStatusNS.asObservable();

    public changeMenuStatus() {
        this.menuStatusNS.next();
    }
}