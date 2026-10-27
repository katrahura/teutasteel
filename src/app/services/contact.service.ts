import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../environments/environment';
import { PublicSettings, PublicSettingsService } from './public-settings.service';

/**
 * The shop's own details, as a customer page should show them.
 *
 * One place for the settings, the environment defaults and the small amount of arithmetic between
 * what the owner typed and what a telephone has to dial. Every method answers with the saved value
 * when there is one, the built-in value when there is not, and never with an error: a shop whose
 * settings request failed is still a shop with a phone number.
 *
 * The values are read through methods rather than copied into fields, so a page that is already
 * rendered picks up the answer when it arrives without each component remembering to subscribe.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private settings = inject(PublicSettingsService);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);

  private stored: Partial<PublicSettings> = {};

  /** True once an answer has arrived, even an empty one. False while waiting or after a failure. */
  readonly loaded = new BehaviorSubject<boolean>(false);

  constructor() {
    // The browser asks, and only the browser: prerendering is what writes the pages out during a
    // build, and a build that reaches for the shop's live API is a build that fails on a train.
    // The prerendered page carries the built-in details; the same page asks for the saved ones as
    // soon as it runs, which is why a changed number does not have to wait for a rebuild.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // The request itself is made once and cached by PublicSettingsService; this subscription is the
    // one copy of the answer the whole site reads.
    this.settings.all().subscribe({
      next: (answer) => {
        this.stored = answer || {};
        this.loaded.next(true);
      },
      error: () => {
        this.stored = {};
        this.loaded.next(false);
      },
    });
  }

  private value(key: keyof PublicSettings): string {
    return (this.stored[key] || '').trim();
  }

  /** The language the page is being read in, as ngx-translate knows it. */
  private language(): string {
    return this.translate.currentLang === 'en' ? 'en' : 'al';
  }

  /**
   * A sentence the owner may have written in either language: the one for the page being read
   * first, then the neutral value saved before the pair existed, then nothing.
   *
   * Nothing means "the page keeps its own words", which the template decides with a translate pipe
   * or an `*ngIf` - the service does not guess a sentence.
   */
  private sentence(key: 'opening_hours' | 'delivery_text' | 'vat_text'): string {
    return this.value(`${key}_${this.language()}` as keyof PublicSettings) || this.value(key);
  }

  /** What the customer reads. Keeps the spacing the owner typed, which is how a number reads well. */
  phoneDisplay(): string {
    return this.value('contact_phone') || environment.phoneDisplay;
  }

  /** What the telephone dials: the digits of the displayed number, with the + kept if it had one. */
  phoneDial(): string {
    return telNumber(this.phoneDisplay(), environment.phone);
  }

  whatsappDisplay(): string {
    return this.value('contact_whatsapp') || environment.whatsappDisplay;
  }

  /** What wa.me expects: digits only, no plus - it rejects one. */
  whatsappNumber(): string {
    return whatsappNumber(this.whatsappDisplay(), environment.whatsappNumber);
  }

  whatsappLink(): string {
    return 'https://wa.me/' + this.whatsappNumber();
  }

  email(): string {
    return this.value('contact_email') || environment.contactEmail;
  }

  /** The address as the owner wrote it, or the structured one the site was built with. */
  address(): string {
    return this.value('contact_address') || this.builtInAddress();
  }

  private builtInAddress(): string {
    const place = environment.location;
    return `${place.street} ${place.number}, ${place.city}`;
  }

  /** The saved hours for this language, or '' so the caller keeps its own translated line. */
  hours(): string {
    return this.sentence('opening_hours');
  }

  /** The owner's delivery sentence, or '' - there is no built-in delivery promise to fall back to. */
  deliveryText(): string {
    return this.sentence('delivery_text');
  }

  /** The owner's sentence about what a price includes, or ''. */
  vatText(): string {
    return this.sentence('vat_text');
  }
}

/**
 * A number a telephone can dial, from a number a person wrote.
 *
 * Kept separate and exported so a spec can prove it: "+383 (44) 133-208" becomes "+38344133208",
 * "00383 44 133 208" becomes "+38344133208", and a number with no country code stays as it was typed
 * rather than being given a plus it never had.
 */
export function telNumber(display: string, fallback: string): string {
  const raw = (display || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return fallback;
  }
  if (raw.startsWith('+')) {
    return '+' + digits;
  }
  if (digits.startsWith('00')) {
    return '+' + digits.slice(2);
  }
  return digits;
}

/** wa.me's shape of a number: digits, no plus, no leading 00. */
export function whatsappNumber(display: string, fallback: string): string {
  const digits = (display || '').replace(/\D/g, '');
  if (!digits) {
    return fallback;
  }
  return digits.replace(/^00/, '');
}
