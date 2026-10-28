import { confirmUnsaved } from '../../../shared/unsaved-work';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AdminSessionService } from '../../../services/admin-session.service';
import { AdminService, SiteSettings } from '../../../services/admin.service';

/** The three sentences that exist once per language, and the single value saved before the pair. */
const PAIRED = ['opening_hours', 'delivery_text', 'vat_text'] as const;

/** The longest value each box accepts, matching the server's limits so a typo is caught before a round trip. */
const LIMITS: Record<string, number> = {
  contact_phone: 60,
  contact_whatsapp: 60,
  contact_email: 254,
  contact_address: 400,
  opening_hours_al: 300,
  opening_hours_en: 300,
  delivery_text_al: 2000,
  delivery_text_en: 2000,
  vat_text_al: 2000,
  vat_text_en: 2000,
};

function emptySettings(): SiteSettings {
  return {
    contact_phone: '', contact_whatsapp: '', contact_email: '', contact_address: '',
    opening_hours: '', delivery_text: '', vat_text: '',
    opening_hours_al: '', opening_hours_en: '',
    delivery_text_al: '', delivery_text_en: '',
    vat_text_al: '', vat_text_en: '',
  };
}

/**
 * The words on the public site that change without changing the code.
 *
 * The contact details, and three sentences in each language: when the shop is open, how delivery
 * works, and what a price includes. An empty field means the page keeps the text it already has -
 * which is why nothing has to be copied here before the first change works.
 *
 * Administrator only for the change, because these are the words a customer reads. An editor reads
 * the same page without a Save button, rather than pressing one and being refused by the server.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.css'],
})
export class AdminSettingsComponent implements OnInit {
  private admin = inject(AdminService);
  private session = inject(AdminSessionService);

  /** An editor may read these and may not change them. */
  canWrite = false;

  values: SiteSettings = emptySettings();
  /** What the server last answered, so "unsaved" means unsaved and not merely "different from empty". */
  private loaded: SiteSettings = emptySettings();

  /** Refused boxes, by field name, with the server's reason or the one found here before sending. */
  fieldErrors: Record<string, string> = {};

  loading = true;
  denied = false;
  failed = false;
  saving = false;
  saved = false;
  errorMessage = '';

  get dirty(): boolean {
    return JSON.stringify(this.values) !== JSON.stringify(this.loaded);
  }

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
    this.saved = false;
    this.admin.getSettings().subscribe({
      next: (body) => {
        this.adopt(body.settings || {});
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

  /**
   * Take the server's answer into the form.
   *
   * A sentence saved before the two-language pair existed is shown in both boxes, because that is
   * what a customer reads today. Saving it writes the pair and the server drops the old single value,
   * so the shop migrates without anybody retyping anything.
   */
  private adopt(settings: Partial<SiteSettings>): void {
    const values: SiteSettings = { ...emptySettings(), ...settings } as SiteSettings;
    for (const base of PAIRED) {
      const legacy = (settings[base] || '').trim();
      if (!legacy) {
        continue;
      }
      const alKey = `${base}_al` as keyof SiteSettings;
      const enKey = `${base}_en` as keyof SiteSettings;
      if (!(values[alKey] || '').trim()) {
        values[alKey] = legacy;
      }
      if (!(values[enKey] || '').trim()) {
        values[enKey] = legacy;
      }
    }
    this.values = values;
    this.loaded = { ...values };
    this.fieldErrors = {};
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } }
  canLeave(): boolean { return !this.saving && confirmUnsaved(this.dirty); }

  save(): void {
    if (this.saving || !this.canWrite) {
      return;
    }
    this.saved = false;
    this.errorMessage = '';
    this.fieldErrors = this.problems(this.values);
    if (Object.keys(this.fieldErrors).length) {
      return;
    }

    this.saving = true;
    this.admin.saveSettings(this.payload()).subscribe({
      next: (body) => {
        this.saving = false;
        this.saved = true;
        this.adopt(body.settings || {});
      },
      error: (error) => {
        this.saving = false;
        const status = error && error.status;
        const fields = error && error.error && error.error.details && error.error.details.fields;
        if (status === 400 && fields) {
          this.fieldErrors = fields;
          return;
        }
        this.errorMessage = status === 401 || status === 403 ? 'ADMIN.NOT_ALLOWED' : 'ADMIN.TABLE_FAILED';
      },
    });
  }

  /**
   * The boxes to send.
   *
   * A paired sentence is a small migration on its own: both languages written means the pair replaces
   * the old single value; both empty means it is cleared rather than reappearing; one language written
   * keeps the old value as the other language's fallback.
   */
  private payload(): Partial<SiteSettings> {
    const payload: Partial<SiteSettings> = { ...this.values };
    for (const base of PAIRED) {
      const al = (this.values[`${base}_al` as keyof SiteSettings] || '').trim();
      const en = (this.values[`${base}_en` as keyof SiteSettings] || '').trim();
      if (!al && !en) {
        payload[base as keyof SiteSettings] = '';
      } else if (al && en) {
        delete payload[base as keyof SiteSettings];
      }
    }
    return payload;
  }

  /** The same checks the server makes, so the owner is told which box to fix before the round trip. */
  private problems(values: SiteSettings): Record<string, string> {
    const found: Record<string, string> = {};
    const email = (values.contact_email || '').trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s.]+$/.test(email)) {
      found['contact_email'] = 'invalid_email';
    }
    for (const key of ['contact_phone', 'contact_whatsapp'] as const) {
      const value = (values[key] || '').trim();
      if (!value) {
        continue;
      }
      if (!/^[+()\d\s.\-/]+$/.test(value)) {
        found[key] = 'invalid_characters';
      } else {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 6 || digits.length > 15) {
          found[key] = 'invalid_length';
        }
      }
    }
    for (const [key, limit] of Object.entries(LIMITS)) {
      if ((values[key as keyof SiteSettings] || '').length > limit) {
        found[key] = 'too_long';
      }
    }
    return found;
  }

  /** The sentence beside a refused box. */
  messageFor(reason: string): string {
    switch (reason) {
      case 'invalid_email': return 'ADMIN.SETTINGS_INVALID_EMAIL';
      case 'invalid_characters':
      case 'invalid_length': return 'ADMIN.SETTINGS_INVALID_NUMBER';
      case 'too_long': return 'ADMIN.SETTINGS_TOO_LONG';
      default: return 'ADMIN.TABLE_FAILED';
    }
  }
}
