import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AdminService, ServiceContentRow } from '../../../services/admin.service';
import { AdminSessionService } from '../../../services/admin-session.service';
import { confirmUnsaved } from '../../../shared/unsaved-work';
import { environment } from '../../../../environments/environment';

/**
 * The words on the services pages.
 *
 * Seven services, the ids the quote form already uses, and the fields the owner may change: a title
 * and a description in each language, a picture and its alt text, the order and whether it shows.
 * A blank field is not saved as an empty service - it means "keep the copy the page already has",
 * which is what makes this a migration rather than a rewrite.
 *
 * A placeholder is not invented here: the approved copy ships with the page and remains the fallback.
 */
@Component({
  selector: 'app-admin-content',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterModule],
  templateUrl: './admin-content.component.html',
  styleUrls: ['./admin-content.component.css'],
})
export class AdminContentComponent implements OnInit {
  private admin = inject(AdminService);
  private session = inject(AdminSessionService);

  private snapshots = new Map<string, string>();
  get dirty(): boolean { return this.rows.some(row => JSON.stringify(row) !== this.snapshots.get(row.id)); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } }
  canLeave(): boolean { return !this.saving && confirmUnsaved(this.dirty); }
  rows: ServiceContentRow[] = [];
  loading = true;
  failed = false;
  denied = false;
  canWrite = false;
  saving: string | null = null;
  saved: string | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.canWrite = this.session.can('settings.write');
    if (!this.canWrite) {
      this.session.me().subscribe({
        next: () => { this.canWrite = this.session.can('settings.write'); },
        error: () => { this.canWrite = false; },
      });
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.admin.getServiceContent().subscribe({
      next: (body) => {
        this.rows = body.services || [];
        this.snapshots = new Map(this.rows.map(row => [row.id, JSON.stringify(row)]));
        this.loading = false;
      },
      error: (error) => {
        const status = error && error.status;
        this.denied = status === 401 || status === 403;
        this.failed = !this.denied;
        this.loading = false;
      },
    });
  }

  save(row: ServiceContentRow): void {
    if (!this.canWrite || this.saving) {
      return;
    }
    this.saving = row.id;
    this.saved = null;
    this.errorMessage = '';
    this.admin.saveServiceContent([row]).subscribe({
      next: (body) => {
        this.saving = null;
        this.saved = row.id;
        const fresh = (body.services || []).find((item) => item.id === row.id);
        if (fresh) {
          Object.assign(row, fresh);
          this.snapshots.set(row.id, JSON.stringify(row));
        }
      },
      error: (error) => {
        this.saving = null;
        const status = error && error.status;
        this.errorMessage = status === 401 || status === 403
          ? 'ADMIN.NOT_ALLOWED'
          : 'ADMIN.TABLE_FAILED';
      },
    });
  }

  /** Where a customer would see this service. */
  preview(id: string): string {
    return `${(environment.siteUrl || '').replace(/\/$/, '')}/services/${id}`;
  }
}
