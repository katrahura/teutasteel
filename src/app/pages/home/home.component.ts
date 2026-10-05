import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { Product, TopCategory } from '../../models/product.model';
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
   * The products under "Më të kërkuarat".
   *
   * There is no featured flag in the catalogue, so the rule is: **priced** products, with the
   * **photographed** ones sorted to the front. The audit found the two sets barely overlap - the
   * priced products in the five selling groups have almost no photographs, and the photographed
   * decorative ones are barely priced - so filtering on both would leave the section empty. Sorting
   * rather than filtering fills it, and prefers the complete cards without hiding the rest.
   */
  featured: Product[] = [];

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
    // The tree, not the top categories: the tiles need the counts, which both carry, but the
    // featured row needs the children, which only the tree has.
    const sub = this.productService.getCategoryTree().subscribe({
      next: (data) => {
        this.topCategories = data;
        this.loadFeatured();
      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.add(sub);
  }

  /**
   * A page of products from the busiest sub-categories, then the best few for the featured row.
   *
   * The products are not in the top-level groups. Decorative metal holds none of its own - they live
   * in sub-categories like Laser sheets - and /category/107 returned zero products for every one of
   * the six groups, which is why the section came out empty. The tree gives each group's children,
   * so this asks the children with the most products.
   *
   * Each request fails on its own: with forkJoin alone, one bad response empties the whole row and
   * the failure is invisible, which is exactly what happened.
   */
  private loadFeatured(): void {
    const targets: any[] = [];
    (this.topCategories || []).forEach((group: any) => {
      (group.children || [])
        .filter((child: any) => child.id && (child.product_count || 0) > 0)
        .sort((a: any, b: any) => (b.product_count || 0) - (a.product_count || 0))
        .slice(0, 2)
        .forEach((child: any) => targets.push(child));
    });
    const wanted = targets.slice(0, 12);
    if (!wanted.length) {
      return;
    }
    const language = this.translate.currentLang || 'al';
    const calls = wanted.map((child: any) =>
      this.productService.getCategoryById(child.id, 1, 8, language).pipe(
        catchError(() => of({ products: [] } as any))
      )
    );
    const sub = forkJoin(calls).subscribe({
      next: (responses: any[]) => {
        const all: Product[] = [];
        (responses || []).forEach((response: any) => {
          (response && response.products ? response.products : []).forEach((product: Product) => {
            all.push(product);
          });
        });
        this.featured = all
          .filter((product) => this.hasPrice(product))
          .sort((a, b) => this.photographs(b) - this.photographs(a))
          .slice(0, 4);
      },
      error: () => {
        // A failure here leaves the section out rather than breaking the page.
        this.featured = [];
      },
    });
    this.subscriptions.add(sub);
  }

  /** Whether any of a product's dimensions carries a price. */
  private hasPrice(product: Product): boolean {
    return (product.dimensions || []).some((dimension: any) => Number(dimension.price) > 0);
  }

  /** How many photographs a product has, for sorting: 1 if it has one, 0 if not. */
  private photographs(product: Product): number {
    const asset = (product as any).image_asset;
    return asset && asset.original_path ? 1 : 0;
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
