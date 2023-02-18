/* eslint-disable no-useless-escape */
import { Component } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { LoadingComponent } from "../loading/loading.component";
import { VerificationComponent } from "../verification/verification.component";
import { v4 as uuidv4 } from 'uuid';
import { HandleDataResponse } from "../handle-data-response";
import { UserDataService } from "../user-data.service";

@Component({
    selector: "app-login",
    templateUrl: "./login.component.html",
    styleUrls: ["./login.component.scss"]
})

export class LoginComponent {
    loginEmail = "";
    loginPswd = "";
    registerEmail = "";
    registerPswd = "";
    valid = {email: false, pswd: false};
    pswdRevealed: {[name: string]: boolean} = {"Registration": false, "Login": false};
    notifications: Array<{message: string, id: string, type: string}> = [];
    errors = {emailMessageToggled: false, pswdHadSpaces: false};
    userDataService: UserDataService;

    constructor(private http: HttpClient, userDataService: UserDataService) {
        this.userDataService = userDataService;
    }
    removeNotification(id: string): void {
        const notification = document.getElementById(id) as HTMLDivElement;
        notification.classList.add("slideOutAnimation");
        setTimeout(() => {
            this.notifications = this.notifications.filter(notification => {
                return !notification.id.includes(id);
            });
        }, 300)
    }
    addNotification(message: string, type: string): void {
        if (this.notifications.length >= 4) this.removeNotification(this.notifications[0].id)
        this.notifications.push({message: message, id: uuidv4(), type: type });
    }
    revealPassword(event: Event, subID: string): void {
        event.preventDefault();
        const reveal = document.getElementById("revealPasswordImage" + subID) as HTMLImageElement;
        const hide = document.getElementById("hidePasswordImage" + subID) as HTMLImageElement;
        const pswdInput = document.getElementById("passwordInput" + subID) as HTMLInputElement;

        reveal.style.display = !this.pswdRevealed[subID] ? "none" : "";
        hide.style.display = !this.pswdRevealed[subID] ? "" : "none";
        pswdInput.type = !this.pswdRevealed[subID] ? "text" : "password";
        this.pswdRevealed[subID] = !this.pswdRevealed[subID];
    }
    revealEmailMessage(event: Event | null, toggle = true, hide = false): void {
        const revealImg = document.getElementById("revealEmailMessage") as HTMLImageElement;
        const hideImg = document.getElementById("hideEmailMessage") as HTMLImageElement;
        const errorDiv = document.getElementById("emailError") as HTMLDivElement;
        const emailInput = document.getElementById("emailInputRegistration") as HTMLInputElement;
        const emailButton = document.getElementById("revealEmail") as HTMLButtonElement;
        if (event != null) event.preventDefault()
        emailButton.disabled = hide;
        emailButton.style.display = hide ? "none" : "";
        emailInput.style.width = hide ? "330px" : "300px";
        if (toggle) {
            revealImg.style.display = this.errors.emailMessageToggled ? "" : "none";
            hideImg.style.display = this.errors.emailMessageToggled ? "none" : "";
            errorDiv.style.maxHeight = this.errors.emailMessageToggled ? "0" : "100px";
            this.errors.emailMessageToggled = !this.errors.emailMessageToggled
            return;
        }
        if (hide) {
            revealImg.style.display = "";
            hideImg.style.display = "none";
            errorDiv.style.maxHeight = "0";
            this.errors.emailMessageToggled = false;
        }
    }
    checkEmail(): void {
        const emailInput = document.getElementById("emailInputRegistrationDiv") as HTMLInputElement;
        let valid = false;
        const regex = new RegExp("^[-!#$%&'*+\\/0-9=?^_\\p{L}{|}~](\\.?[-!#$%&'*+\\/0-9=?^_\\p{L}`{|}~])*@[\\p{L}0-9](-*\\.?[\\p{L}0-9])*\\.[\\p{L}](-?[\\p{L}0-9])+$", "u")
        if (this.registerEmail && this.registerEmail.length <= 254 && regex.test(this.registerEmail)) {
            const parts = this.registerEmail.split("@");
            if(parts[0].length <= 64) {
                const domainParts = parts[1].split(".");
                if(!domainParts.some((part): boolean => {return part.length > 63})) valid = true;
            }
        }
        if (this.registerEmail.length > 0) {
            this.valid.email = valid;
            emailInput.style.borderColor = valid ? "#00ffaad8" : "#ff4b4bd8";
            this.revealEmailMessage(null, false, valid);
        } else {
            this.valid.email = false;
            emailInput.style.borderColor = "#8f8f8f";
            this.revealEmailMessage(null, false, true);
        }
        this.checkCredentials();
    }
    onSubmit(event: Event, type: string): void {
        const loadingComponent = new LoadingComponent();
        const actions: {[type: string]: string} = {login: "Logging In...", register: "Registering..."}
        const unavailable = "Sorry, an internal service is currently unavailable. Our team is working on a resolution, and it should be back up soon. Please try again later."
        const unknownError = "An unknown error occurred! Please try again later."
        const email = type === "login" ? this.loginEmail : type === "register" ? this.registerEmail : undefined;
        const pswd = type === "login" ? this.loginPswd : type === "register" ? this.registerPswd : undefined;
        loadingComponent.loadingActivate(event, actions[type]);
        this.http.post<HandleDataResponse>(
            "/handle_data",
            {type: type, data: {email: email, pswd: pswd}},
            {headers: new HttpHeaders({"Content-Type": "application/json"})}
        ).subscribe((response) => {
            const message = response.status === 503 ?
                unavailable :
                type === "login" ?
                    response.status === 401 ? "Invalid credentials! Please try again." :
                    response.status === 200 && response.accepted ? "Successfully logged in!" :
                    unknownError :
                type === "register" ?
                    response.status === 409 ? "A user with the specified email already exists. Please use a different email address." :
                    response.status === 201 && response.accepted ? "Successfully registered! Please verify your email address." :
                    unknownError :
                unknownError
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.userDataService.set(response.userData!);
            loadingComponent.loadingStop();
            this.addNotification(message, response.accepted ? "success" : "error");
            if (response.accepted && ((type === "login" && this.userDataService.get().emailVerified === false) || type === "register")) {
                const verificationComponent = new VerificationComponent(this.http, this.userDataService);
                verificationComponent.verificationActivate();
            }
        });
    }
    checkCredentials(): void {
        const registerBtn = document.getElementById("register") as HTMLButtonElement;
        const loginBtn = document.getElementById("login") as HTMLButtonElement;
        const requirements: Array<[boolean, HTMLButtonElement]> = [
            [(this.valid.pswd && this.valid.email), registerBtn],
            [this.loginPswd.length > 0 && this.loginEmail.length > 0, loginBtn]
        ];
        requirements.forEach(([valid, btn]) => btn.disabled = !valid);
    }
    checkPswd(): void {
        const pswdInputDiv = document.getElementById("passwordInputRegistrationDiv") as HTMLDivElement;
        const pswdInput = document.getElementById("passwordInputRegistration") as HTMLInputElement;
        const pswdError = document.getElementById("pswdError") as HTMLDivElement;
        const pswdDiv = document.getElementById("pswd_div") as HTMLDivElement
        const spaces = this.registerPswd.includes(" ")
        const criterias: Array<[boolean, number]> = [
            [this.registerPswd.length >= 8, 1],
            [this.registerPswd.length >= 10, 1],
            [(new RegExp("\\p{Lu}", "u")).test(this.registerPswd), 1],
            [(new RegExp("\\p{Ll}", "u")).test(this.registerPswd), 1],
            [/[`!@#$%^&*()_+\-=\[\]{};":"\\|,.<>\/?~]/.test(this.registerPswd), 1],
            [/\d/.test(this.registerPswd), 1]
        ];
        const levels: {[name: number]: {color: string, text: string}} = {
            0: {"color": "#ff4b4bd8", "text": "Too Weak"},
            1: {"color": "#ff4b4bd8", "text": "Weak"},
            2: {"color": "#FAA916d8", "text": "Fair"},
            3: {"color": "#00FFAAd8", "text": "Good"},
            4: {"color": "#00FFAAd8", "text": "Excelent"}
        };
        const levelDispaly = (level: number): void => {
            pswdInputDiv.style.borderColor = levels[level]["color"];
            (document.getElementById("levelTxt") as HTMLSpanElement).innerHTML = levels[level]["text"]
            const levelElements = [
                document.getElementById("weakLevel") as HTMLDivElement,
                document.getElementById("fairLevel") as HTMLDivElement,
                document.getElementById("goodLevel") as HTMLDivElement,
                document.getElementById("excelentLevel") as HTMLDivElement
            ];
            levelElements.forEach((elem, index) => elem.style.backgroundColor = level >= index + 1 ? levels[level]["color"] : "#8f8f8f");
        }
        let score = 0; criterias.forEach(element => {if(element[0]) score += element[1]});
        if (this.registerPswd.length === 0) {
            this.valid.pswd = false;
            if (document.activeElement === pswdInput) levelDispaly(0);
            else pswdInputDiv.style.borderColor = "#8f8f8f";
        } else if (this.registerPswd.length >= 6) {
            levelDispaly(score >= 4 && score < 5 ? 2 : score >= 5 && score < 6 ? 3 : score === 6 ? 4 : 1);
            this.valid.pswd = score >= 4;
        } else {
            levelDispaly(0);
            this.valid.pswd = false;
        }
        pswdDiv.style.transition = spaces || this.errors.pswdHadSpaces ? "none" : "";
        pswdError.style.maxHeight = spaces ? "100px" : "";
        if (spaces) {
            this.valid.pswd = false;
            pswdInputDiv.style.borderColor = levels[0]["color"]
        }
        pswdDiv.style.maxHeight = (this.valid.pswd || this.registerPswd.length === 0) && document.activeElement !== pswdInput || spaces ? "0" : "100px";
        this.checkCredentials();
        this.errors.pswdHadSpaces = spaces;
    }
}
