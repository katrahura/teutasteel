import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminMe } from '../../services/admin.service';
import { AdminSessionService } from '../../services/admin-session.service';
import { SharedService } from '../../shared.service';
import { setStoredLanguage } from '../../shared/language-storage';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * The administrator's area: one place, with tabs.
 *
 * The tabs are the capabilities the server said this account has. A tab that is not allowed is not
 * shown at all: a greyed tab in a panel the owner reaches by signing in teaches nobody anything.
 *
 * On a phone the same single navigation becomes a panel behind one button. It is one element, not a
 * second copy rendered from a template: the failure this replaces was a drawer that stayed visible
 * beside the strip at 1440px, drawing the navigation twice. With one element, `display` is the only
 * thing that can show it, and there is nothing to duplicate.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="container admin-shell pt-3">
      <!-- Who you are, and the way out to the website. A panel reached by signing in should say whose
         panel it is; the role is the server's word, not the browser's. -->
    <header class="admin-bar">
      <p class="who" *ngIf="me">
        <strong>{{ me.username }}</strong>
        <span class="role">{{ me.role }}</span>
      </p>
      <p class="who" *ngIf="!me">{{ 'ADMIN.LOADING' | translate }}</p>
      <span class="bar-right">
        <span class="lang" role="group" [attr.aria-label]="'ADMIN.LANGUAGE' | translate">
          <button type="button" [class.on]="shared.lang === 'al'" (click)="switchLanguage('al')">AL</button>
          <button type="button" [class.on]="shared.lang === 'en'" (click)="switchLanguage('en')">EN</button>
        </span>
        <a class="view-site" routerLink="/">{{ 'ADMIN.VIEW_SITE' | translate }}</a>
        <!-- Only on a phone; the navigation below is the same one, shown or hidden. -->
        <button #menuButton type="button" class="menu-toggle"
                aria-controls="admin-navigation" [attr.aria-expanded]="menuOpen"
                (click)="toggleMenu()">
          <span aria-hidden="true">{{ menuOpen ? '×' : '☰' }}</span>
          {{ 'ADMIN.MENU' | translate }}
        </button>
      </span>
    </header>

    <nav #menuPanel id="admin-navigation" class="admin-tabs" [class.open]="menuOpen"
         [attr.aria-label]="'ADMIN.NAV' | translate">
        <ng-container *ngIf="can('products.read')">
        <a routerLink="/admin/overview" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_OVERVIEW' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('products.read')">
        <a routerLink="/admin/products" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_PRODUCTS' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('users.manage')">
        <a routerLink="/admin/users" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_USERS' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('categories.read')">
        <a routerLink="/admin/categories" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_CATEGORIES' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('media.upload')">
        <a routerLink="/admin/media" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_MEDIA' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('settings.read')">
        <a routerLink="/admin/content" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_CONTENT' | translate }}
        </a>
        </ng-container>
        <ng-container *ngIf="can('settings.read')">
        <a routerLink="/admin/settings" routerLinkActive="active" (click)="closeMenu()">
          {{ 'ADMIN.NAV_SETTINGS' | translate }}
        </a>
        </ng-container>
      </nav>
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .admin-shell { max-width: 1180px; }
      .admin-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .admin-bar .who {
    margin: 0;
    font-size: 13px;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .admin-bar .who strong { font-weight: 800; }
  .admin-bar .role {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .04em;
    background: #eef2f7;
    border-radius: 20px;
    padding: 2px 8px;
    color: #475569;
  }
  .admin-bar .view-site {
    font-size: 13px;
    font-weight: 700;
    color: #0a58ca;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .admin-bar .bar-right { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .admin-bar .lang { display: inline-flex; gap: 2px; }
  .admin-bar .lang button {
    min-height: 44px; min-width: 40px; border: 1px solid #cbd5e1; background: #fff;
    color: #334155; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer;
  }
  .admin-bar .lang button.on { background: #0f172a; border-color: #0f172a; color: #fff; }
  .admin-bar .lang button:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }

  /* The phone button is the only thing that shows the panel below 520px. */
  .menu-toggle {
    display: none;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .menu-toggle:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }

  .admin-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;
      }
      .admin-tabs a {
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        color: #334155;
      }
      .admin-tabs a:hover { background: #f1f5f9; }
      .admin-tabs a.active { background: #0f172a; color: #fff; }
      .admin-tabs a:focus-visible {
        outline: 3px solid #f59e0b;
        outline-offset: 2px;
      }

  /* Below 520px the strip is the drawer. Hidden until the button opens it, and then a column of
     44px rows - the width the brief names, with no page-wide horizontal scrolling. */
  @media (max-width: 520px) {
    .menu-toggle { display: inline-flex; }
    .admin-tabs { display: none; }
    .admin-tabs.open {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      padding-top: 6px;
    }
    .admin-tabs a { min-height: 44px; display: flex; align-items: center; }
  }
    `,
  ],
})
export class AdminShellComponent {
  private session = inject(AdminSessionService);

  /** The same language state the customer pages use: one service, one answer. */
  shared = inject(SharedService);
  private translate = inject(TranslateService);
  switchLanguage(language: 'al' | 'en'): void {
    setStoredLanguage(language);
    this.shared.setLang(language);
    this.translate.use(language);
  }

  /** The signed-in account, as the server described it. Null until the answer arrives. */
  me: AdminMe | null = null;

  /** Whether the phone panel is open. The CSS decides whether the button or the strip is shown. */
  menuOpen = false;

  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('menuPanel') menuPanel?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.session.me().subscribe({
      next: (answer) => { this.me = answer; },
      error: () => { this.me = null; },
    });
  }

  can(capability: string): boolean {
    return this.session.can(capability);
  }

  toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    this.menuOpen = true;
    // The panel is rendered but hidden; move the keyboard to where the eye went.
    setTimeout(() => this.menuPanel?.nativeElement.querySelector<HTMLElement>('a')?.focus());
  }

  /** After a tab is chosen the panel has done its job, whether or not the route changes. */
  closeMenu(): void {
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.menuOpen) {
      return;
    }
    this.closeMenu();
    this.menuButton?.nativeElement.focus();
  }
}
