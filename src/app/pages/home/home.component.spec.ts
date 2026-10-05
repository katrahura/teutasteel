import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HomeComponent } from './home.component';
import { provideTestConfig } from '../../testing/test-providers';
import { environment } from '../../../environments/environment';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  const categoriesUrl = `${environment.apiUrl}/category/top`;
  const categories = [
    { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null, product_count: 12 },
    {
      id: 2, title: 'Profiles', is_active: true, top_category: true,
      image_asset: { original_path: '/uploads/profiles.jpg', alternative_text: 'Profiles' },
      product_count: 30,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideTestConfig()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('states the number of products each group holds', () => {
    // The figure comes from the API's product_count, which counts active branches only, so the tile
    // cannot promise products in a sub-category that is switched off.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('12');
    expect(text).toContain('30');
  });

  it('sums the reachable products for the trust strip', () => {
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    fixture.detectChanges();

    expect(component.catalogueTotal).toBe(42);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('42');
  });

  it('shows a photograph where a category has one, and an icon where it does not', () => {
    // Regression: the binding had no fallback, so an empty src was rendered - a wasted request for
    // the page itself and no image. Now a category without a photograph gets an icon instead, and
    // no img element at all.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    fixture.detectChanges();

    // Scoped to the group tiles: the services below them have photographs of their own, and
    // counting every img on the page made this fail on the four service images.
    const tiles = (fixture.nativeElement as HTMLElement).querySelector('.tiles') as HTMLElement;
    const images = Array.from(tiles.querySelectorAll('img')) as HTMLImageElement[];
    expect(images.length).toBe(1);
    expect(images[0].getAttribute('src')).toContain('profiles.jpg');
    expect(images.every((img) => !!img.getAttribute('src'))).toBeTrue();
    expect(tiles.querySelectorAll('.ico').length).toBe(1);
  });
});
