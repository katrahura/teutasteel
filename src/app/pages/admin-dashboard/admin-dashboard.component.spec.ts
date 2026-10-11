import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AdminDashboardComponent } from './admin-dashboard.component';
import { provideTestConfig } from '../../testing/test-providers';
import { environment } from '../../../environments/environment';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let httpMock: HttpTestingController;

  const summaryUrl = `${environment.apiUrl}/admin/summary`;
  const searchesUrl = `${environment.apiUrl}/admin/searches?limit=100`;

  const summary = {
    products: {
      total: 2368,
      active: 2300,
      in_off_categories: 1133,
      priced_without_photo: 429,
      priced_without_size: 55,
    },
    categories: { total: 70, off: 28, off_categories: [{ id: 7, title: 'Old stock' }] },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideTestConfig()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows what the catalogue is missing', () => {
    // The figures the owner could previously only get by asking the database by hand.
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush({ empty: 0, total: 0, searches: [] });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('2368');
    expect(text).toContain('429');   // priced, no photograph
    expect(text).toContain('1133');  // under a category that is switched off
    expect(text).toContain('Old stock');
  });

  it('lists the searches that found nothing, marked', () => {
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush({
      empty: 1,
      total: 2,
      searches: [
        { term: 'ipe 200', lang: 'al', hits: 0, times: 3, last_seen: null },
        { term: '15x15', lang: 'al', hits: 2, times: 5, last_seen: null },
      ],
    });
    fixture.detectChanges();

    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')
    );
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('ipe 200');
    expect(rows[0].classList).toContain('found-nothing');
    expect(rows[1].classList).not.toContain('found-nothing');
  });

  it('says the page belongs to the owner instead of failing', () => {
    // The API answers 401 to nobody and 403 to somebody signed in without the right. Both used to
    // be the same thing to this page: an empty dashboard.
    httpMock.expectOne(summaryUrl).flush('no', { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne(searchesUrl).flush('no', { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(component.denied).toBeTrue();
    expect(component.failed).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.DENIED');
  });

  it('keeps one report when the other fails', () => {
    // They fail on their own: one bad report must not blank the other.
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.summary).not.toBeNull();
    expect(component.failed).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2368');
  });

  it('switches a category back on, and reads the figures again', () => {    // The list of off categories is the reason to have this page: finding the one you mean on the
    // products page means opening groups until it turns up.
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush({ empty: 0, total: 0, searches: [] });
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement)
      .querySelector('.switch-on') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();

    const put = httpMock.expectOne(
      (req) => req.url === `${environment.apiUrl}/category/without-products/7`
    );
    expect(put.request.method).toBe('PUT');
    // The id goes in the path, not the body - a partial update is all this needs.
    expect(put.request.body).toEqual({ is_active: true });
    put.flush({ id: 7, title: 'Old stock', is_active: true });

    // The summary is read again, so the list and the counts agree with what was just done.
    httpMock.expectOne(summaryUrl).flush(summary);
    fixture.detectChanges();

    expect(component.switching).toBeNull();
  });

  it('opens the worklist behind a figure', () => {
    // A figure says how many products are missing a photograph; the owner needs to know which.
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush({ empty: 0, total: 0, searches: [] });
    fixture.detectChanges();

    const figures = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button.stat')
    ) as HTMLButtonElement[];
    expect(figures.length).toBe(3);

    const photoFigure = figures.find((figure) =>
      (figure.textContent || '').includes('ADMIN.PRICED_WITHOUT_PHOTO')
    ) as HTMLButtonElement;
    expect(photoFigure).toBeTruthy();
    photoFigure.click();

    const gap = httpMock.expectOne((req) =>
      req.url.startsWith(`${environment.apiUrl}/admin/products?gap=no_photo`)
    );
    gap.flush({
      gap: 'no_photo',
      total: 3,
      page: 1,
      pages: 1,
      products: [{ id: 11, code: 'PLAIN-1', category_id: 3, category: 'Round tubes', group: 'Tubes' }],
    });
    fixture.detectChanges();

    expect(component.gap).toBe('no_photo');
    expect(component.gapTotal).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('PLAIN-1');
    // The group as well, so the row says where in the catalogue it is.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tubes');
  });

  it('can narrow the searches to the ones that found nothing', () => {
    // A tally of a hundred terms is a report; the handful nobody could find is a to-do list.
    httpMock.expectOne(summaryUrl).flush(summary);
    httpMock.expectOne(searchesUrl).flush({
      empty: 1,
      total: 2,
      returned: 2,
      searches: [
        { term: 'ipe 200', lang: 'al', hits: 0, times: 3, last_seen: null },
        { term: '15x15', lang: 'al', hits: 2, times: 5, last_seen: null },
      ],
    });
    fixture.detectChanges();

    const toggle = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((button) => (button.textContent || '').includes('ADMIN.ONLY_EMPTY')) as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    toggle.click();

    const filtered = httpMock.expectOne(
      (req) => req.url === `${environment.apiUrl}/admin/searches?limit=100&only_empty=1`
    );
    filtered.flush({
      only_empty: true,
      returned: 1,
      empty: 1,
      total: 2,
      searches: [{ term: 'ipe 200', lang: 'al', hits: 0, times: 3, last_seen: null }],
    });
    fixture.detectChanges();

    expect(component.onlyEmpty).toBeTrue();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('ipe 200');
  });
});
