import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PublicSettingsService } from './public-settings.service';

/**
 * The contract the public pages depend on: a setting wins when it is set, the page keeps its own words
 * when it is not, and a failed request is not an error the page has to catch.
 */
describe('PublicSettingsService', () => {
  let service: PublicSettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PublicSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('answers with the saved value when one exists', (done) => {
    service.field('contact_phone', '+383 44 000 000').subscribe((value) => {
      expect(value).toBe('+383 44 133 208');
      done();
    });
    httpMock.expectOne((r) => r.url.endsWith('/settings')).flush({
      settings: { contact_phone: '+383 44 133 208' },
    });
  });

  it('keeps the page\u2019s own words when the setting is blank', (done) => {
    service.field('contact_phone', '+383 44 000 000').subscribe((value) => {
      expect(value).toBe('+383 44 000 000');
      done();
    });
    httpMock.expectOne((r) => r.url.endsWith('/settings')).flush({ settings: { contact_phone: '   ' } });
  });

  it('asks once, however many pages want it', () => {
    service.all().subscribe();
    service.all().subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/settings')).flush({ settings: {} });
    httpMock.expectNone((r) => r.url.endsWith('/settings'));
  });
});
