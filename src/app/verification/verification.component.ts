import { Component, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { HandleDataResponse } from "../handle-data-response";
import { TempStorageService } from '../temp-storage.service';

@Component({
    selector: 'app-verification',
    templateUrl: './verification.component.html',
    styleUrls: ['./verification.component.scss']
})
export class VerificationComponent {
    resendTimes = { regular: 120, error: 10 };
    code = ["", "", "", "", "", ""];
    @Output() notify: EventEmitter<{ message: string, status: "success" | "error" }> = new EventEmitter()
    private tempStorage: TempStorageService
    constructor(private http: HttpClient, tempStorage: TempStorageService) {
        this.tempStorage = tempStorage;
    }
    sendVerificationEmail(type = "sendVerification"): void {
        const resendLink = document.getElementById("resendLink") as HTMLAnchorElement;
        const resendClock = document.getElementById("resendClock") as HTMLSpanElement;
        const resendLoading = document.getElementById("loadingMini") as HTMLDivElement;
        resendLink.style.display = "none";
        resendLoading.style.display = "";
        resendClock.style.color = "#606060";
        this.http.post<HandleDataResponse>(
            "/email",
            {type: "sendVerification", authToken: this.tempStorage.get()["authToken"]},
            {headers: new HttpHeaders({ "Content-Type": "application/json" })}
        ).subscribe((response) => {
            if (response.status === 409) {
                (document.getElementById("emailVerification") as HTMLDivElement).style.display = "none";
                (document.getElementById("container") as HTMLDivElement).style.display = "";
                return;
            }
            let time = type === "sendVerification" ? 0 : response.accepted ? this.resendTimes.regular : this.resendTimes.error;
            if (type !== "sendVerification") {
                const minutes = Math.floor(time / 60)
                const seconds = time - minutes * 60
                resendClock.textContent = `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
                resendLoading.style.display = "none";
                resendLink.style.display = "none";
                resendClock.style.display = "";
                if (response.accepted) this.notify.emit({ message: "Successfully sent verification email.", status: "success" });
                else if (response.status === 503) this.notify.emit({ message: "Sorry, an internal service is currently unavailable. Our team is working on a resolution, and it should be back up soon. Please try again later.", status: "error" });
                else this.notify.emit({ message: "An unknown error occurred! Please try again later.", status: "error" });
                const timer = setInterval(() => {
                    const minutes = Math.floor(time / 60)
                    const seconds = time - minutes * 60
                    resendClock.textContent = `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
                    if (time === 0) {
                        resendClock.style.display = "none";
                        resendLink.style.display = "";
                        clearInterval(timer);
                    }
                    time--;
                }, 1000);
            } else {
                resendClock.style.display = "none";
                resendLink.style.display = "";
                resendLoading.style.display = "none";
            }
        });
    }
    verificationActivate(): void {
        for (let i = 0; i < 6; i++) { const elem = document.getElementById("codeInput" + i) as HTMLInputElement; elem.value = ""; elem.style.borderColor = ""; this.code[i] = ""}
        this.http.post<HandleDataResponse>(
            "/handle_data",
            { type: "retrieveData", authToken: this.tempStorage.get()["authToken"], requestedData: "email" },
            { headers: new HttpHeaders({ "Content-Type": "application/json" }) }
        ).subscribe((response) => {
            const email = response.requestedData.email;
            const len = email.indexOf("@");
            const txtLen = Math.floor(len * .3);
            (document.getElementById("emailText") as HTMLDivElement).innerText = "We sent the verification email to: " +
                "*".repeat(len - (txtLen >= 4 ? 4 : txtLen)) + email.substring(len - (txtLen >= 4 ? 4 : txtLen));
            (document.getElementById("emailVerification") as HTMLDivElement).style.display = "";
            (document.getElementById("container") as HTMLDivElement).style.display = "none";
            this.sendVerificationEmail();
        });
    }
    checkCode(index: number, mode = "input", event?: Event | null, clipboardEvent?: ClipboardEvent) {
        if (mode === "delete") {
            if (this.code[index] === "" && index !== 0) (document.getElementById(`codeInput${index - 1}`) as HTMLInputElement).focus();
            else if (index === 5 && this.code[index] !== "") {
                this.code[index] = "";
                (document.getElementById("codeInput" + index) as HTMLInputElement).value = "";
                event?.preventDefault();
            }
            (document.getElementById("verifyButton") as HTMLButtonElement).disabled = true;
            return;
        }
        else if (mode === "paste") {
            clipboardEvent?.preventDefault();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const code = clipboardEvent!.clipboardData!.getData('text')
            let indexModified = 0;
            for (let i = 0; i < 6; i++) {
                if (/[\d]/.test(code.substring(i, i + 1))) {
                    this.code[indexModified] = (document.getElementById("codeInput" + indexModified) as HTMLInputElement).value = code.substring(i, i + 1); indexModified++;
                }
            }
            if (indexModified > 0) (document.getElementById(`codeInput${indexModified >= 5 ? 5 : indexModified}`) as HTMLInputElement).focus();
            this.code.every((value => value !== "")) ? (document.getElementById("verifyButton") as HTMLButtonElement).disabled = false :
                (document.getElementById("verifyButton") as HTMLButtonElement).disabled = true;
            return;
        }
        if (!/[\d]/.test(this.code[index]) && this.code[index] !== "") {
            this.code[index] = "";
            (document.getElementById("codeInput" + index) as HTMLInputElement).value = "";
            return;
        }
        if (this.code[index] !== "") (document.getElementById(`codeInput${index === 5 ? 5 : (index + 1)}`) as HTMLInputElement).focus();
        this.code.every((value => value !== "")) ? (document.getElementById("verifyButton") as HTMLButtonElement).disabled = false :
            (document.getElementById("verifyButton") as HTMLButtonElement).disabled = true;
    }
    verifyCode() {
        ["resendLinkMiddle", "resendLink", "verifyButton", "verifyButtonOuter"].forEach((id) => (document.getElementById(id) as HTMLDivElement).classList.add("disabled"));
        (document.getElementById("verifyText") as HTMLSpanElement).style.display = "none";
        (document.getElementById("buttonLoadingMini") as HTMLDivElement).style.display = "";
        this.http.post<HandleDataResponse>(
            "/email",
            { type: "finishVerification", code: this.code.join(""), authToken: this.tempStorage.get()["authToken"]},
            { headers: new HttpHeaders({ "Content-Type": "application/json" }) }
        ).subscribe((response) => {
            ["resendLinkMiddle", "resendLink", "verifyButton", "verifyButtonOuter"].forEach((id) => (document.getElementById(id) as HTMLDivElement).classList.remove("disabled"));
            (document.getElementById("verifyText") as HTMLSpanElement).style.display = "";
            (document.getElementById("buttonLoadingMini") as HTMLDivElement).style.display = "none";
            if (response.accepted) {
                (document.getElementById("emailVerification") as HTMLDivElement).style.display = "none";
                (document.getElementById("container") as HTMLDivElement).style.display = "";
                for (let i = 0; i < 6; i++) {
                    this.code[i] = "";
                    const elem = document.getElementById("codeInput" + i) as HTMLInputElement;
                    elem.value = "";
                    elem.style.borderColor = "";
                }
            }
            else if (response.status === 406) {
                this.notify.emit({ message: "Invalid verification code!", status: "error" });
                for (let i = 0; i < 6; i++) {
                    const elem = document.getElementById("codeInput" + i) as HTMLInputElement;
                    elem.style.borderColor = "#ff4b4bd8";
                    elem.classList.add("shake");
                }
                for (let i = 0; i < 6; i++) {
                    setTimeout(() => (document.getElementById("codeInput" + i) as HTMLInputElement).classList.remove("shake"), 500);
                }
                (document.getElementById("verifyButton") as HTMLButtonElement).disabled = true;
            }
            else if (response.status === 503) this.notify.emit({
                message: "Sorry, an internal service is currently unavailable. Our team is working on a resolution, and it should be back up soon. Please try again later.",
                status: "error"
            });
            else this.notify.emit({ message: "An unknown error occurred! Please try again later.", status: "error" });
        });
    }
    skipField(side: "left" | "right", index: number, event: Event) {
        event.preventDefault();
        if (side === "left" && index !== 0) (document.getElementById(`codeInput${index - 1}`) as HTMLInputElement).focus();
        else if (side === "right" && index !== 5) (document.getElementById(`codeInput${index + 1}`) as HTMLInputElement).focus();
    }
}