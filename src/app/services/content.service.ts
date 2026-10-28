import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of, timeout } from 'rxjs';

import { environment } from '../../environments/environment';
import { ServiceOffering } from '../shared/services';

/** The copy the owner has written for one service; an empty field means "keep what the page had". */
export interface ServiceContentRow {
  id: string;
  title_al: string;
  title_en: string;
  description_al: string;
  description_en: string;
  image: string;
  alt_al: string;
  alt_en: string;
  position: string;
  active: string;
}

/**
 * The service copy, asked for once and kept.
 *
 * The public pages fall back to the approved copy that already ships with them: a service the owner
 * has not touched is absent from the answer, and a blank field means "keep the page's own words".
 * Nothing here is allowed to break a page - a failed request is simply an empty set of overrides.
 *
 * Browser only, like the business settings: a build must not reach for the live API.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private rows = new Map<string, ServiceContentRow>();
  /** An explicit order number, or null when the owner has not set one. */
  private order = new Map<string, number | null>();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.http
      .get<{ services: ServiceContentRow[] }>(`${environment.apiUrl}/content/services`)
      .pipe(
        timeout(1500),
        catchError(() => of({ services: [] as ServiceContentRow[] }))
      )
      .subscribe((body) => {
        for (const row of body.services || []) {
          this.rows.set(row.id, row);
          const text = (row.position || '').trim();
          this.order.set(row.id, text === '' ? null : Number(text));
        }
      });
  }

  private row(id: string): ServiceContentRow | undefined {
    return this.rows.get(id);
  }

  /** The owner's title for this language, or the page's own approved words. */
  titleOf(service: ServiceOffering, language: string, fallback: string): string {
    const row = this.row(service.id);
    if (!row) {
      return fallback;
    }
    const value = (language === 'en' ? row.title_en : row.title_al) || '';
    return value.trim() || fallback;
  }

  textOf(service: ServiceOffering, language: string, fallback: string): string {
    const row = this.row(service.id);
    if (!row) {
      return fallback;
    }
    const value = (language === 'en' ? row.description_en : row.description_al) || '';
    return value.trim() || fallback;
  }

  imageOf(service: ServiceOffering): string {
    return (this.row(service.id)?.image || '').trim() || service.image;
  }

  altOf(service: ServiceOffering, language: string, fallback: string): string {
    const row = this.row(service.id);
    if (!row) {
      return fallback;
    }
    const value = (language === 'en' ? row.alt_en : row.alt_al) || '';
    return value.trim() || fallback;
  }

  /** Whether the owner has switched this service off. Untouched services stay visible. */
  isVisible(id: string): boolean {
    return this.rows.get(id)?.active !== '0';
  }

  /** The services in the owner's order, with the hidden ones left out. */
  ordered(services: ServiceOffering[]): ServiceOffering[] {
    const visible = services.filter((service) => this.isVisible(service.id));
    return visible
      .map((service, index) => ({ service, index }))
      .sort((left, right) => {
        const leftOrder = this.order.get(left.service.id) ?? null;
        const rightOrder = this.order.get(right.service.id) ?? null;
        // A service the owner has positioned comes before one they have not; then the numbers; then
        // the order the page shipped with, so a half-arranged list still reads sensibly.
        if (leftOrder !== null && rightOrder !== null) {
          return leftOrder - rightOrder || left.index - right.index;
        }
        if (leftOrder !== null) {
          return -1;
        }
        if (rightOrder !== null) {
          return 1;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.service);
  }
}
