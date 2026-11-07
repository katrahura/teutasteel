import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { SERVICES } from './services';
import { environment } from '../../environments/environment';

/** What each public page claims to be. */
interface PageSeo {
  titleKey: string;
  descriptionKey: string;
  /**
   * Kept out of search engines. For a page that exists and is linked, but has nothing real on it
   * yet: the gallery of samples is the case this was added for.
   */
  noindex?: boolean;
}

const PUBLIC_PAGES: Record<string, PageSeo> = {
  '/404': {titleKey:'IMPROVE.NOT_FOUND',descriptionKey:'IMPROVE.NOT_FOUND_HELP',noindex:true},
  '/': { titleKey: 'SEO.HOME_TITLE', descriptionKey: 'SEO.HOME_DESCRIPTION' },
  '/request': { titleKey: 'SEO.REQUEST_TITLE', descriptionKey: 'SEO.REQUEST_DESCRIPTION', noindex: true },
  '/products': { titleKey: 'SEO.PRODUCTS_TITLE', descriptionKey: 'SEO.PRODUCTS_DESCRIPTION' },
  '/services': { titleKey: 'SEO.SERVICES_TITLE', descriptionKey: 'SEO.SERVICES_DESCRIPTION' },
  '/guides': { titleKey: 'SEO.GUIDES_TITLE', descriptionKey: 'SEO.GUIDES_DESCRIPTION' },
  // The entries are examples, so no search engine should be led here. It still names itself, for
  // anybody who is sent the link; it simply asks not to be listed.
  '/projects': {
    titleKey: 'SEO.PROJECTS_TITLE',
    descriptionKey: 'SEO.PROJECTS_DESCRIPTION',
    noindex: true,
  },
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
  private currentQuery = '';

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
        const full = (event as NavigationEnd).urlAfterRedirects;
        const queryAt = full.indexOf('?');
        this.currentPath = (queryAt >= 0 ? full.slice(0, queryAt) : full).split('#')[0];
        this.currentQuery = queryAt >= 0 ? full.slice(queryAt).split('#')[0] : '';
        this.apply();
      });

    this.translate.onLangChange.subscribe(() => this.apply());
  }

  /** Applies the head values for the current route in the current language. */
  apply(): void {
    const serviceId = /^\/services\/([^/]+)$/.exec(this.currentPath)?.[1];
    const service = SERVICES.find(item => item.id === serviceId);
    const page = service ? { titleKey: service.titleKey, descriptionKey: service.textKey } : PUBLIC_PAGES[this.currentPath];
    const language = this.translate.currentLang || this.translate.getDefaultLang() || 'al';

    this.document.documentElement.lang = HTML_LANG[language] ?? 'sq';

    if (!page) {
      // login and the dashboards: no canonical, and a title that is not a promise
      // about content a crawler cannot see anyway
      this.setCanonical(null);
      this.setRobots('noindex, nofollow');
      this.setHead('SEO.PRIVATE_TITLE', 'SEO.PRIVATE_DESCRIPTION', null);
      return;
    }

    const base = environment.siteUrl.replace(/\/$/, '');
    // The deployed host answers directory routes with a trailing slash; the canonical should name
    // the address that actually returns 200, not the one that redirects to it.
    const path = this.currentPath === '/' ? '/' : `${this.currentPath.replace(/\/+$/, '')}/`;
    const query = this.canonicalQuery();
    const url = `${base}${path}${query}`;
    // A page that asks not to be indexed has no use for a canonical, and the two together would
    // contradict each other.
    this.setRobots(page.noindex ? 'noindex, nofollow' : null);
    this.setCanonical(page.noindex ? null : url);
    this.setHead(page.titleKey, page.descriptionKey, url);
  }

  /**
   * Keeps the product/category part of the address, and drops everything else.
   *
   * `/products?product=2166` and `/products?category=113` are distinct, shareable pages; without
   * this, every one of them carried the same canonical (`/products`) and told a search engine they
   * were duplicates. Search terms, page numbers and edit parameters are not canonical pages.
   */
  private canonicalQuery(): string {
    if (!this.currentQuery) return '';
    const incoming = new URLSearchParams(this.currentQuery);
    const ordered = new URLSearchParams();
    const product = incoming.get('product');
    const category = incoming.get('category');
    // The category is where the visitor came from, not a second product page. Canonicalising every
    // product to its own `?product=` address keeps the sitemap entry and the dialog's share link the
    // same page; only a pure category listing uses `?category=`.
    if (product) ordered.set('product', product);
    else if (category) ordered.set('category', category);
    const value = ordered.toString();
    return value ? `?${value}` : '';
  }

  private setRobots(content: string | null): void {
    if (environment.siteUrl.includes('test.teutasteel.com')) content = 'noindex, nofollow, noarchive';
    const existing = this.document.head.querySelector('meta[name="robots"]');
    if (!content) {
      // Removed rather than left behind: a page that asked not to be indexed would otherwise mark
      // every page visited after it.
      existing?.remove();
      return;
    }
    if (existing) {
      existing.setAttribute('content', content);
      return;
    }
    const meta = this.document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', content);
    this.document.head.appendChild(meta);
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
