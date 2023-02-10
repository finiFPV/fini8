import { Component } from '@angular/core';

@Component({
    selector: 'app-loading',
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss']
})

export class LoadingComponent {
    loadingActivate(event: Event, action: string): void {
        const container = document.getElementById("container") as HTMLDivElement;
        const actionText = document.getElementById("loadingAction") as HTMLHeadingElement;
        const loading = document.getElementById("loading") as HTMLDivElement;
        const loadingParrent = document.getElementById("loading_outer") as HTMLDivElement;

        event.preventDefault();

        loading.style.display = "";
        loading.style.width = '140px';
        loading.style.height = '140px';
        loadingParrent.style.display = "";
        container.style.display = "none";
        actionText.innerHTML = action;
    }

    loadingStop(): void {
        const loading = document.getElementById("loading") as HTMLDivElement;
        const loadingParrent = document.getElementById("loading_outer") as HTMLDivElement;
        const container = document.getElementById("container") as HTMLDivElement;
        loading.addEventListener('animationiteration', (event) => {
            if (event.animationName.endsWith("prixClipFix")) {
                loadingParrent.style.display = "none";
                container.style.display = "";
            }
        })
    }
}