import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** What each public page claims to be. */
interface PageSeo {
  titleKey: string;
  descriptionKey: string;
}

const PUBLIC_PAGES: Record<string, PageSeo> = {
  '/': { titleKey: 'SEO.HOME_TITLE', descriptionKey: 'SEO.HOME_DESCRIPTION' },
  '/products': { titleKey: 'SEO.PRODUCTS_TITLE', descriptionKey: 'SEO.PRODUCTS_DESCRIPTION' },
  '/about': { titleKey: 'SEO.ABOUT_TITLE', descriptionKey: 'SEO.ABOUT_DESCRIPTION' },
  '/contact': { titleKey: 'SEO.CONTACT_TITLE', descriptionKey: 'SEO.CONTACT_DESCRIPTION' },
};

/** The i18n codes are the app's own; `lang` wants the ISO 639-1 code. */
const HTML_LANG: Record<string, string> = { al: 'sq', en: 'en' };

/**
 * Keeps the document head in step with the route and the language.
 *
 * Every prerendered page used to carry the same title and, worse, the same
 * `rel="canonical"` pointing at the home page — which tells a search engine that
 * /products, /about and /contact are duplicates of `/`. Each public page now names
 * itself, private pages carry no canonical at all (robots.txt excludes them), and
 * `<html lang>` follows the language the visitor selected instead of staying on
 * Albanian.
 *
 * Runs during prerendering too: the values are written into each prerendered file.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private currentPath = '/';

  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta,
    private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath = (event as NavigationEnd).urlAfterRedirects.split('?')[0].split('#')[0];
        this.apply();
      });

    this.translate.onLangChange.subscribe(() => this.apply());
  }

  /** Applies the head values for the current route in the current language. */
  apply(): void {
    const page = PUBLIC_PAGES[this.currentPath];
    const language = this.translate.currentLang || this.translate.getDefaultLang() || 'al';

    this.document.documentElement.lang = HTML_LANG[language] ?? 'sq';

    if (!page) {
      // login and the dashboards: no canonical, and a title that is not a promise
      // about content a crawler cannot see anyway
      this.setCanonical(null);
      this.setHead('SEO.PRIVATE_TITLE', 'SEO.PRIVATE_DESCRIPTION', null);
      return;
    }

    const base = environment.siteUrl.replace(/\/$/, '');
    const url = this.currentPath === '/' ? `${base}/` : `${base}${this.currentPath}`;
    this.setCanonical(url);
    this.setHead(page.titleKey, page.descriptionKey, url);
  }

  private setCanonical(url: string | null): void {
    const existing = this.document.head.querySelector('link[rel="canonical"]');
    if (!url) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.setAttribute('href', url);
      return;
    }
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', url);
    this.document.head.appendChild(link);
  }

  private setHead(titleKey: string, descriptionKey: string | null, url: string | null): void {
    if (url) {
      this.meta.updateTag({ property: 'og:url', content: url });
    }

    // Read the loaded table rather than asking translate to fetch: on a fresh
    // client the language file arrives over HTTP, and get()/instant() answer with
    // the key itself until it does - which overwrote the correct title that the
    // prerendered page already had. onLangChange fires once the file is in, so the
    // text is filled in then.
    const title = this.translateValue(titleKey);
    const description = descriptionKey ? this.translateValue(descriptionKey) : null;
    if (!title) {
      return;
    }

    this.title.setTitle(title);
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ name: 'twitter:title', content: title });

    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
  }

  /** A translated value, or null while the language file has not loaded yet. */
  private translateValue(key: string): string | null {
    const language = this.translate.currentLang || this.translate.getDefaultLang();
    const tables = this.translate.translations as Record<string, Record<string, unknown>>;
    const [section, leaf] = key.split('.');
    const value = tables?.[language]?.[section] as Record<string, unknown> | undefined;
    const text = value?.[leaf];
    return typeof text === 'string' && text.length > 0 ? text : null;
  }
}
