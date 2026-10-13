import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HomeComponent } from './home.component';
import { provideTestConfig } from '../../testing/test-providers';
import { environment } from '../../../environments/environment';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  const categoriesUrl = `${environment.apiUrl}/category/tree`;
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

  it('fills the featured row from the API in one request', () => {
    // Regression: this used to fetch the tree and then a dozen sub-categories one at a time -
    // thirteen round trips for four cards, and most of the homepage's second of waiting.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    const featured = httpMock.expectOne(
      (req) => req.url.startsWith(`${environment.apiUrl}/category/featured`)
    );
    expect(featured.request.method).toBe('GET');
    featured.flush({
      products: [
        {
          id: 1,
          code: 'PRICED-1',
          cut_type: 0,
          is_active: true,
          new_product: false,
          category_id: 2,
          image_asset: null,
          translations: [],
          dimensions: [{ id: 9, height: 100, width: 200, length: 300, price: 4.2, currency: 'EUR' }],
        },
      ],
    });
    fixture.detectChanges();

    expect(component.featured.length).toBe(1);
    expect(component.featured[0].code).toBe('PRICED-1');
  });

  it('puts a photograph, then a section it can draw, before a section it cannot', () => {
    // The API sends candidates with photographed ones first, but almost no priced product has a
    // photograph, so the first four can all be products whose card falls back to an unknown-section
    // placeholder - a small dashed square that reads as a photograph that failed to load. The shape
    // map lives in this application, so the order is decided here.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    httpMock
      .expectOne((req) => req.url.startsWith(`${environment.apiUrl}/category/featured`))
      .flush({
        products: [
          // Deliberately worst first, which is the order this is here to change.
          { id: 1, code: 'MYSTERY-1', category_id: 999, image_asset: null, dimensions: [], translations: [] },
          {
            id: 2,
            code: 'TUBE-20x20x1.5',
            category_id: 123,
            image_asset: null,
            translations: [],
            dimensions: [{ id: 3, width: 20, height: 20, thickness: 1.5, price: 5, currency: 'EUR' }],
          },
          {
            id: 3,
            code: 'PHOTO-1',
            category_id: 2,
            translations: [],
            dimensions: [],
            image_asset: { file_name: 'p.jpg', thumbnail_path: 'thumb.jpg', original_path: 'orig.jpg' },
          },
        ],
      });
    fixture.detectChanges();

    expect(component.featured.map((product) => product.code))
      .toEqual(['PHOTO-1', 'TUBE-20x20x1.5', 'MYSTERY-1']);
  });

  it('draws the section on a featured card rather than a mark that reads as a broken picture', () => {
    // The card showed a box-with-a-cross character whenever there was no photograph. At that size it
    // is what a photograph that failed to load looks like, and it was the first thing on the front
    // page. It draws the section now, and keeps the character only where there is nothing to draw.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    httpMock
      .expectOne((req) => req.url.startsWith(`${environment.apiUrl}/category/featured`))
      .flush({
        products: [
          {
            id: 2,
            code: 'TUBE-20x20',
            category_id: 123,
            image_asset: null,
            translations: [],
            dimensions: [{ id: 3, width: 20, height: 20, thickness: 1.5, price: 5, currency: 'EUR' }],
          },
          { id: 1, code: 'MYSTERY-1', category_id: 999, image_asset: null, dimensions: [], translations: [] },
        ],
      });
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.pcard');
    expect(cards[0].querySelector('app-section-drawing')).toBeTruthy();
    expect(cards[0].querySelector('.pcard-none')).toBeFalsy();
    expect(cards[1].querySelector('app-section-drawing')).toBeFalsy();
    expect(cards[1].querySelector('.pcard-none')).toBeTruthy();
  });
});
