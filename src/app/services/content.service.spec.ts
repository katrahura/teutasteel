import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ContentService } from './content.service';
import { SERVICES } from '../shared/services';
import { provideTestConfig } from '../testing/test-providers';
import { environment } from '../../environments/environment';

/**
 * The service copy: the owner's words win, a blank field keeps the page's own, and a failed request
 * changes nothing. The page must never be emptier because the settings request was.
 */
describe('ContentService', () => {
  let service: ContentService;
  let httpMock: HttpTestingController;

  const row = (overrides: Record<string, string> = {}) => ({
    id: 'cnc',
    title_al: 'Prerje CNC',
    title_en: 'CNC cutting',
    description_al: 'Përshkrim',
    description_en: 'Description',
    image: '',
    alt_al: '',
    alt_en: '',
    position: '0',
    active: '1',
    ...overrides,
  });

  function answer(rows: any[]): void {
    httpMock.expectOne((request) => request.url.endsWith('/content/services')).flush({ services: rows });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestConfig()] });
    service = TestBed.inject(ContentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const cnc = SERVICES.find((item) => item.id === 'cnc')!;

  it('keeps the shipped copy when nothing has been written', () => {
    answer([]);
    expect(service.titleOf(cnc, 'en', 'CNC metal cutting')).toBe('CNC metal cutting');
    expect(service.textOf(cnc, 'al', 'Teksti')).toBe('Teksti');
    expect(service.imageOf(cnc)).toBe(cnc.image);
    expect(service.isVisible('cnc')).toBeTrue();
  });

  it('keeps the shipped copy when the request fails', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/content/services'))
      .error(new ProgressEvent('network error'));
    expect(service.titleOf(cnc, 'en', 'CNC metal cutting')).toBe('CNC metal cutting');
  });

  it('reads the owner’s words in the language being read', () => {
    answer([row()]);
    expect(service.titleOf(cnc, 'en', 'fallback')).toBe('CNC cutting');
    expect(service.titleOf(cnc, 'al', 'fallback')).toBe('Prerje CNC');
    expect(service.textOf(cnc, 'en', 'fallback')).toBe('Description');
  });

  it('a blank field, or a blank language, falls back rather than showing nothing', () => {
    answer([row({ title_en: '   ', title_al: 'Vetëm shqip' })]);
    expect(service.titleOf(cnc, 'en', 'fallback')).toBe('fallback');
    expect(service.titleOf(cnc, 'al', 'fallback')).toBe('Vetëm shqip');
  });

  it('leaves out a service the owner switched off', () => {
    answer([row({ active: '0' })]);
    expect(service.isVisible('cnc')).toBeFalse();
    expect(service.ordered(SERVICES).some((item) => item.id === 'cnc')).toBeFalse();
  });

  it('orders the services by the owner’s number, keeping the shipped order on a tie', () => {
    answer([row({ id: 'cnc', position: '20' }), row({ id: 'bending', position: '10' })]);
    const ids = service.ordered(SERVICES).map((item) => item.id);
    expect(ids[0]).toBe('bending');
    expect(ids.indexOf('cnc')).toBeGreaterThan(ids.indexOf('bending'));
  });

  it('uses the owner’s picture when one is given', () => {
    answer([row({ image: 'https://cdn.example.test/cnc.jpg' })]);
    expect(service.imageOf(cnc)).toBe('https://cdn.example.test/cnc.jpg');
  });
});
