import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ProductsComponent } from './products.component';
import { provideTestConfig } from '../../testing/test-providers';
import { environment } from '../../../environments/environment';

describe('ProductsComponent', () => {
  let component: ProductsComponent;
  let fixture: ComponentFixture<ProductsComponent>;
  let httpMock: HttpTestingController;

  const groupsUrl = `${environment.apiUrl}/category/top`;

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
    // "Failed to load categories". getTopCategories retries four times, so the
    // first attempt plus four retries have to fail.
    for (let attempt = 0; attempt < 5; attempt++) {
      httpMock
        .expectOne((req) => req.url === groupsUrl)
        .flush('nope', { status: 404, statusText: 'Not Found' });
    }

    expect(component.groupsError).toBe('PRODUCTS.LOAD_ERROR');
    expect(component.loadingGroups).toBeFalse();
  });
});
