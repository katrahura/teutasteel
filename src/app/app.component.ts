import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule,NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { RouterOutlet } from '@angular/router';
import { MobileNavComponent } from './shared/mobile-nav/mobile-nav.component';
import { SharedService } from './shared.service';
import { AuthService } from './services/auth.service';
import { SeoService } from './shared/seo.service';
import { getStoredLanguage, setStoredLanguage } from './shared/language-storage';
import { QuoteListService } from './shared/quote-list.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule,CommonModule,TranslateModule,MobileNavComponent],  // Import RouterModule to enable routerLink
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
  /** Drives the Login / Logout control in the navigation bar. */
  isLoggedIn = false;

  /** Contact details come from the environment, so a changed number is changed in one place. */
  readonly phone = environment.phone;
  readonly phoneDisplay = environment.phoneDisplay;
  readonly email = environment.contactEmail;
  readonly whatsappLink = 'https://wa.me/' + environment.whatsappNumber;

  /** How many items are on the request list, shown in the navigation. */
  quoteCount = 0;

  prepareRoute(outlet: RouterOutlet) {
    const animationData = outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
    return animationData;
  }
  
  constructor(private router: Router,private translate: TranslateService,public shared: SharedService,private authService: AuthService, seo: SeoService, private quoteList: QuoteListService) {
    // Detect route changes and update the currentRoute variable
    const language = getStoredLanguage() ?? 'al';
    this.translate.setDefaultLang('al');
    this.translate.use(language); // Make the active language explicit (currentLang was left undefined)
    this.shared.setLang(language);

    // Constructed here so it is always running: it follows the route and the
    // language and keeps the title, canonical and <html lang> up to date.
    void seo;

    this.isLoggedIn = this.authService.isAuthenticated();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
      // signing in or out happens on /login, so the navigation follows the route
      this.isLoggedIn = this.authService.isAuthenticated();
      // and the request count, which changes while the visitor is on the products page
      this.quoteCount = this.quoteList.count();
    });

    // Follow the list from then on, too. The counter used to move only on a route change, so adding
    // a product from a card - which does not navigate - left it showing the old number.
    this.quoteList.changes.subscribe(() => {
      this.quoteCount = this.quoteList.count();
    });
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/login']);
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
    setStoredLanguage(language);
    this.shared.setLang(language);
    this.translate.use(language); // Switch the language in ngx-translate
  }

  /**
   * The navigation's search box hands its term to the products page, which owns the searching - one
   * implementation rather than two that drift apart.
   */
  goToSearch(event: Event, term: string): void {
    event.preventDefault();
    const query = (term || '').trim();
    this.router.navigate(['/products'], query ? { queryParams: { q: query } } : {});
  }

  
}
