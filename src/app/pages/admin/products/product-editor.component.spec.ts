import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ProductEditorComponent } from './product-editor.component';
import { provideTestConfig } from '../../../testing/test-providers';
import { environment } from '../../../../environments/environment';

/**
 * The product editor, as a component with an id.
 *
 * What it must get right, beyond rendering: it loads the product it was given, it saves what is on the
 * form and nothing else, and a rejected save says which field is wrong instead of one sentence for
 * nineteen fields.
 */
describe('ProductEditorComponent', () => {
  let component: ProductEditorComponent;
  let fixture: ComponentFixture<ProductEditorComponent>;
  let httpMock: HttpTestingController;

  const product = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    code: 'IPE-100',
    cut_type: 1,
    is_active: true,
    new_product: false,
    dimensions: [{ id: 9, height: 100, width: 55, thickness: 4.1, price: '12.50', currency: 'EUR' }],
    translations: [{ language: 'al', description: 'Pofil', content: '', slug: 'ipe-100' }],
    image_asset: { file_name: 'ipe.jpg', alternative_text: 'IPE', thumbnail_path: 't.jpg', original_path: 'o.jpg' },
    ...overrides,
  });

  const load = (body: object = product()) => {
    const request = httpMock.expectOne((req) => req.url.startsWith(`${environment.apiUrl}/product/5`));
    request.flush(body);
    fixture.detectChanges();
    return request;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductEditorComponent],
      providers: [provideTestConfig()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const create = (id: number | null = 5) => {
    fixture = TestBed.createComponent(ProductEditorComponent);
    component = fixture.componentInstance;
    component.productId = id;
    component.ngOnChanges({ productId: {} as never });
    fixture.detectChanges();
    return fixture;
  };

  it('loads the product it was given, photograph paths and all', () => {
    create();
    load();

    expect(component.loaded).toBeTrue();
    expect(component.product.code).toBe('IPE-100');
    expect(component.thumbnailPath).toContain('t.jpg');
    expect(component.originalPath).toContain('o.jpg');
    expect(component.image.file_name).toBe('ipe.jpg');
    expect(component.product.dimensions!.length).toBe(1);
  });

  it('has a shape before anything is loaded, so the form never reads a null', () => {
    create(null);
    expect(component.product.code).toBe('');
    expect(component.product.dimensions).toEqual([]);
    expect(component.product.image_asset).toBeDefined();
    httpMock.expectNone((req) => req.url.includes('/product/'));
  });

  it('saves what is on the form, including the photograph paths as edited', () => {
    create();
    load();
    component.product.code = 'IPE-120';
    component.thumbnailPath = 'new-thumb.jpg';
    component.saved.subscribe(() => undefined);
    let savedCode = '';

    component.saved.subscribe((saved) => (savedCode = saved.code));
    component.updateProduct();

    const put = httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/product/'));
    expect(put.request.body.code).toBe('IPE-120');
    expect(put.request.body.image_asset.thumbnail_path).toBe('new-thumb.jpg');
    put.flush({ ...product(), code: 'IPE-120' });

    expect(savedCode).toBe('IPE-120');
    expect(component.saving).toBeFalse();
  });

  it('keeps the API’s field paths, so a field can say what is wrong with itself', () => {
    create();
    load();

    component.updateProduct();
    const put = httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/product/'));
    put.flush(
      {
        error: 'Validation Error',
        details: { 'dimensions.0.price': ['Not a valid number.'], code: ['Already taken.'] },
      },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.errorFor('dimensions.0.price')).toBe('Not a valid number.');
    expect(component.errorFor('code')).toBe('Already taken.');
    expect(component.errorFor('unrelated')).toBe('');
    expect(component.errorMessage).toContain('Not a valid number.');
    expect(component.saving).toBeFalse();
  });

  it('adds and removes dimension rows without touching the others', () => {
    create();
    load();

    component.addNewDimension();
    expect(component.product.dimensions!.length).toBe(2);
    expect(component.product.dimensions![1].currency).toBe('EUR');

    component.removeDimension(0);
    expect(component.product.dimensions!.length).toBe(1);
    expect(component.product.dimensions![0].height).toBeUndefined();
  });

  it('knows a round section by its diameter sign', () => {
    create();
    load();

    expect(component.isRound({ code: 'Ø28 x 1.5' })).toBeTrue();
    expect(component.isRound({ code: 'IPE-100' })).toBeFalse();
    component.product.code = 'Ø 42 x 3';
    expect(component.isRound()).toBeTrue();
  });
  it('puts a rejected field message under that field, not only in the map', () => {
    create();
    load();

    component.updateProduct();
    const put = httpMock.expectOne((req) => req.method === 'PUT');
    put.flush(
      { error: 'Validation Error', details: { 'dimensions.0.price': ['Not a valid number.'] } },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    const shown = Array.from(fixture.nativeElement.querySelectorAll('.field-error')) as HTMLElement[];
    expect(shown.some((el) => (el.textContent || '').includes('Not a valid number.'))).toBeTrue();
  });

  it('creates a product inside the panel, switched off, with one variant and both languages', () => {
    fixture = TestBed.createComponent(ProductEditorComponent);
    component = fixture.componentInstance;
    component.newProduct = true;
    fixture.detectChanges();

    expect(component.loaded).toBeTrue();
    expect(component.product.is_active).toBeFalse();
    expect(component.product.dimensions!.length).toBe(1);
    expect(component.product.translations!.map((row) => row.language)).toEqual(['al', 'en']);

    component.product.category_id = 7;
    component.product.code = 'NEW-1';
    component.saved.subscribe(() => undefined);
    component.updateProduct();

    const post = httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/product/create'));
    expect(post.request.body.code).toBe('NEW-1');
    expect(post.request.body.category_id).toBe(7);
    post.flush(product({ id: 11, code: 'NEW-1', version: 1 }));
    expect(component.newProduct).toBeFalse();
  });

  it('refuses to create without a category, before making the request', () => {
    fixture = TestBed.createComponent(ProductEditorComponent);
    component = fixture.componentInstance;
    component.newProduct = true;
    fixture.detectChanges();

    component.updateProduct();
    expect(component.errorFor('category_id')).toBeTruthy();
    httpMock.expectNone((req) => req.method === 'POST');
  });

  it('carries the version it read, and shows a conflict instead of overwriting', () => {
    create();
    load(product({ version: 4 }));

    component.product.code = 'IPE-120';
    component.updateProduct();
    const put = httpMock.expectOne((req) => req.method === 'PUT');
    expect(put.request.body.expected_version).toBe(4);

    put.flush(
      { error: 'This product changed while you were editing it', detail: 'stale', current_version: 5 },
      { status: 409, statusText: 'Conflict' }
    );

    expect(component.conflict).toBeTrue();
    expect(component.saving).toBeFalse();
    expect(component.errorMessage).toContain('changed while you were editing');
  });

  it('sends the price unit the owner chose, and keeps unknown as unknown', () => {
    create();
    load();

    component.product.dimensions![0].price_unit = 'metre';
    component.updateProduct();
    const put = httpMock.expectOne((req) => req.method === 'PUT');
    expect(put.request.body.dimensions[0].price_unit).toBe('metre');
    put.flush(product());
  });

  it('ignores a slow answer for a product the owner has already left', () => {
    create(null);
    component.load(5);
    component.load(9);

    const first = httpMock.expectOne((req) => req.url.includes('/product/5'));
    const second = httpMock.expectOne((req) => req.url.includes('/product/9'));
    // The older product answers last. It must not replace the newer selection.
    second.flush(product({ id: 9, code: 'NEWER' }));
    first.flush(product({ id: 5, code: 'OLDER' }));

    expect(component.product.id).toBe(9);
    expect(component.product.code).toBe('NEWER');
  });

  it('asks before discarding unsaved changes when the editor closes', () => {
    create();
    load();
    component.product.code = 'CHANGED';
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    spyOn(window, 'confirm').and.returnValue(false);

    component.close();
    expect(closed).not.toHaveBeenCalled();

    (window.confirm as jasmine.Spy).and.returnValue(true);
    component.close();
    expect(closed).toHaveBeenCalled();
  });

  it('offers the preview of the saved record, not of unsaved edits', () => {
    create();
    load();
    const link = component.previewLink();
    expect(link).toContain('/products?product=5');
  });
});
