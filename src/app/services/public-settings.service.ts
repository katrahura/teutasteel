import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, shareReplay } from 'rxjs';

import { environment } from '../../environments/environment';

/** The business settings a customer may read. Never a user, a credential or admin configuration. */
export interface PublicSettings {
  contact_phone: string;
  contact_whatsapp: string;
  contact_email: string;
  contact_address: string;
  opening_hours: string;
  delivery_text: string;
  vat_text: string;
}

/**
 * Asked once, remembered, and never allowed to break the page.
 *
 * Every field falls back to the text the page already has: a shop whose settings call fails must still
 * show a phone number, and a field the owner has not filled in must mean "keep what you had", not
 * "show nothing". The fallback is passed in by the caller, because only the caller knows the word.
 */
@Injectable({ providedIn: 'root' })
export class PublicSettingsService {
  private http = inject(HttpClient);
  private cached: Observable<Partial<PublicSettings>> | null = null;

  /** All of them, or an empty object if the request fails - never an error the page has to catch. */
  all(): Observable<Partial<PublicSettings>> {
    if (!this.cached) {
      this.cached = this.http
        .get<{ settings: PublicSettings }>(`${environment.apiUrl}/settings`)
        .pipe(
          map((body) => body.settings || {}),
          shareReplay(1)
        );
    }
    return this.cached;
  }

  /** One field, or the caller's own text when the setting is blank or could not be read. */
  field(key: keyof PublicSettings, fallback: string): Observable<string> {
    return this.all().pipe(map((settings) => (settings[key] || '').trim() || fallback));
  }
}
