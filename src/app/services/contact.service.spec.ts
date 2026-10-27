import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';

import { ContactService, telNumber, whatsappNumber } from './contact.service';
import { provideTestConfig } from '../testing/test-providers';
import { environment } from '../../environments/environment';

/**
 * The contract every customer page depends on: the saved setting wins, the built-in value is kept
 * when nothing is saved and when the request fails, and a number is dialled by its digits.
 */
describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestConfig()] });
    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
    translate = TestBed.inject(TranslateService);
  });

  afterEach(() => httpMock.verify());

  function answer(settings: Record<string, string>): void {
    httpMock.expectOne((request) => request.url.endsWith('/settings')).flush({ settings });
  }

  it('keeps the built-in details when nothing has been saved', () => {
    answer({});
    expect(service.phoneDisplay()).toBe(environment.phoneDisplay);
    expect(service.phoneDial()).toBe(environment.phone);
    expect(service.email()).toBe(environment.contactEmail);
    expect(service.address()).toContain(environment.location.street);
    expect(service.whatsappNumber()).toBe(environment.whatsappNumber);
    expect(service.hours()).toBe('');
    expect(service.deliveryText()).toBe('');
  });

  it('keeps the built-in details when the request fails', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/settings'))
      .error(new ProgressEvent('network error'));
    expect(service.phoneDisplay()).toBe(environment.phoneDisplay);
    expect(service.whatsappNumber()).toBe(environment.whatsappNumber);
  });

  it('answers with the saved details, and builds the links from them', () => {
    answer({
      contact_phone: '+383 (44) 000-111',
      contact_whatsapp: '00383 44 777 888',
      contact_email: 'shop@example.test',
      contact_address: 'Rruga e Re 5, Gjilan',
    });

    // The customer reads what the owner wrote, spacing and all.
    expect(service.phoneDisplay()).toBe('+383 (44) 000-111');
    // The telephone dials only the digits - and keeps the + the number was written with.
    expect(service.phoneDial()).toBe('+38344000111');
    // wa.me rejects a plus, and a leading 00 is not a country code to it.
    expect(service.whatsappNumber()).toBe('38344777888');
    expect(service.whatsappLink()).toBe('https://wa.me/38344777888');
    expect(service.email()).toBe('shop@example.test');
    expect(service.address()).toBe('Rruga e Re 5, Gjilan');
  });

  it('reads the sentence written in the language the page is being read in', () => {
    translate.use('en');
    answer({ opening_hours_al: 'Hën–Sht 08:00–17:00', opening_hours_en: 'Mon–Sat 08:00–17:00' });

    expect(service.hours()).toBe('Mon–Sat 08:00–17:00');

    translate.use('al');
    expect(service.hours()).toBe('Hën–Sht 08:00–17:00');
  });

  it('falls back to the neutral sentence when the language one is blank', () => {
    translate.use('en');
    answer({ delivery_text: 'Delivery is agreed with the order.' });
    expect(service.deliveryText()).toBe('Delivery is agreed with the order.');
  });

  it('says nothing rather than inventing a delivery promise or a tax statement', () => {
    translate.use('al');
    answer({ delivery_text_al: '   ', vat_text_en: 'Prices include VAT.' });
    // Blank Albanian, an English VAT sentence, and this page is Albanian: both stay unsaid.
    expect(service.deliveryText()).toBe('');
    expect(service.vatText()).toBe('');
  });
});

describe('the number a telephone dials', () => {
  it('keeps the plus, drops the spacing, and turns 00 into +', () => {
    expect(telNumber('+383 (44) 133-208', 'fallback')).toBe('+38344133208');
    expect(telNumber('00383 44 133 208', 'fallback')).toBe('+38344133208');
    expect(telNumber('044 133 208', 'fallback')).toBe('044133208');
    expect(telNumber('', '+38344133208')).toBe('+38344133208');
    expect(telNumber('   ', '+38344133208')).toBe('+38344133208');
  });

  it('gives wa.me digits without a plus', () => {
    expect(whatsappNumber('+383 44 776 650', '38344776650')).toBe('38344776650');
    expect(whatsappNumber('00383 44 776 650', '38344776650')).toBe('38344776650');
    expect(whatsappNumber('', '38344776650')).toBe('38344776650');
  });
});
