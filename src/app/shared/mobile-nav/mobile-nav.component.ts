import { ChangeDetectorRef, Component, ElementRef, HostListener, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { fromEvent, Subscription, filter, debounceTime } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { SharedService } from '../../shared.service';
import { AuthService } from '../../services/auth.service';
import { setStoredLanguage } from '../language-storage';
import { environment } from '../../../environments/environment';

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
  /** The contact details in the sheet's footer, from the environment like the contact page. */
  readonly phone = environment.phone;
  readonly phoneDisplay = environment.phoneDisplay;
  readonly email = environment.contactEmail;
  private subs: Subscription[] = [];
  private isBrowser: boolean;

  @ViewChild('toggleButton') private toggleButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  constructor(private translate: TranslateService,public shared :SharedService ,private router: Router, @Inject(PLATFORM_ID) platformId: Object, private authService: AuthService, private changeDetector: ChangeDetectorRef, private host: ElementRef<HTMLElement>) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isLoggedIn = this.isBrowser && this.authService.isAuthenticated();
  }

  /**
   * The two controls the drawer moves focus between.
   *
   * Looked up in the host element rather than held as ViewChild references: those
   * resolved to undefined here, which silently skipped the focus calls.
   */
  private closeControl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.mnav-close');
  }

  private toggleControl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.mnav-toggle');
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
    if (this.open) {
      this.focusIntoDrawer();
    } else {
      this.toggleControl()?.focus();
    }
  }

  /**
   * Move focus onto the drawer's close button.
   *
   * Angular applies the `[attr.inert]` binding in a change-detection pass *after*
   * the frame this click handler runs in - measured: the attribute is still on the
   * sheet one frame later, and focusing an inert element silently does nothing. So
   * this waits for the attribute to actually be gone, a frame at a time, instead of
   * guessing at a delay.
   */
  private focusIntoDrawer(attempt = 0): void {
    if (!this.open) return;
    const sheet = this.host.nativeElement.querySelector('.mnav-sheet');
    const control = this.closeControl();
    if (control && (!sheet || !sheet.hasAttribute('inert'))) {
      control.focus();
      if (document.activeElement === control) return;
    }
    if (attempt < 10) {
      requestAnimationFrame(() => this.focusIntoDrawer(attempt + 1));
    }
  }

  close() {
    if (!this.isBrowser) return;
    if (!this.open) return;
    this.open = false;
    document.body.classList.remove('no-scroll');
    // closing takes the focused links out of the document, so put focus back
    this.toggleControl()?.focus();
  }

  /** Escape closes the drawer, as it would any other dialog. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
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
