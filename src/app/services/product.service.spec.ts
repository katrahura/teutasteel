import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { ProductService } from './product.service';
import { provideTestConfig } from '../testing/test-providers';
import { clearToken, setToken } from './token-storage';
import { environment } from '../../environments/environment';

/** The test backend may hand back the body already parsed. */
function bodyOf(request: TestRequest): any {
  const body = request.request.body;
  return typeof body === 'string' ? JSON.parse(body) : body;
}

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  const topCategoriesUrl = `${environment.apiUrl}/category/top`;
  const categoryPayload = [
    {
      id: 1,
      title: 'Doors',
      is_active: true,
      top_category: true,
      image_asset: {
        file_name: 'door.jpg',
        alternative_text: 'Door',
        thumbnail_path: 'thumb.jpg',
        original_path: 'orig.jpg',
      },
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTestConfig()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
    clearToken();
  });

  afterEach(() => {
    httpMock.verify();
    clearToken();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('requests a category page with pagination and the requested language', () => {
    // Regression: the language was never sent, so product descriptions always
    // came back in the API's default language.
    service.getCategoryById(5, 2, 8, 'al').subscribe();

    const request = httpMock.expectOne(
      (req) => req.url.split('?')[0] === `${environment.apiUrl}/category/5`
    );
    expect(request.request.urlWithParams).toContain('page=2');
    expect(request.request.urlWithParams).toContain('per_page=8');
    expect(request.request.urlWithParams).toContain('lang=al');
    request.flush({ products: [], pagination: {} });
  });

  it('sends the bearer token when one is stored', () => {
    setToken('jwt-123');
    service.getTopCategories().subscribe();

    const request = httpMock.expectOne((req) => req.url === topCategoriesUrl);
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    request.flush(categoryPayload);
  });

  it('sends no Authorization header when logged out', () => {
    service.getTopCategories().subscribe();

    const request = httpMock.expectOne((req) => req.url === topCategoriesUrl);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(categoryPayload);
  });

  it('rewrites image paths to the Cloudinary delivery URL', () => {
    let delivered: string | undefined;
    service.getTopCategories().subscribe((categories) => {
      delivered = categories[0].image_asset?.original_path;
    });

    httpMock.expectOne((req) => req.url === topCategoriesUrl).flush(categoryPayload);

    expect(delivered).toBe(
      `${environment.cloudinaryBaseUrl}/category_images/orig.jpg`
    );
  });

  it('does not retry a client error', () => {
    // Regression: retry(4) fired five requests at /category/top even though the
    // live API answers 404 there, so every visitor paid for five failures.
    let failed = false;
    service.getTopCategories().subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne((req) => req.url === topCategoriesUrl)
      .flush('nope', { status: 404, statusText: 'Not Found' });
    httpMock.expectNone((req) => req.url === topCategoriesUrl);

    expect(failed).toBeTrue();
  });

  it('retries a server error, then gives up', () => {
    let failed = false;
    service.getTopCategories().subscribe({ error: () => (failed = true) });

    // the first attempt plus four retries
    for (let attempt = 0; attempt < 5; attempt++) {
      httpMock
        .expectOne((req) => req.url === topCategoriesUrl)
        .flush('boom', { status: 500, statusText: 'Server Error' });
    }
    httpMock.expectNone((req) => req.url === topCategoriesUrl);

    expect(failed).toBeTrue();
  });

  it('retries a network error', () => {
    // a request that never reached the server is worth another try
    let failed = false;
    service.getTopCategories().subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne((req) => req.url === topCategoriesUrl)
      .error(new ProgressEvent('error'));
    for (let attempt = 0; attempt < 4; attempt++) {
      httpMock
        .expectOne((req) => req.url === topCategoriesUrl)
        .flush('boom', { status: 500, statusText: 'Server Error' });
    }

    expect(failed).toBeTrue();
  });

  it('leaves the display-only translation fields out of an update', () => {
    // Regression: the product returned by the API also carries slug/description/
    // content for the active language, and sending them back made the API answer
    // 400 "Unknown field." - no product could be edited at all.
    service.updateProduct({
      id: 4,
      code: 'DS-004',
      cut_type: 1,
      is_active: true,
      slug: 'door-sheet-4',
      description: 'display only',
      content: 'display only',
      dimensions: [
        {
          id: 9,
          height: 1,
          width: 1,
          length: 1,
          weight: 1,
          price: 5,
          currency: 'EUR',
          price_history: [{ price: 5 }],
        },
      ],
      translations: [{ id: 1, language: 'en', slug: 's', description: 'd', content: 'c' }],
      image_asset: {
        id: 3,
        file_name: 'door.jpg',
        alternative_text: 'a',
        thumbnail_path: 't.jpg',
        original_path: 'o.jpg',
      },
    } as any).subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}/product/4`);
    const payload = bodyOf(request);

    expect(payload.slug).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.content).toBeUndefined();
    expect(payload.id).toBeUndefined();
    expect(payload.dimensions[0].price_history).toBeUndefined();
    expect(payload.dimensions[0].id).toBe(9);
    expect(payload.translations[0].description).toBe('d');
    expect(payload.image_asset.id).toBeUndefined();
    expect(payload.image_asset.file_name).toBe('door.jpg');
    request.flush({});
  });

  it('saves a product that has no image and no dimensions', () => {
    // Regression: image_asset was destructured unconditionally, which threw
    // before any request was made, so saving did nothing at all.
    expect(() => {
      service.updateProduct({ id: 5, code: 'X', is_active: true } as any).subscribe();
    }).not.toThrow();

    const request = httpMock.expectOne(`${environment.apiUrl}/product/5`);
    const payload = bodyOf(request);
    expect(payload.image_asset).toBeUndefined();
    expect(payload.dimensions).toEqual([]);
    request.flush({});
  });

  it('drops an image asset that has no paths at all', () => {
    // Regression: the admin form used to make the API store a row with empty
    // paths, and this turned it into a Cloudinary URL pointing at nothing
    // instead of letting the template fall back to the placeholder.
    let asset: unknown = 'not set';
    service.getTopCategories().subscribe((categories) => {
      asset = categories[0].image_asset;
    });

    httpMock.expectOne((req) => req.url === topCategoriesUrl).flush([
      {
        id: 1,
        title: 'Doors',
        is_active: true,
        top_category: true,
        image_asset: {
          file_name: '',
          alternative_text: '',
          thumbnail_path: '',
          original_path: '',
        },
      },
    ]);

    expect(asset).toBeUndefined();
  });

  it('leaves empty paths empty when the asset has some content', () => {
    let asset: { original_path?: string; thumbnail_path?: string } | undefined;
    service.getTopCategories().subscribe((categories) => {
      asset = categories[0].image_asset;
    });

    httpMock.expectOne((req) => req.url === topCategoriesUrl).flush([
      {
        id: 1,
        title: 'Doors',
        is_active: true,
        top_category: true,
        image_asset: {
          file_name: 'door.jpg',
          alternative_text: 'Door',
          thumbnail_path: '',
          original_path: '',
        },
      },
    ]);

    expect(asset?.original_path).toBe('');
    expect(asset?.thumbnail_path).toBe('');
  });
});
