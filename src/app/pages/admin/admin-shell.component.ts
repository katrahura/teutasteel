import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminMe } from '../../services/admin.service';
import { AdminSessionService } from '../../services/admin-session.service';
import { SharedService } from '../../shared.service';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The administrator's area: one place, with tabs.
 *
 * The panel used to be a single page, and everything else was reached by going back to the public
 * catalogue - which is the thing the owner should not have to do to maintain it. Only Përmbledhja
 * and Produktet are real so far. Kategoritë, Media and Cilësimet are named and marked as coming
 * rather than left as links that lead nowhere: a tab that opens an empty page is worse than a tab
 * that says when it will work.
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
          <button type="button" [class.on]="shared.lang === 'al'" (click)="shared.setLang('al')">AL</button>
          <button type="button" [class.on]="shared.lang === 'en'" (click)="shared.setLang('en')">EN</button>
        </span>
        <a class="view-site" routerLink="/">{{ 'ADMIN.VIEW_SITE' | translate }}</a>
      </span>
    </header>

    <!-- One source for the navigation, rendered twice: a strip on a desk and a drawer on a phone.
         Two copies of six links is how a phone loses the tab somebody added to the desk. -->
    <ng-template #adminTabs>
      <nav class="admin-tabs" [attr.aria-label]="'ADMIN.NAV' | translate">
          <ng-container *ngIf="can('products.read')">
          <a routerLink="/admin/overview" routerLinkActive="active">
            {{ 'ADMIN.NAV_OVERVIEW' | translate }}
          </a>
          </ng-container>
          <ng-container *ngIf="can('products.read')">
          <a routerLink="/admin/products" routerLinkActive="active">
            {{ 'ADMIN.NAV_PRODUCTS' | translate }}
          </a>
          </ng-container>
          <ng-container *ngIf="can('users.manage')">
          <a routerLink="/admin/users" routerLinkActive="active">
            {{ 'ADMIN.NAV_USERS' | translate }}
          </a>
          </ng-container>
          <ng-container *ngIf="can('categories.read')">
          <a routerLink="/admin/categories" routerLinkActive="active">
            {{ 'ADMIN.NAV_CATEGORIES' | translate }}
          </a>
          </ng-container>
          <ng-container *ngIf="can('media.upload')">
          <a routerLink="/admin/media" routerLinkActive="active">
            {{ 'ADMIN.NAV_MEDIA' | translate }}
          </a>
          </ng-container>
          <ng-container *ngIf="can('settings.read')">
          <a routerLink="/admin/settings" routerLinkActive="active">
            {{ 'ADMIN.NAV_SETTINGS' | translate }}
          </a>
          </ng-container>
        </nav>
    </ng-template>

    <ng-container *ngTemplateOutlet="adminTabs"></ng-container>

    <details class="admin-drawer">
      <summary>{{ 'ADMIN.NAV' | translate }}</summary>
      <ng-container *ngTemplateOutlet="adminTabs"></ng-container>
    </details>
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

  /* Three hundred and twenty pixels is the width the brief names. The tabs wrap onto more lines
     instead of the page growing a horizontal scrollbar: no fixed widths, no nowrap. */
  @media (max-width: 520px) {
    .admin-tabs { flex-wrap: wrap; gap: 6px; }
    .admin-tabs a, .admin-tabs .soon { flex: 1 1 auto; text-align: center; min-height: 44px; }
  }

  .admin-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;
      }
      .admin-tabs a,
      .admin-tabs .soon {
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        color: #334155;
      }
      .admin-tabs a:hover { background: #f1f5f9; }
      .admin-tabs a.active { background: #0f172a; color: #fff; }
      /* Named, and visibly not there yet: a dead link teaches people to stop reading the tabs. */
      .admin-tabs .soon {
        color: #94a3b8;
        cursor: not-allowed;
        border: 1px dashed #e2e8f0;
      }
      .admin-tabs a:focus-visible {
        outline: 3px solid #f59e0b;
        outline-offset: 2px;
      }
    `,
  ],
})
export class AdminShellComponent {
  /**
   * What the server says this account may reach. A tab that is not allowed is not shown at all: a greyed
   * tab in a panel the owner reaches by signing in teaches nobody anything, and the sentence it would
   * need ("only an administrator") lives on the page it refuses.
   */
  private session = inject(AdminSessionService);

  /** The same language state the customer pages use: one service, one answer. */
  shared = inject(SharedService);

  /** The signed-in account, as the server described it. Null until the answer arrives. */
  me: AdminMe | null = null;

  ngOnInit(): void {
    this.session.me().subscribe({
      next: (answer) => { this.me = answer; },
      error: () => { this.me = null; },
    });
  }

  can(capability: string): boolean {
    return this.session.can(capability);
  }
}
