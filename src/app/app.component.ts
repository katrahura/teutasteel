import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule,NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { trigger, transition, style, animate } from '@angular/animations';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule,CommonModule,TranslateModule,NgbDropdownModule],  // Import RouterModule to enable routerLink
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('routeAnimations', [
      transition('HomePage <=> ProductsPage, HomePage <=> ContactPage, HomePage <=> AboutPage', [
        style({ opacity: 0 }),
        animate('0.5s ease-in-out', style({ opacity: 1 }))
      ]),
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('0.5s ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class AppComponent {
  currentRoute: string = '';
  currentLanguage = 'en'; // Default language is English
  prepareRoute(outlet: RouterOutlet) {
    const animationData = outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
    return animationData;
  }
  
  constructor(private router: Router,private translate: TranslateService) {
    // Detect route changes and update the currentRoute variable
    this.translate.setDefaultLang('en');

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
    });
  }
  title = 'teutasteel-website';
  getGradientClass(): string {
    if (this.currentRoute === '/products') {
      return 'products-gradient';
    } else if (this.currentRoute === '/about') {
      return 'about-gradient';
    } else if (this.currentRoute === '/contact') {
      return 'contact-gradient';
    } else {
      return 'default-gradient'; // Fallback for the home or other pages
    }
  }
  switchLanguage(language: string) {
    this.currentLanguage = language;
    this.translate.use(language); // Switch the language in ngx-translate
  }

  
}
