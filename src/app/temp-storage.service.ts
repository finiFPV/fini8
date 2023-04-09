/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TempStorageService {
    private data: any

    set(newData: any): any {
        this.data = newData;
        return this.data;
    }

    get(): any {
        return this.data;
    }

    clear(): void {
        this.data = undefined;
    }
}
