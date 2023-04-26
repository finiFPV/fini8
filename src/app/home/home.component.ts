import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { HandleDataResponse } from "../handle-data-response";
import { LoadingComponent } from "../loading/loading.component";
import { CookiesService } from '../cookies.service';
import Identicon from 'identicon.js';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})

export class HomeComponent implements OnInit {
    menuShown = false;
    constructor(
        private router: Router,
        private http: HttpClient,
        private cookiesService: CookiesService
    ) {
        document.title = "Fini8";
    }

    ngOnInit(): void {
        const cookies: {[key: string]: string } = this.cookiesService.get()
        if (
            cookies["authToken"] === undefined ||
            cookies["authToken"].length !== 64 ||
            !/[0-9A-Fa-f]{64}/.test(cookies["authToken"])
        ) this.router.navigate(['/login'])
        else {
            this.http.post<HandleDataResponse>(
                "/handle_data", {
                    type: "retrieveData",
                    authToken: cookies["authToken"]
                }, {
                    headers: new HttpHeaders({"Content-Type": "application/json"})
                }
            ).subscribe((response): void => {
                if (
                    !response.accepted ||
                    !response.requestedData.sessionValid
                ) this.router.navigate(['/login']);
            });
        }
        (document.getElementById("container") as HTMLDivElement).style.display = "";
		(document.getElementById("menu-button") as HTMLDivElement).addEventListener("click", this.toggleMenu);
        this.http.post<HandleDataResponse>(
            "/handle_data", {
                type: "retrieveData",
                authToken: cookies["authToken"],
                requestedData: ["pfpSeed", "email"]
            }, {
                headers: new HttpHeaders({"Content-Type": "application/json"})
            }
        ).subscribe(response => {
            if (response.accepted) {
                const emailContainer = document.getElementById("email-container") as HTMLDivElement;
                const email = response.requestedData.email;
                (document.getElementById("pfp-container") as HTMLDivElement).innerHTML =
                    `<img src="data:image/png;base64,${
                        new Identicon(
                            response.requestedData.pfpSeed, {
                                size: 40,
                                background: [0, 0, 0, 0]
                            }).toString()
                    }" alt="Profile Picture"/>`;
                emailContainer.innerText = email.substring(0 , 8) + (email.length > 8 ? "..." : "");
                emailContainer.title = email;
            }
        });
    }
    toggleMenu(): void {
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
    logout(): void {
        const loadingComponent = new LoadingComponent();
        loadingComponent.loadingActivate(null, "Logging out...");
        setTimeout(async () => {
            await this.http.post<HandleDataResponse>(
                "/handle_data", {
                    type: "logout",
                    authToken: this.cookiesService.get()["authToken"]
                }, {
                    headers: new HttpHeaders({"Content-Type": "application/json"})
                }
            )
            await this.cookiesService.delete("authToken");
            this.router.navigate(['/login']);
        }, 2000);
    }
}