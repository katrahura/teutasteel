import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminSessionService } from '../../services/admin-session.service';
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
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .admin-shell { max-width: 1180px; }
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

  ngOnInit(): void {
    this.session.me().subscribe({ error: () => undefined });
  }

  can(capability: string): boolean {
    return this.session.can(capability);
  }
}
