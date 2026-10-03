import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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
    { id: 1, title: 'Doors', is_active: true, top_category: true, image_asset: null },
    { id: 2, title: 'Profiles', is_active: true, top_category: true, image_asset: null },
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

  afterEach(() => {
    delete (window as unknown as { bootstrap?: unknown }).bootstrap;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the placeholder image when a category has no image', () => {
    // Regression: the binding had no fallback, so an empty src was rendered - a
    // wasted request for the page itself and no image.
    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    fixture.detectChanges();

    const images = [...fixture.nativeElement.querySelectorAll('img')] as HTMLImageElement[];
    const categoryImages = images.filter((img) => img.getAttribute('src')?.includes('placeholder_category'));
    expect(categoryImages.length).toBeGreaterThan(0);
    expect(images.every((img) => !!img.getAttribute('src'))).toBeTrue();
  });

  it('starts the carousel once the slides exist', fakeAsync(() => {
    // Regression: the carousel lives behind *ngIf, so Bootstrap's DOMContentLoaded
    // auto-initialisation never saw it and data-bs-ride did nothing - the second
    // slide was never shown.
    const cycle = jasmine.createSpy('cycle');
    let options: unknown;
    (window as unknown as { bootstrap: unknown }).bootstrap = {
      Carousel: {
        getOrCreateInstance: (_element: unknown, config: unknown) => {
          options = config;
          return { cycle };
        },
      },
    };

    httpMock.expectOne((req) => req.url === categoriesUrl).flush(categories);
    fixture.detectChanges();
    tick(1);

    expect(cycle).toHaveBeenCalled();
    expect(options).toEqual({ interval: 3000 });
  }));
});
