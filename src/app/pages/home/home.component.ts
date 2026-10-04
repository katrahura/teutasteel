import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { TopCategory } from '../../models/product.model';
import { SharedService } from '../../shared.service';
import { translateCategoryTitle } from '../../shared/translate-category-title';
import { ImageFallbackDirective } from '../../shared/image-fallback.directive';
import { SERVICES } from '../../shared/services';

declare var bootstrap: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, TranslateModule, ImageFallbackDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnDestroy {
  private subscriptions = new Subscription();
  topCategories: TopCategory[] = [];

  /**
   * The services the company advertises, from shared/services.ts.
   *
   * That list is the one the services page and the quote form use too. Keeping a second copy here
   * is how the home page came to show five services while the services page showed seven.
   */
  readonly services = SERVICES;

  constructor(
    private sharedService: SharedService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private productService: ProductService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Only the browser fetches data: prerendering/SSR must not call the API.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const sub = this.productService.getTopCategories().subscribe({
      next: (data) => {
        this.topCategories = data;
        // after the *ngIf has rendered the slides
        setTimeout(() => this.startCarousel(), 0);
      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.add(sub);
  }

  /**
   * Starts the featured-products carousel.
   *
   * The carousel sits behind *ngIf="topCategories.length", so its element only
   * reaches the DOM after the categories arrive - by which time Bootstrap has
   * already run the DOMContentLoaded pass that turns data-bs-ride into a running
   * carousel. Without this the first slide was the only one ever shown.
   */
  private startCarousel(): void {
    if (typeof bootstrap === 'undefined') {
      return;
    }
    const element = document.getElementById('featuredProductsCarousel');
    if (!element) {
      return;
    }
    bootstrap.Carousel.getOrCreateInstance(element, { interval: 3000 }).cycle();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  navigateToProducts(category: any): void {
    this.sharedService.setCategory(category); // Save the object
    this.router.navigate(['/products']); // Navigate to products page
  }

  /** Category names are stored in one language; translate them for display. */
  categoryTitle(category: any): string {
    return translateCategoryTitle(this.translate, category);
  }
}
