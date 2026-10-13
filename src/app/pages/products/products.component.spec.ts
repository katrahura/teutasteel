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

  // The page reads the tree, not the flat list: one request carries the groups and their children,
  // where it used to ask for the groups and then for each group's children in turn.
  const groupsUrl = `${environment.apiUrl}/category/tree`;
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
    // each group's children arrive inside the tree, with no second request

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
    localFixture.detectChanges();

    expect(localFixture.nativeElement.querySelector('#categoryTop')).toBeNull();
    expect(localFixture.nativeElement.querySelector('#topCategory')).toBeNull();
    clearToken();
  });

  it('offers the size, not a sentence about a missing description', () => {
    // "No description available" is a dead end. Where the product carries dimensions the size line
    // says something useful, and where it carries nothing at all the card invites the question.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);

    component.showProducts({ id: 1, title: 'Doors', is_active: true } as any);
    httpMock.expectOne((req) => req.url.startsWith(`${environment.apiUrl}/category/1?`))
      .flush({
        id: 1,
        title: 'Doors',
        pagination: { page: 1, total_pages: 1 },
        products: [
          {
            id: 1, code: 'BARE-1', cut_type: 0, category_id: 1, is_active: true,
            new_product: false, description: null, image_asset: null, dimensions: [],
            translations: [],
          },
          {
            id: 2, code: 'SIZED-1', cut_type: 0, category_id: 1, is_active: true,
            new_product: false, description: null, image_asset: null, translations: [],
            dimensions: [{ id: 9, height: 20, thickness: 2, price: 5, currency: 'EUR' }],
          },
        ],
      });
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('NO_DESCRIPTION_AVAILABLE');
    expect(text).toContain('PRODUCTS.ASK_FOR_DETAILS');
    expect(text).toContain('BARE-1');
    expect(text).toContain('SIZED-1');
  });

  it('narrows the category when a filter is chosen, from the first page', () => {
    // A group like the tubes holds hundreds of products, and a customer looking for a 2 mm wall
    // wants the ones that have it.
    httpMock.expectOne((req) => req.url === groupsUrl).flush([]);
    component.showProducts({ id: 1, title: 'Doors', is_active: true } as any);
    const facets = {
      thicknesses: [2, 5], height_min: 20, height_max: 40, total_thicknesses: 2, total_sizes: 2,
    };
    httpMock.expectOne((req) => req.url.startsWith(`${environment.apiUrl}/category/1?`))
      .flush({ id: 1, title: 'Doors', pagination: { page: 1, total_pages: 1, total_items: 2 },
               products: [], facets });
    fixture.detectChanges();

    component.currentPage = 3;
    component.filterThickness = 2;
    component.applyFilters();

    const filtered = httpMock.expectOne((req) => req.url.includes('thickness=2'));
    // Back to the first page: the third one may not exist under the filter.
    expect(filtered.request.url).toContain('page=1');
    filtered.flush({ id: 1, title: 'Doors', pagination: { page: 1, total_pages: 1, total_items: 1 },
                     products: [], facets });
    fixture.detectChanges();

    expect(component.totalItems).toBe(1);
    expect(component.hasFilters()).toBeTrue();
  });

  it('cancels an older search before accepting newer results', () => {
    httpMock.expectOne(groupsUrl).flush([]);
    component.searchQuery='old';component.runSearch();
    const old=httpMock.expectOne(req=>req.url.includes('/product/search?q=old'));
    component.searchQuery='new';component.runSearch();
    expect(old.cancelled).toBeTrue();
    httpMock.expectOne(req=>req.url.includes('/product/search?q=new')).flush([]);
    expect(component.searchTerm).toBe('new');
  });
  it('cancels a search on clear and distinguishes failures from no matches', () => {
    httpMock.expectOne(groupsUrl).flush([]);
    component.searchQuery='steel';component.runSearch();
    const pending=httpMock.expectOne(req=>req.url.includes('/product/search?'));
    component.clearSearch();expect(pending.cancelled).toBeTrue();
    expect(component.showingGroups).toBeTrue();
    component.searchQuery='steel';component.runSearch();
    httpMock.expectOne(req=>req.url.includes('/product/search?')).flush('missing',{status:404,statusText:'Not Found'});
    expect(component.searchError).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('PRODUCTS.NO_RESULTS');
  });
  it('lets a product with one size be added without ticking anything', () => {
    // The dialog's add button is guarded by canAddTicked, and tickedDimensions hands back a single
    // size whether or not it is ticked. The two disagreed, so the button did nothing at all for
    // every product with one dimension - 730 of them, and any tube with a single wall.
    component.selectedProduct = {
      id: 1,
      code: '08252',
      dimensions: [{ id: 1, width: 1000, height: 2000, price: '25.00' }],
    } as unknown as ProductsComponent['selectedProduct'];
    component.chosenDimensions = {};
    expect(component.canAddTicked()).toBeTrue();
  });

  it('still refuses a product whose ticked size has no quantity', () => {
    component.selectedProduct = {
      id: 1,
      code: 'Llam',
      dimensions: [
        { id: 1, thickness: 1 },
        { id: 2, thickness: 2 },
      ],
    } as unknown as ProductsComponent['selectedProduct'];
    component.chosenDimensions = { 0: true };
    component.quantities = { 0: 0 };
    expect(component.canAddTicked()).toBeFalse();
  });

  it('does not fall over on a null dimension', () => {
    // A null dimension reached variantKey through the add path, and the click threw "Cannot read
    // properties of null (reading 'id')" - caught by Angular, logged, and the add silently did
    // nothing. This is the one place every route into the request list shares.
    const component_ = component as unknown as { variantKey(dimension: unknown): string };
    expect(() => component_.variantKey(null)).not.toThrow();
    expect(component_.variantKey(null)).toBe('unknown');
  });

  it('does not fall over when the dialog markup is used with no product selected', () => {
    // The dialog's buttons are in the page even while it is closed, so a script can reach them with
    // selectedProduct null. That threw "Cannot read properties of null (reading 'id')" in
    // migrateLegacyQuote, whose first argument is product.id. A hidden button cannot be clicked by a
    // person, so this is robustness rather than a customer-facing fault - but it is a real crash on a
    // real path, found with source maps.
    const component_ = component as unknown as {
      addToQuote(product: unknown, dimensions?: unknown): void;
      migrateLegacyQuote(product: unknown): void;
    };
    expect(() => component_.migrateLegacyQuote(null)).not.toThrow();
    expect(() => component_.addToQuote(null)).not.toThrow();
    expect(() => component_.addToQuote(undefined)).not.toThrow();
  });

  it('cancels a pending debounce when leaving the page', () => {
    httpMock.expectOne(groupsUrl).flush([]);
    const clock=jasmine.clock();clock.install();
    try {
      component.searchQuery='steel';component.onSearchInput();
      component.ngOnDestroy();clock.tick(400);
      httpMock.expectNone(req=>req.url.includes('/product/search?'));
    } finally { clock.uninstall(); }
  });

});

/**
 * The one-line size on a card. Both the unit and the length are decisions with a reason behind
 * them, so they are pinned down here.
 */
describe('ProductsComponent shortSize', () => {
  let component: ProductsComponent;

  const product = (dimensions: unknown[], code = 'X') =>
    ({ code, dimensions } as unknown as Parameters<ProductsComponent['shortSize']>[0]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [provideTestConfig()],
    }).compileComponents();
    // Creating it is enough: shortSize reads the argument and nothing else, so no request is made
    // and no change detection is needed.
    component = TestBed.createComponent(ProductsComponent).componentInstance;
  });

  it('reads a square tube as its section and its length', () => {
    expect(
      component.shortSize(product([{ height: 10, width: 10, thickness: 1.3, length: 6000 }], '10x10 x 1.3mm'))
    ).toBe('10×10×1.3 · 6 m');
  });

  it('writes a round section with its diameter sign', () => {
    expect(component.shortSize(product([{ height: 16, thickness: 1.3, length: 6000 }], 'Ø16 x 1.3mm')))
      .toBe('Ø16×1.3 · 6 m');
  });

  it('claims no unit after the section, because the catalogue does not agree on one', () => {
    // The aluminium sheet is stored as 2 x 1 in metres. Printing "mm" after it said the sheet was
    // two millimetres wide, which is a thousand times out, on a card where somebody is buying.
    // The code says it is a sheet, so it reads width first, the way a sheet is quoted.
    const size = component.shortSize(
      product([{ height: 1, width: 2, thickness: 1.2, length: null }], 'Briz 1.2 1x2')
    );
    expect(size).toBe('2 × 1 × 1.2');
    expect(size).not.toContain('mm');
  });

  it('reads a sheet by its flat size and thickness, the way a steel table does', () => {
    // 134 is Steel sheets: the catalogue holds width 1000, length 2000 and thickness 0.5 for this
    // one. It used to read "1000x0.5 - 2 m", which put the thickness where the width goes.
    expect(
      component.shortSize(
        product([{ width: 1000, height: null, length: 2000, thickness: 0.5 }], 'Llam Zez 1000x2000'),
        134
      )
    ).toBe('1000 × 2000 × 0.5');
  });

  it('reads a sheet whose length is stored as zero, not as nothing', () => {
    // The catalogue writes the length of a laser sheet as the number 0. Reading it with ?? accepted
    // the zero and dropped the height behind it, so four hundred decorative sheets showed "1000"
    // where they should have shown "1000 x 2000".
    expect(
      component.shortSize(
        product([{ width: 1000, height: 2000, length: 0, thickness: 0 }], '08252'),
        59
      )
    ).toBe('1000 × 2000');
  });

  it('keeps section-then-length for a tube, whichever way the category is known', () => {
    const tube = product([{ height: 10, width: 10, thickness: 1.3, length: 6000 }], '10x10 x 1.3mm');
    expect(component.shortSize(tube, 123)).toBe('10×10×1.3 · 6 m');
    expect(component.shortSize(tube)).toBe('10×10×1.3 · 6 m');
  });

  it('gives a length even when there is no section to give', () => {
    expect(component.shortSize(product([{ height: null, width: null, thickness: null, length: 6000 }])))
      .toBe('6 m');
  });

  it('says nothing at all when there is no size', () => {
    expect(component.shortSize(product([]))).toBe('');
    expect(component.shortSize(null)).toBe('');
  });
});
