import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { AdminProductsComponent } from './admin-products.component';
import { CataloguePage, CatalogueRow } from '../../../services/admin.service';
import { provideTestConfig } from '../../../testing/test-providers';
import { environment } from '../../../../environments/environment';

/**
 * The catalogue table.
 *
 * What matters here is what a table has to get right to be usable for work: the filters reach the
 * API, paging keeps them, a refusal is told apart from a failure, and a row says what is wrong with
 * the product without anybody opening it.
 */
describe('AdminProductsComponent', () => {
  let component: AdminProductsComponent;
  let fixture: ComponentFixture<AdminProductsComponent>;
  let httpMock: HttpTestingController;

  const treeUrl = `${environment.apiUrl}/category/tree`;
  const catalogueUrl = `${environment.apiUrl}/admin/catalogue`;

  const row = (overrides: Partial<CatalogueRow> = {}): CatalogueRow => ({
    id: 1,
    code: '10x10 x 1.3mm',
    is_active: true,
    new_product: false,
    category_id: 123,
    category: 'Square tubes',
    group: 'Hollow sections',
    category_active: true,
    has_photo: true,
    thumbnail: 'https://example.test/thumb.jpg',
    dimensions_count: 1,
    price: 3.8,
    currency: 'Eur',
    thickness: 1.3,
    languages: ['al', 'en'],
    ...overrides,
  });

  const page = (products: CatalogueRow[], total = products.length, current = 1,
                pages = 1): CataloguePage => ({
    total,
    page: current,
    pages,
    per_page: 50,
    products,
  });

  const respond = (body: CataloguePage) => {
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url.startsWith(catalogueUrl)).flush(body);
    fixture.detectChanges();
  };

  const create = (params: Record<string, string> = {}) => {
    // The address is a stub declared with the module - overriding it here fails, because the module
    // is already instantiated by the time a test runs. Its query params are set before the component
    // is created, which is when the component reads them.
    routeStub.snapshot = { queryParamMap: convertToParamMap(params) };
    fixture = TestBed.createComponent(AdminProductsComponent);
    component = fixture.componentInstance;
    return fixture;
  };

  // Filled per test, read by the component when it is created.
  const routeStub: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } } = {
    snapshot: { queryParamMap: convertToParamMap({}) },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductsComponent],
      providers: [
        // The real router comes from here: RouterLink needs it, and a stub with only navigate()
        // throws inside the template before any test gets to assert anything.
        provideTestConfig(),
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('asks for the catalogue and the category tree once', () => {
    create();
    fixture.detectChanges();

    const request = httpMock.expectOne((req) => req.url === catalogueUrl);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('per_page')).toBe('50');
    expect(request.request.params.get('active')).toBe('all');
    httpMock.expectOne((req) => req.url === treeUrl).flush([]);
    request.flush(page([row()]));
    fixture.detectChanges();

    expect(component.rows.length).toBe(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('sends the search and visibility filters to the API', () => {
    create();
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush(page([]));

    component.q = 'IPE 100';
    component.active = '0';
    component.category = 136;
    component.load(1);

    const request = httpMock.expectOne((req) => req.url === catalogueUrl);
    expect(request.request.params.get('q')).toBe('IPE 100');
    expect(request.request.params.get('active')).toBe('0');
    expect(request.request.params.get('category')).toBe('136');
    request.flush(page([]));
  });

  it('opens on the filters the address carries, so coming back lands where you were', () => {
    create({ q: 'llam', active: '0', category: '112', page: '3' });
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);

    const request = httpMock.expectOne((req) => req.url === catalogueUrl);
    expect(request.request.params.get('q')).toBe('llam');
    expect(request.request.params.get('active')).toBe('0');
    expect(request.request.params.get('category')).toBe('112');
    expect(request.request.params.get('page')).toBe('3');
    request.flush(page([]));
  });

  it('keeps the filters when moving to another page', () => {
    create();
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush(page([row()], 120, 1, 3));

    component.q = 'tube';
    component.goTo(2);

    const request = httpMock.expectOne((req) => req.url === catalogueUrl);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('q')).toBe('tube');
    request.flush(page([row({ id: 2 })], 120, 2, 3));
  });

  it('tells a refusal apart from a failure', () => {
    create();
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush('forbidden', {
      status: 403,
      statusText: 'Forbidden',
    });
    fixture.detectChanges();
    expect(component.denied).toBeTrue();
    expect(component.failed).toBeFalse();
  });

  it('keeps the rows when the network fails, and offers to try again', () => {
    create();
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush(page([row()]));

    component.load(1);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush('offline', {
      status: 0,
      statusText: 'Unknown Error',
    });
    fixture.detectChanges();

    expect(component.failed).toBeTrue();
    expect(component.denied).toBeFalse();
    // The table is not blanked: what was on screen is still worth reading.
    expect(component.rows.length).toBe(1);
  });

  it('copies a product and says which copy it was', () => {
    create();
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.startsWith(treeUrl)).flush([]);
    httpMock.expectOne((req) => req.url === catalogueUrl).flush(page([row()]));

    component.duplicate(component.rows[0]);

    const post = httpMock.expectOne(`${environment.apiUrl}/admin/products/1/duplicate`);
    expect(post.request.method).toBe('POST');
    post.flush({ id: 9, code: '10x10 x 1.3mm-KOPJE', is_active: false });
    httpMock.expectOne((req) => req.url === catalogueUrl).flush(page([row()]));

    expect(component.copied).toBe('10x10 x 1.3mm-KOPJE');
    expect(component.duplicating).toBeNull();
  });

  it('says what is wrong with a row without opening it', () => {
    create();
    fixture.detectChanges();
    respond(page([row()]));

    expect(component.statusOf(component.rows[0])).toEqual([]);
    expect(component.missingLanguage(component.rows[0])).toBeNull();

    component.rows = [row({ is_active: false, has_photo: false, price: null,
      dimensions_count: 0, languages: ['al'] })];
    expect(component.statusOf(component.rows[0]))
      .toEqual(['ADMIN.STATUS_OFF', 'ADMIN.STATUS_NO_PHOTO', 'ADMIN.STATUS_NO_PRICE',
                'ADMIN.STATUS_NO_SIZE']);
    expect(component.missingLanguage(component.rows[0])).toBe('EN');
  });

  it('says a product is invisible when its category is the thing that is off', () => {
    // A product can be switched on and still be hidden, because the category above it is off - that
    // is how 1,032 of this catalogue's products are hidden. A table that only read the product's own
    // flag would call every one of them visible.
    create();
    fixture.detectChanges();
    respond(page([row({ is_active: true, category_active: false })]));

    expect(component.statusOf(component.rows[0])).toContain('ADMIN.STATUS_OFF_CATEGORY');
    // And a product that is itself off does not also say its category is: one word for one reason.
    component.rows = [row({ is_active: false, category_active: false })];
    expect(component.statusOf(component.rows[0])).toEqual(['ADMIN.STATUS_OFF']);
  });

  it('prints a price with its currency, and a dash when there is none', () => {
    create();
    fixture.detectChanges();
    respond(page([row(), row({ id: 2, price: null })]));

    expect(component.priceOf(component.rows[0])).toBe('3.80 Eur');
    expect(component.priceOf(component.rows[1])).toBe('—');
  });
});
