import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class CookiesService {
    get(): {[key: string]: string} {
        return document.cookie.replace(/\s+/g, '').split(';').reduce((acc: {[key: string]: string}, item: string) => {
            const [key, value] = item.split('=');
            acc[key] = value;return acc
        }, {});
    }
    delete(key: string): void {
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    }
    set(key: string, value: string, expiresDays: number): void {
        const date = new Date();
        date.setTime(date.getTime() + (expiresDays * 24 * 60 * 60 * 1000));
        const expires = expiresDays === 0 ? "" : `expires=${date.toUTCString()};`;
        document.cookie = `${key}=${value};${expires}path=/`;
    }
}