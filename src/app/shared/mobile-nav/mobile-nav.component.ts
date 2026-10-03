import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { fromEvent, Subscription, filter, debounceTime } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { SharedService } from '../../shared.service';
import { AuthService } from '../../services/auth.service';
import { setStoredLanguage } from '../language-storage';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive,TranslateModule],
  templateUrl: './mobile-nav.component.html',
  styleUrls: ['./mobile-nav.component.css']
})
export class MobileNavComponent {
  open = false;
  /** Drives the Login / Logout entry in the sheet. */
  isLoggedIn = false;
  private subs: Subscription[] = [];
  private isBrowser: boolean;

  constructor(private translate: TranslateService,public shared :SharedService ,private router: Router, @Inject(PLATFORM_ID) platformId: Object, private authService: AuthService) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isLoggedIn = this.isBrowser && this.authService.isAuthenticated();
  }

  ngOnInit() {
   
    if (!this.isBrowser) return;

    this.subs.push(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          this.close();
          // signing in or out happens on /login
          this.isLoggedIn = this.authService.isAuthenticated();
        }),

      fromEvent(window, 'resize').pipe(debounceTime(150))
        .subscribe(() => { if (window.innerWidth >= 992) this.close(); })
    );
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.close();
    this.router.navigate(['/login']);
  }

  toggle() {
    if (!this.isBrowser) return;
    this.open = !this.open;
    document.body.classList.toggle('no-scroll', this.open);
  }

  close() {
    if (!this.isBrowser) return;
    if (!this.open) return;
    this.open = false;
    document.body.classList.remove('no-scroll');
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.isBrowser) document.body.classList.remove('no-scroll');
  }  
  
  switchLanguage(language: string) {
    setStoredLanguage(language);
    this.shared.setLang(language);
    this.translate.use(language); // Switch the language in ngx-translate
  }
}
