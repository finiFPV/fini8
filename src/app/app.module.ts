import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { FormsModule } from '@angular/forms';
import { LoadingComponent } from './loading/loading.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { NotificationComponent } from './notification/notification.component';
import { VerificationComponent } from './verification/verification.component';
import { VerifyComponent } from './verify/verify.component';
import { MdComponent } from './md/md.component';

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent,
        LoadingComponent,
        NotFoundComponent,
        NotificationComponent,
        VerificationComponent,
        VerifyComponent,
        MdComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {}