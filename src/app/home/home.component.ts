import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { HandleDataResponse } from "../handle-data-response";

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    constructor(private router: Router, private http: HttpClient) {}
    ngOnInit(): void {
        const cookies: {[key: string]: string } = document.cookie.replace(/\s+/g, '').split(';').reduce((acc: {[key: string]: string}, item: string) => {const [key, value] = item.split('=');acc[key] = value;return acc}, {});
        console.log(/[0-9A-Fa-f]{64}/.test(cookies["authToken"]))
        if(cookies["authToken"] === undefined || !/[0-9A-Fa-f]{64}/.test(cookies["authToken"]) || cookies["authToken"].length !== 64) this.router.navigate(['/login'])
        else {
            this.http.post<HandleDataResponse>("/handle_data", {type: "retrieveData", authToken: cookies["authToken"]}, {headers: new HttpHeaders({"Content-Type": "application/json"})}).subscribe((response) => {
                if (response.accepted && response.requestedData.sessionValid) this.router.navigate(['/under-construction'])
                else this.router.navigate(['/login'])
            });
        }
    }
}