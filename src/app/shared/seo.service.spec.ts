import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { SeoService } from './seo.service';
import { provideTestConfig } from '../testing/test-providers';
import { environment } from '../../environments/environment';

describe('SeoService', () => {
  let service: SeoService;
  let translate: TranslateService;
  let document: Document;
  let events: Subject<unknown>;

  const translations = {
    al: {
      SEO: {
        HOME_TITLE: 'Kryefaqja | TeutaSteel',
        HOME_DESCRIPTION: 'Përshkrim kryefaqe',
        PRODUCTS_TITLE: 'Produkte | TeutaSteel',
        PRODUCTS_DESCRIPTION: 'Përshkrim produkte',
        ABOUT_TITLE: 'Rreth Nesh | TeutaSteel',
        ABOUT_DESCRIPTION: 'Përshkrim rreth nesh',
        CONTACT_TITLE: 'Kontakt | TeutaSteel',
        CONTACT_DESCRIPTION: 'Përshkrim kontakt',
        PRIVATE_TITLE: 'TeutaSteel',
      },
    },
    en: {
      SEO: {
        HOME_TITLE: 'Home | TeutaSteel',
        HOME_DESCRIPTION: 'Home description',
        PRODUCTS_TITLE: 'Products | TeutaSteel',
        PRODUCTS_DESCRIPTION: 'Products description',
        ABOUT_TITLE: 'About | TeutaSteel',
        ABOUT_DESCRIPTION: 'About description',
        CONTACT_TITLE: 'Contact | TeutaSteel',
        CONTACT_DESCRIPTION: 'Contact description',
        PRIVATE_TITLE: 'TeutaSteel',
      },
    },
  };

  beforeEach(() => {
    events = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        provideTestConfig(),
        {
          provide: Router,
          useValue: { events: events.asObservable(), navigate: () => Promise.resolve(true) },
        },
      ],
    });

    translate = TestBed.inject(TranslateService);
    translate.setTranslation('al', translations.al, true);
    translate.setTranslation('en', translations.en, true);
    translate.use('al');

    document = TestBed.inject(DOCUMENT);
    document.head.querySelector('link[rel="canonical"]')?.remove();
    service = TestBed.inject(SeoService);
  });

  function navigate(url: string): void {
    events.next(new NavigationEnd(1, url, url));
  }

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('gives each public page its own title, description and canonical', () => {
    // Regression: every prerendered page carried the same canonical pointing at
    // the home page, which says /products and the rest are duplicates of /.
    navigate('/products');

    expect(TestBed.inject(Title).getTitle()).toBe('Produkte | TeutaSteel');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${environment.siteUrl}/products`);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Përshkrim produkte');
  });

  it('keeps exactly one canonical link', () => {
    navigate('/');
    navigate('/contact');
    navigate('/about');

    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${environment.siteUrl}/about`);
  });

  it('leaves private pages without a canonical', () => {
    navigate('/products');
    navigate('/login');

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('TeutaSteel');
  });

  it('follows the language, including the html lang attribute', () => {
    navigate('/');
    expect(document.documentElement.lang).toBe('sq');

    translate.use('en');

    expect(TestBed.inject(Title).getTitle()).toBe('Home | TeutaSteel');
    expect(document.documentElement.lang).toBe('en');
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe(`${environment.siteUrl}/`);
  });

  it('ignores query strings when working out the page', () => {
    navigate('/products?page=2');

    expect(TestBed.inject(Title).getTitle()).toBe('Produkte | TeutaSteel');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${environment.siteUrl}/products`);
  });
});
