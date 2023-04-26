import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-under-construction',
    templateUrl: './under-construction.component.html',
    styleUrls: ['./under-construction.component.scss']
})
export class UnderConstructionComponent {
    constructor(private router: Router) {
        document.title = "This page is under construction";
    }
    goHome() {
        this.router.navigate(['/'])
    }
}