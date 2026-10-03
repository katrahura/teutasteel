import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ProductsComponent } from './products.component';
import { provideTestConfig } from '../../testing/test-providers';
import { clearToken, setToken } from '../../services/token-storage';
import { environment } from '../../../environments/environment';

describe('ProductsComponent', () => {
  let component: ProductsComponent;
  let fixture: ComponentFixture<ProductsComponent>;
  let httpMock: HttpTestingController;

  const groupsUrl = `${environment.apiUrl}/category/top`;
  const createCategoryUrl = `${environment.apiUrl}/category/create`;

  beforeAll(() => {
    // The component drives Bootstrap modals; the test runner does not load that
    // bundle, so provide the small surface the component touches.
    (window as unknown as { bootstrap: unknown }).bootstrap = {
      Modal: class {
        static getInstance(): { hide: () => void } {
          return { hide: () => undefined };
        }
        constructor() {}
        show(): void {}
        hide(): void {}
      },
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [provideTestConfig()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the category groups when the API answers', () => {
    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    ]);
    // each parent is then asked for its children
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);

    expect(component.topCategories.length).toBe(1);
    expect(component.groupsError).toBeNull();
  });

  it('stores a translation key when the request fails', () => {
    // Regression: the template used to show the raw English string
    // "Failed to load categories". A 404 is not retried (it cannot succeed), so
    // this is the only attempt.
    httpMock
      .expectOne((req) => req.url === groupsUrl)
      .flush('nope', { status: 404, statusText: 'Not Found' });
    httpMock.expectNone((req) => req.url === groupsUrl);

    expect(component.groupsError).toBe('PRODUCTS.LOAD_ERROR');
    expect(component.loadingGroups).toBeFalse();
  });

  it('refreshes the visible category groups after creating a category', () => {
    // the initial load from ngOnInit has to settle first
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    component.newCategory.title = 'New group';
    component.createCategory();
    httpMock
      .expectOne(createCategoryUrl)
      .flush({ id: 99, title: 'New group', is_active: true, top_category: true });

    // Regression: the success handler reloaded the flat category list, which the
    // page does not render, so a newly created category never appeared.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    expect(component.statusMessage).toBe('PRODUCTS.SAVED');
    expect(component.newCategory.title).toBe('');
  });

  it('reports a failed save instead of failing silently', () => {
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    component.newCategory.title = 'New group';
    component.createCategory();
    httpMock
      .expectOne(createCategoryUrl)
      .flush('nope', { status: 400, statusText: 'Bad Request' });

    expect(component.statusMessage).toBe('PRODUCTS.SAVE_FAILED');
  });

  it('offers an edit button on top-level categories when signed in', () => {
    // Regression: the per-parent action area was an empty commented-out block, so
    // a top-level category (the site's main groups) could not be edited at all.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);
    setToken('jwt-123');

    const localFixture = TestBed.createComponent(ProductsComponent);
    localFixture.detectChanges();

    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    ]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);
    localFixture.detectChanges();

    expect(localFixture.componentInstance.isLoggedIn).toBeTrue();
    expect(localFixture.nativeElement.querySelectorAll('.parent-toggle').length).toBe(1);
    expect(localFixture.nativeElement.querySelectorAll('.edit-btn').length).toBe(1);
    clearToken();
  });

  it('opens the edit dialog for a product that has no image', () => {
    // Regression: the dialog binds to selectedProduct.image_asset.file_name, and the
    // `!` marks in the template are compile-time only. A product with no image threw
    // "Cannot read properties of null (reading 'file_name')" on every change detection,
    // so the dialog was unusable for every product created without one.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    const product = {
      id: 3,
      code: 'DS-003',
      cut_type: 0,
      category_id: 1,
      is_active: true,
      new_product: false,
      image_asset: null,
      dimensions: [],
      translations: [],
    } as any;

    expect(() => component.openEditModal(product)).not.toThrow();
    expect(component.selectedProduct!.image_asset).toEqual({
      file_name: '',
      alternative_text: '',
      thumbnail_path: '',
      original_path: '',
    });
  });

  it('offers a way to see the products of a top-level category', () => {
    // Regression: the button that chooses the category a new product goes into existed
    // only on child cards, so a top-level category could never be selected. After the
    // parent_id migration every category is top-level, which made creating a product
    // impossible from the interface.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);
    setToken('jwt-123');

    const localFixture = TestBed.createComponent(ProductsComponent);
    localFixture.detectChanges();
    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    ]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);
    localFixture.detectChanges();

    // the translation may arrive as the key rather than the sentence in a unit test
    const buttons = [...localFixture.nativeElement.querySelectorAll('button')]
      .map((button: HTMLButtonElement) => (button.textContent || '').trim());
    expect(buttons.some((text: string) => /view products|VIEW_PRODUCTS|shiko produkte/i.test(text))).toBeTrue();
    clearToken();
  });

  it('marks a category that is switched off', () => {
    // A category switched off is hidden from visitors but still listed here, because this
    // is where it gets switched back on. Without a marker it looks like every other one.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);
    setToken('jwt-123');

    const localFixture = TestBed.createComponent(ProductsComponent);
    localFixture.detectChanges();
    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Retired', is_active: false, top_category: true, image_asset: null },
    ]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);
    localFixture.detectChanges();

    const badges = [...localFixture.nativeElement.querySelectorAll('.badge')]
      .map((badge: HTMLElement) => (badge.textContent || '').trim());
    expect(badges.some((text: string) => /inactive|jo aktiv|INACTIVE/i.test(text))).toBeTrue();
    clearToken();
  });

  it('shows the translation content, which used to be editable and invisible', () => {
    // Regression: the form offered a "content" field, the API stored it and nothing
    // displayed it, so the long description never reached a customer.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    const product = {
      id: 3, code: 'DS-003', cut_type: 0, category_id: 1, is_active: true, new_product: false,
      description: 'short', content: '<p>the long description</p>',
      image_asset: null, dimensions: [], translations: [],
    } as any;
    component.selectedProduct = product;
    fixture.detectChanges();

    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('the long description');
  });

  it('renders a product that has no image, whichever dialog opened it', () => {
    // Regression, and a customer-facing one. The edit dialog is rendered whenever
    // selectedProduct is set, which the *details* dialog also does, and its image fields
    // bound straight to selectedProduct.image_asset.file_name. Opening the details view
    // on a product with no image therefore threw on every change detection:
    //   TypeError: Cannot read properties of null (reading 'file_name')
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    component.selectedProduct = {
      id: 3, code: 'DS-003', cut_type: 0, category_id: 1, is_active: true, new_product: false,
      image_asset: null, dimensions: [], translations: [],
    } as any;

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('says so when a category has no products', () => {
    // On the day the new site goes up, every category is empty until the owner fills it.
    // It used to render as blank space, which reads as "broken" rather than "not yet".
    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    ]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);

    component.showProducts({ id: 1, title: 'Doors', is_active: true, top_category: true } as any);
    httpMock.expectOne((req) => req.url.startsWith(`${environment.apiUrl}/category/1?`))
      .flush({ id: 1, title: 'Doors', products: [], pagination: {} });
    fixture.detectChanges();

    // the translation may arrive as the key rather than the sentence in a unit test
    const text: string = fixture.nativeElement.textContent;
    expect(/NO_PRODUCTS_IN_CATEGORY|no products/i.test(text)).toBeTrue();
  });

  it('does not offer a "top category" control', () => {
    // It was the legacy flag. The site groups by parent_id, so the control changed nothing
    // about where a category appeared - and the backend now derives the flag from the
    // parent, so a control would be overwritten anyway. "Parent category: none" is what
    // makes a category top level.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);
    setToken('jwt-123');

    const localFixture = TestBed.createComponent(ProductsComponent);
    localFixture.detectChanges();
    httpMock.expectOne((req) => req.url === groupsUrl).flush([
      { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    ]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/category/1/children`).flush([]);
    localFixture.detectChanges();

    expect(localFixture.nativeElement.querySelector('#categoryTop')).toBeNull();
    expect(localFixture.nativeElement.querySelector('#topCategory')).toBeNull();
    clearToken();
  });
});
