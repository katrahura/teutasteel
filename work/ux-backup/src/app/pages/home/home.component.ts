import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { Product, TopCategory } from '../../models/product.model';
import { SharedService } from '../../shared.service';
import { translateCategoryTitle } from '../../shared/translate-category-title';
import { ImageFallbackDirective } from '../../shared/image-fallback.directive';
import { SERVICES } from '../../shared/services';
import { shapeFor } from '../../shared/section-shape';
import { SectionDrawingComponent } from '../../shared/section-drawing/section-drawing.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, TranslateModule, ImageFallbackDirective, SectionDrawingComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnDestroy {
  private subscriptions = new Subscription();
  topCategories: TopCategory[] = [];

  /**
   * The products in the "Featured products" row.
   *
   * Filled from the API's own endpoint, which takes priced products and prefers the photographed
   * ones. Not from popularity: this shop records no demand, which is why the heading stopped
   * claiming "most asked for".
   */
  featured: Product[] = [];

  /**
   * The photograph behind the hero.
   *
   * The review asked for a strong photograph of the workshop, the stock or finished work, with the
   * slate and amber identity kept - so the picture sits **under** the existing gradient rather than
   * replacing it. This one came from an image model, which is why `samplePhoto` is true and the
   * hero says so on the page: a photograph on the front page reads as "this is us", and until it
   * is, the page has to say otherwise.
   *
   * To make it real: put your own photograph in `assets/gallery/`, change the path here, and set
   * `samplePhoto` to false - which removes the note.
   */
  readonly heroPhoto = 'assets/gallery/hero-kit.jpg';
  readonly samplePhoto = true;

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
    // Both at once. The featured row no longer works anything out from the tree, so making it wait
    // for a catalogue-wide request would put that request's whole duration in front of four cards
    // for no reason - five seconds of it on the development backend.
    this.loadFeatured();
    const sub = this.productService.getCategoryTree().subscribe({
      next: (data) => {
        this.topCategories = data;
      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.add(sub);
  }

  /**
   * The featured row, in one request.
   *
   * This used to work the choice out in the browser: fetch the tree, take the two busiest
   * sub-categories of every group, then ask for each of those on its own - thirteen round trips for
   * four cards, and most of the homepage's second of waiting. The API makes the same choice now,
   * where the data already is, so the section costs one call.
   */
  /**
   * One value from a product's first dimension, in the shape the drawing wants.
   *
   * The drawing reads width, height, thickness and length from the product's own numbers, the way the
   * products page hands them over.
   */
  dimensionOf(product: Product, field: 'width' | 'height' | 'thickness' | 'length'): number | string | null {
    const first = (product?.dimensions || [])[0] as Record<string, unknown> | undefined;
    const value = first ? first[field] : null;
    return (value === undefined ? null : value) as number | string | null;
  }

  /**
   * Whether this product's section can be drawn at all.
   *
   * Where it cannot, the card shows a restrained mark rather than an empty box: a section that is not
   * known is honest, and a box with a cross in it reads as a picture that failed to load.
   */
  hasShape(product: Product): boolean {
    const shape = shapeFor(
      product?.category_id,
      product?.code,
      this.dimensionOf(product, 'width') as number,
      this.dimensionOf(product, 'height') as number,
      this.dimensionOf(product, 'thickness') as number
    );
    return shape !== 'plain';
  }

  private loadFeatured(): void {
    const language = this.translate.currentLang || 'al';
    const sub = this.productService.getFeatured(language).subscribe({
      next: (response) => {
        this.featured = this.bestFour((response && response.products) || []);
      },
      error: () => {
        // A failure here leaves the section out rather than breaking the page.
        this.featured = [];
      },
    });
    this.subscriptions.add(sub);
  }

  /**
   * The four to show, best first.
   *
   * A photograph beats everything on this catalogue, so those come first. After them come the
   * products whose section can actually be drawn from the code and the dimensions - the drawing is
   * the whole reason a product without a picture is still worth showing. Last are the ones whose
   * section is unknown: their card is a small dashed square that, at this size, reads as a
   * photograph that failed to load, which is the wrong first impression for a shop's front page.
   *
   * The API sends twelve candidates for exactly this choosing; the shape map lives here, so the
   * choice is made here. Equal ranks keep the API's order, which is fixed, so the row does not
   * shuffle between visits.
   */
  private bestFour(products: Product[]): Product[] {
    const rank = (product: Product): number => {
      if (product?.image_asset?.thumbnail_path) {
        return 0;
      }
      const first = (product?.dimensions || [])[0] as
        | { width?: number | null; height?: number | null; thickness?: number | null }
        | undefined;
      const shape = shapeFor(
        product?.category_id, product?.code, first?.width, first?.height, first?.thickness
      );
      return shape === 'plain' ? 2 : 1;
    };
    return (products || [])
      .map((product, index) => ({ product, index, rank: rank(product) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, 4)
      .map((entry) => entry.product);
  }

  /**
   * The first price the product carries, with its currency, for the featured card.
   *
   * The unit - per sheet, per tube, per bar - is already in the description underneath, because
   * every description written for this catalogue ends by saying what the price buys.
   */
  priceOf(product: Product): string | null {
    const priced = (product.dimensions || []).find(
      (dimension: any) => Number(dimension.price) > 0
    ) as any;
    if (!priced) {
      return null;
    }
    return `${priced.price} ${priced.currency || 'Eur'}`;
  }

  /** How many photographs a product has, for sorting: 1 if it has one, 0 if not. */

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
