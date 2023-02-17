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

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent,
        LoadingComponent,
        NotFoundComponent,
        NotificationComponent,
        VerificationComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule
    ],
    providers: [
        { provide: 'userData', useValue: {validUser: false} }
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}