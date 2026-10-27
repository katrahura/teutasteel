import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AdminSessionService } from '../../../services/admin-session.service';
import { AdminService, SiteSettings } from '../../../services/admin.service';

/**
 * The words on the public site that change without changing the code.
 *
 * Seven of them, in three groups: how to reach the shop, when it is open, and the two sentences about
 * delivery and about what a price includes. An empty field means the page keeps the sentence it already
 * has - which is why nothing has to be copied here before the first change works.
 *
 * Administrator only for the change, because these are the words a customer reads.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.css'],
})
export class AdminSettingsComponent implements OnInit {
  private admin = inject(AdminService);
  private session = inject(AdminSessionService);

  /** An editor may read these and may not change them: the form is rendered read-only, not disabled
      behind an error they would only discover by pressing Save. */
  canWrite = false;

  values: SiteSettings = {
    contact_phone: '', contact_whatsapp: '', contact_email: '', contact_address: '',
    opening_hours: '', delivery_text: '', vat_text: '',
  };
  loading = true;
  denied = false;
  failed = false;
  saving = false;
  saved = false;
  errorMessage = '';

  ngOnInit(): void {
    this.session.me().subscribe({
      next: (answer) => {
        this.canWrite = (answer.capabilities || []).indexOf('settings.write') !== -1;
      },
      error: () => { this.canWrite = false; },
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.admin.getSettings().subscribe({
      next: (body) => {
        this.values = { ...this.values, ...(body.settings || {}) };
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

  save(): void {
    if (this.saving || !this.canWrite) {
      return;
    }
    this.saving = true;
    this.saved = false;
    this.errorMessage = '';
    this.admin.saveSettings({ ...this.values }).subscribe({
      next: (body) => {
        this.saving = false;
        this.saved = true;
        this.values = { ...this.values, ...(body.settings || {}) };
      },
      error: (error) => {
        this.saving = false;
        const status = error && error.status;
        this.errorMessage = status === 401 || status === 403 ? 'ADMIN.NOT_ALLOWED' : 'ADMIN.TABLE_FAILED';
      },
    });
  }
}