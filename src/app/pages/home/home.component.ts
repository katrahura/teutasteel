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
import { environment } from '../../../environments/environment';

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

  /** Contact details from the environment, so a changed number is changed in one place. */
  readonly phone = environment.phone;
  readonly whatsappLink = 'https://wa.me/' + environment.whatsappNumber;

  /**
   * The hero card's claims, as translation keys.
   *
   * Every one of them is something the shop demonstrably does - the same services the services page
   * lists, the request list built into the catalogue, the units printed on every price. The mockup's
   * card said "Prerje në masë, pa minimum" and I do not know whether there is a minimum, so it is
   * not claimed.
   */
  readonly whyPoints = ['HOME.WHY_1', 'HOME.WHY_2', 'HOME.WHY_3', 'HOME.WHY_4'];

  /**
   * What a visitor can actually reach, across every group. Summed rather than stored, and each
   * group's figure comes from the API's product_count, which counts active branches only.
   */
  get catalogueTotal(): number {
    return (this.topCategories || []).reduce(
      (sum, category: any) => sum + (category.product_count || 0), 0
    );
  }

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
      next: (data) => { this.topCategories = data; },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.add(sub);
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

  /** The hero's search box hands its term to the products page, which owns the searching. */
  goToSearch(event: Event, term: string): void {
    event.preventDefault();
    const query = (term || '').trim();
    this.router.navigate(['/products'], query ? { queryParams: { q: query } } : {});
  }
}
