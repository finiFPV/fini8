import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { HandleDataResponse } from "../handle-data-response";
import { LoadingComponent } from "../loading/loading.component";

@Component({
    selector: 'app-verify',
    templateUrl: './verify.component.html',
    styleUrls: ['./verify.component.scss']
})
export class VerifyComponent implements OnInit {
    constructor(private http: HttpClient, private activatedRoute: ActivatedRoute, private router: Router) {}
    cheackVerification(type="initial"): void {
        if (type === "reCheack") {
            (document.getElementById("fail") as HTMLDivElement).style.display = "none";
            (document.getElementById("success") as HTMLDivElement).style.display = "none";
            (document.getElementById("resendLink") as HTMLDivElement).style.display = "none";
        }
        const loadingComponent = new LoadingComponent();
        loadingComponent.loadingActivate(null, "Verifying your email address");
        this.activatedRoute.queryParams.subscribe(params => {
            if (params['token']===undefined) this.router.navigate(['/']);
            else if (!(/[0-9A-Fa-f]{16}/.test(params['token']))) this.router.navigate(['/']);
            else {
                this.http.post<HandleDataResponse>(
                    "/email",
                    {type: "finishVerification", id: params['token']},
                    {headers: new HttpHeaders({"Content-Type": "application/json"})}
                ).subscribe((response) => {
                    loadingComponent.loadingStop();
                    if (response.accepted) {
                        (document.getElementById("emailText") as HTMLDivElement).innerText = "Successfully verified email address: " + response.requestedData.email + " You can continue now.";
                        (document.getElementById("success") as HTMLDivElement).style.display = "";
                    }
                    else if (response.status === 503) {
                        (document.getElementById("failText") as HTMLDivElement).innerText = "Sorry, an internal service is currently unavailable. Our team is working on a resolution, and it should be back up soon. Please try again later.";
                        (document.getElementById("fail") as HTMLDivElement).style.display = "";
                        (document.getElementById("resendLink") as HTMLDivElement).style.display = "";
                    }
                    else if (response.status === 400) this.router.navigate(['/']);
                    else (document.getElementById("fail") as HTMLDivElement).style.display = "";
                });
            }
        })
    }
    ngOnInit(): void {this.cheackVerification()}
}