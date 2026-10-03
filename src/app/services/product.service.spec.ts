import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ProductService } from './product.service';
import { provideTestConfig } from '../testing/test-providers';
import { clearToken, setToken } from './token-storage';
import { environment } from '../../environments/environment';

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
