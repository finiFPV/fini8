import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { HandleDataResponse } from "../handle-data-response";
import { LoadingComponent } from "../loading/loading.component";
import Identicon from 'identicon.js';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    constructor(private router: Router, private http: HttpClient) {}
    menuShown = false;
    ngOnInit(): void {
        const cookies: {[key: string]: string } = document.cookie.replace(/\s+/g, '').split(';').reduce((acc: {[key: string]: string}, item: string) => {const [key, value] = item.split('=');acc[key] = value;return acc}, {});
        if(
            cookies["authToken"] === undefined ||
            cookies["authToken"].length !== 64 ||
            !/[0-9A-Fa-f]{64}/.test(cookies["authToken"])
        ) this.router.navigate(['/login'])
        else {
            this.http.post<HandleDataResponse>("/handle_data", {type: "retrieveData", authToken: cookies["authToken"]}, {headers: new HttpHeaders({"Content-Type": "application/json"})}).subscribe((response) => {
                if (!response.accepted || !response.requestedData.sessionValid) this.router.navigate(['/login'])
            });
        }
        const menuBtn = document.getElementById("menu-button") as HTMLDivElement;
		menuBtn.addEventListener("click", this.toggleMenu);
        this.http.post<HandleDataResponse>("/handle_data", {type: "retrieveData", authToken: cookies["authToken"], requestedData: ["pfpSeed", "email"]}, {headers: new HttpHeaders({"Content-Type": "application/json"})}).subscribe((response) => {
            if (response.accepted) {
                const email = response.requestedData.email;
                const emailContainer = document.getElementById("email-container") as HTMLDivElement;
                (document.getElementById("pfp-container") as HTMLDivElement).innerHTML = `<img src="data:image/png;base64,${new Identicon(response.requestedData.pfpSeed, {size: 40,background: [0, 0, 0, 0]}).toString()}" alt="Profile Picture"/>`;
                emailContainer.innerText = email.substring(0 , 8) + (email.length > 8 ? "..." : "");
                emailContainer.title = email;
            }
        });
    }
    toggleMenu() {
        const menuBtn = document.getElementById("menu-button") as HTMLDivElement;
        const menu = document.getElementById("menu") as HTMLDivElement;
        if (!this.menuShown) {
            menu.classList.remove("menu-closed");
            menu.classList.add("menu-open");
            menuBtn.classList.add("close");
            this.menuShown = true;
        } else {
            menu.classList.remove("menu-open");
            menu.classList.add("menu-closed");
            menuBtn.classList.remove("close");
            this.menuShown = false;
        }
    }
    logout() {
        const loadingComponent = new LoadingComponent();
        loadingComponent.loadingActivate(null, "Logging out...");
        setTimeout(() => {
            const cookies: {[key: string]: string } = document.cookie.replace(/\s+/g, '').split(';').reduce((acc: {[key: string]: string}, item: string) => {const [key, value] = item.split('=');acc[key] = value;return acc}, {});
            document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            this.http.post<HandleDataResponse>("/handle_data", {type: "logout", authToken: cookies["authToken"]}, {headers: new HttpHeaders({"Content-Type": "application/json"})}).subscribe(() => {
                this.router.navigate(['/login']);
            });
        }, 2000);
    }
}