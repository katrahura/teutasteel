import {  ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';
import { forkJoin, of, switchMap } from 'rxjs';

import { ProductService } from '../../services/product.service';
import { translateCategoryTitle } from '../../shared/translate-category-title';
import { ImageFallbackDirective } from '../../shared/image-fallback.directive';
import { SectionDrawingComponent } from '../../shared/section-drawing/section-drawing.component';
import { isSheet, shapeFor } from '../../shared/section-shape';
import { environment } from '../../../environments/environment';
import {
  Category,
  CategoryFacets,
  CategoryResponse,
  Product,
  ProductDimension,
  ImageAsset,
  TopCategory            
} from '../../models/product.model';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SharedService } from '../../shared.service';
import { QuoteListService, QuoteItem } from '../../shared/quote-list.service';
import { describeWeight, shapeForCategory } from '../../shared/steel-weight';
type DimensionKey =
  | 'height'
  | 'width'
  | 'length'
  | 'thickness'
  | 'weight'
  | 'price'
  | 'currency';
  declare var bootstrap: any;

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FormsModule, ImageFallbackDirective, SectionDrawingComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('0.2s ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class ProductsComponent implements OnInit, OnDestroy {
topCategories: TopCategory[] = [];
childrenMap = new Map<number, Category[]>(); // parentId -> children[]
loadingGroups = false;
groupsError: string | null = null;
/** Holds a translation key for the save confirmation; the template pipes it. */
statusMessage: string | null = null;
trackById = (_: number, item: { id?: number }) => item.id!;
expandedParentId: number | null = null;
toggleParent(parentId: number) {
  this.expandedParentId = (this.expandedParentId === parentId) ? null : parentId;
}
  subscriptions: Subscription[] = [];
  showingGroups = true;
  dimensionKeys: DimensionKey[] = [
    'height',
    'width',
    'length',
    'weight',
    'price',
    'currency',
  ];
  selectedCategory: Category | null = null;

  /** The search box: what is typed, what was searched, and whether a search is in flight. */
  searchQuery = '';
  searchTerm = '';
  searching = false;
  private searchTimer: any = null;
  private searchSubscription?: Subscription;
  searchError = false;
  /** The product whose editor was already opened from a link, so it is not opened twice. */
  private openedEditorFor: number | null = null;
  /** A product named in the address, waiting for its category to load. */
  private pendingProductId: number | null = null;
  /** The same, for a category's editor. A separate field: a product and a category can share an id. */
  private openedCategoryEditorFor: number | null = null;

  /** The group to scroll to once the list has rendered, when the visitor arrived from a card. */
  private scrollToGroupId: number | null = null;
  products: Product[] = [];
  selectedProduct: any = null;
  currentPage = 1;
  totalPages = 1;

  /**
   * Narrowing a category, which is what makes a group with hundreds of products usable.
   *
   * The thickness is a list because a category holds at most eighteen of them; the size is a range
   * because one holds up to sixty-two, and a dropdown of sixty-two is not a control anybody uses.
   * The choices come from the API's facets - what this category actually holds - rather than from a
   * list written down here, which would drift the first time a size was added.
   */
  facets: CategoryFacets | null = null;
  filterThickness: number | null = null;
  filterMinHeight: number | null = null;
  filterMaxHeight: number | null = null;
  /** How many products the filter matches altogether, not just on this page. */
  totalItems = 0;
  isLoading = true; // Default to loading
  isLoggedIn: boolean = false;
  newCategory: Category = this.emptyCategory();

  private emptyCategory(): Category {
    return {
      title: '',
      is_active: true,
      // top_category is not sent: the backend derives it from the parent, so that the
      // legacy flag and the grouping can never disagree.
      image_asset: {
        file_name: '',
        alternative_text: '',
        thumbnail_path: '',
        original_path: '',
      },
    };
  }
  getTranslatedCategoryTitle(category: any): string {
    return translateCategoryTitle(this.translate, category);
  }

    newProduct: Product = {
      code: '',
      category_id: 0,
      new_product:false,
      dimensions: [
        {
          height: 0,
          width: 0,
          length: 0,
          weight: 0,
          price: 0,
          currency: 'EUR',
        },
      ],
      translations: [
        {
          language: 'en',
          slug: '',
          description: '',
          content: '', // IMPORTANT if your schema expects "content"
        },
      ],
      cut_type: 0,
      is_active: true,
      image_asset: {
        file_name: '',
        alternative_text: '',
        thumbnail_path: '',
        original_path: '',
      },
    };
    
  
  // Cut Type Names Mapping
  cutTypeNames: { [key: number]: string } = {
    1: 'Type A',
    2: 'Type B',
    3: 'Type C',
    // Add other mappings as needed
  };
  constructor(private translate: TranslateService ,public sharedService: SharedService,private router: Router,private route: ActivatedRoute,private productService: ProductService,@Inject(PLATFORM_ID) private platformId: Object,private authService: AuthService, private changeDetector: ChangeDetectorRef, private quoteList: QuoteListService) {
    // Read once on construction; the service guards its storage, so the prerender is safe here.
    this.quoteCount = this.quoteList.count();
  }

  /** How many items are on the request list, for the bar above the products. */
  quoteCount = 0;

  /** The last product added, so the page can acknowledge it. */
  quoteNotice = '';

  /**
   * Put a product on the request list.
   *
   * A card has no thickness picker - that lives in the detail dialog - so it adds the product with
   * the dimension it is showing. The dialog passes the thicknesses the customer ticked, and each
   * becomes its own line so the shop can price them separately.
   */
  /** Lines of the open product that are already on the request list, keyed by stable variant identity. */
  onList: { [detail: string]: number } = {};

  /** What the last add put in, shown under the thicknesses. */
  justAdded = '';

  /** Which lines of this product are on the request list. Built once, never read per pass. */
  private linesOnList(product: Product): { [detail: string]: number } {
    this.migrateLegacyQuote(product);
    const map: { [detail: string]: number } = {};
    this.quoteList.items().forEach((item) => {
      if (item.productId === (product.id || 0)) {
        map[item.variantKey || item.detail || ''] = item.quantity;
      }
    });
    return map;
  }

  /** How many of this thickness are already on the request list, for the badge beside it. */
  onListQuantity(dimension: ProductDimension): number {
    return this.onList[this.variantKey(dimension)] || 0;
  }

  /**
   * When the dialog opens, show what the customer already asked for.
   *
   * The thicknesses they have already added come back ticked, with their quantities in the fields
   * and a badge beside each line. Opening a product that is already in the request should look like
   * their order, not like a blank form - and it is how they change a quantity rather than adding
   * the same thing twice.
   */
  private seedFromRequestList(product: Product): void {
    this.onList = this.linesOnList(product);
    this.justAdded = '';
    const chosen: { [index: number]: boolean } = {};
    const quantities: { [index: number]: number } = {};
    (product.dimensions || []).forEach((dimension, index) => {
      const quantity = this.onList[this.variantKey(dimension)];
      if (quantity) {
        chosen[index] = true;
        quantities[index] = quantity;
      }
    });
    this.chosenDimensions = chosen;
    this.quantities = quantities;
  }

  addToQuote(product: Product, dimensions?: ProductDimension[]): void {
    this.migrateLegacyQuote(product);
    // With nothing passed - the card, which has no picker - add the dimension it is showing rather
    // than every thickness the product carries, which for a merged sheet would be fourteen lines.
    const chosen = dimensions && dimensions.length
      ? dimensions
      : (product.dimensions || []).slice(0, 1);
    if (!chosen.length) {
      return;
    }
    // Replace, do not add. The dialog shows the customer's order as it stands - the ticks and the
    // numbers came from the list - so lowering twenty to fifteen has to mean fifteen. Adding would
    // make it thirty-five, which is how this was wrong before. A thickness they have unticked is
    // taken off; one they left ticked keeps its new number.
    const ticked = chosen.map((dimension) => this.variantKey(dimension));
    (product.dimensions || []).forEach((dimension) => {
      const item = this.quoteItem(product, dimension);
      const key = this.variantKey(dimension);
      if (ticked.indexOf(key) >= 0) {
        this.quoteList.setQuantity(item, this.quantityFor(product, dimension));
      } else if (this.onList[key]) {
        this.quoteList.setQuantity(item, 0);
      }
    });
    this.quoteCount = this.quoteList.count();
    this.quoteNotice = product.code;
    // Read the quantities first, because re-seeding replaces them with what the list holds.
    const summary = chosen
      .map((dimension) => `${this.quantityFor(product, dimension)} × ${this.describeDimension(dimension)}`)
      .join(' · ');
    // Leave the dialog showing the order as it now stands, rather than an empty form. Clearing the
    // ticks - which is what this did - also took away the quantity field and greyed the add button,
    // so the dialog looked broken until it was closed and reopened. Reopening did nothing more than
    // re-seed from the list; that is what happens here now, and straight away.
    this.seedFromRequestList(product);
    this.justAdded = summary;
  }

  /** "Trashësia 1.5 mm — 4.80 Eur", or as much of that as the dimension knows. */
  private migrateLegacyQuote(product: Product): void {
    this.quoteList.migrateLegacy(product.id || 0, (product.dimensions || []).map(dimension => ({
      signature: this.showsValue(dimension.thickness) ? String(Number(dimension.thickness))
        : [dimension.height, dimension.width].filter(value => !!value).map(Number).join(':'),
      variantKey: this.variantKey(dimension),
    })));
  }

  private variantKey(dimension: ProductDimension): string {
    if (dimension.id != null) return 'id:' + dimension.id;
    return 'size:' + ['height', 'width', 'length', 'thickness', 'weight']
      .map(key => Number((dimension as any)[key] || 0)).join(':');
  }

  private quoteItem(product: Product, dimension: ProductDimension): QuoteItem {
    const price = Number(dimension.price);
    return { productId: product.id || 0, code: product.code,
      variantKey: this.variantKey(dimension), detail: this.describeDimension(dimension),
      dimensions: { height: dimension.height, width: dimension.width, length: dimension.length, thickness: dimension.thickness, weight: dimension.weight },
      unitPrice: Number.isFinite(price) && price > 0 ? price : null,
      currency: dimension.currency || 'EUR', quantity: 0 };
  }

  private describeDimension(dimension: ProductDimension): string {
    const parts: string[] = [];
    if (this.showsValue(dimension.thickness)) {
      parts.push(`${this.translate.instant('PRODUCTS.THICKNESS')} ${dimension.thickness} mm`);
    }
    if (this.showsValue(dimension.height)) {
      parts.push(`${dimension.height}${dimension.width ? ' × ' + dimension.width : ''} mm`);
    }
    if (this.showsValue(dimension.length)) parts.push(this.formatLength(dimension.length));
    if (this.showsValue(dimension.price)) {
      parts.push(`${dimension.price} ${dimension.currency || ''}`.trim());
    }
    return parts.join(' — ');
  }

  /**
   * What one dimension of this product weighs, or null when it cannot be worked out.
   *
   * Steel is bought by weight and the catalogue stores almost none of it, so this is worked out from
   * the section: a round tube is an annulus, a rectangular one is its perimeter at the wall, a flat
   * bar is width times thickness. Sheets are weighed whole. Anything the shape is not known for gets
   * nothing rather than a number that would be wrong.
   */
  weightFor(product: Product, dimension: ProductDimension): string | null {
    // The category listing does not carry each product's category, and the page already knows which
    // one is open - so fall back to that rather than losing the weight for want of a label.
    const category = (product as any)?.category || (this as any).selectedCategory;
    const shape = shapeForCategory(category ? category.title : null);
    return describeWeight(shape, {
      height: dimension?.height,
      width: dimension?.width,
      thickness: dimension?.thickness,
      length: dimension?.length,
    });
  }

  /**
   * What a price is for, in the shortest words that fit on a card: per sheet, per tube, per bar.
   *
   * Worked out from the section shape, which comes from the category - the same source the weight
   * calculator uses. The audit's complaint was that no price on the site said what it bought; the
   * descriptions now carry it in prose, and this is the version a card can show beside the number.
   */
  priceUnit(product: Product): string {
    const category = (product as any)?.category || (this as any).selectedCategory;
    const shape = shapeForCategory(category ? category.title : null);
    const keys: { [key: string]: string } = {
      sheet: 'PRODUCTS.UNIT_SHEET',
      round: 'PRODUCTS.UNIT_TUBE',
      rectangular: 'PRODUCTS.UNIT_TUBE',
      flat: 'PRODUCTS.UNIT_METRE',
      angle: 'PRODUCTS.UNIT_BAR',
    };
    const key = keys[shape];
    return key ? this.translate.instant(key) : '';
  }

  /** The dimensions the customer ticked, or the only one there is. */
  /**
   * The quantity typed on a card, for products with a single dimension.
   *
   * The owner's design: the field is always there, starting at one, and the button records whatever
   * number it holds. Nothing to open, nothing to guess, and the twenty-piece order is typed before
   * the click rather than after it.
   */
  cardQuantities: { [productId: number]: number } = {};

  /** Products whose image failed to load, so they get the drawn chip rather than a broken frame. */
  private noImage = new Set<number>();

  /**
   * Whether there is a photograph to show.
   *
   * Takes null as well as a product: the dialog sits in the DOM from the start with nothing
   * selected, and an expression that throws on every change-detection pass takes the whole view
   * down with it - the product list stopped rendering because of this line, and the error went to
   * the console as a template failure rather than as an exception.
   */
  hasPhoto(product: Product | null | undefined): boolean {
    return !!product?.image_asset?.thumbnail_path && !this.noImage.has(product?.id || 0);
  }

  /** Called from the template when a photograph cannot be loaded. */
  markNoImage(product: Product | null | undefined): void {
    this.noImage.add(product?.id || 0);
  }

  /**
   * The size in one line: "15×15×1.3 · 6 m", "Ø21×3.2 · 6 m", "1×2×1.2" for a sheet.
   *
   * The card used to spell out "Lartësia: 15 mm / Gjerësia: 15 mm / Trashësia: 1.3 mm" over three
   * or four lines, which is how a catalogue is read on paper, not how a grid is scanned on a screen.
   * The full list stays in the dialog, where somebody has already chosen the product.
   *
   * No unit follows the section, because the catalogue does not agree with itself on one: sheets are
   * entered as 1000 x 2000 in millimetres and some sheet sizes as 2 x 1 in metres, so "1x2 mm" under
   * a sheet that is a metre by two was out by a factor of a thousand. The length is a different
   * question and the catalogue is consistent about it - 6000 is six metres - so it is said, and a
   * customer comparing tubes is choosing a length as much as a section.
   */
  shortSize(product: Product | null | undefined, categoryId?: number | null): string {
    const dimension = (product?.dimensions || [])[0];
    if (!dimension) {
      return '';
    }
    const asNumber = (value: any) => (this.showsValue(value) ? Number(value) : null);
    const shape = shapeFor(
      categoryId,
      product?.code,
      asNumber(dimension.width),
      asNumber(dimension.height),
      asNumber(dimension.thickness)
    );

    // A sheet is sold by its flat size and its thickness - 1000 x 2000 x 0.5, the way a steel table
    // writes it. Reading it as "1000 x 0.5 - 2 m" left the thickness where the width belongs, and
    // the length in metres alongside two numbers in millimetres.
    //
    // The second size is the length where there is one, and the height where there is not. It has to
    // be asked with showsValue rather than ??, because the catalogue stores the length of a laser
    // sheet as the number 0 rather than as nothing - and ?? accepts a zero, which left four hundred
    // decorative sheets reading "1000" instead of "1000 x 2000".
    if (isSheet(shape)) {
      const second = this.showsValue(dimension.length) ? dimension.length : dimension.height;
      return [dimension.width, second, dimension.thickness]
        .filter((value) => this.showsValue(value))
        .map((value) => String(Number(value)))
        .join(' × ');
    }

    const values = [dimension.height, dimension.width, dimension.thickness]
      .filter((value) => this.showsValue(value))
      .map((value) => String(Number(value)));
    if (!values.length) {
      const lengthOnly = this.showsValue(dimension.length) ? this.formatLength(dimension.length) : '';
      return lengthOnly;
    }
    // A round section is read with its diameter sign, the way it is written on a drawing.
    const round = (product?.code || '').indexOf('Ø') >= 0;
    const section = (round ? 'Ø' : '') + values.join('×');
    const length = this.showsValue(dimension.length) ? this.formatLength(dimension.length) : '';
    return length ? `${section} · ${length}` : section;
  }

  /**
   * Which profile to draw when there is no photograph.
   *
   * 429 products have none, and a grey plate saying "No product image" in English made the
   * catalogue look unfinished. A drawn section with its size looks like what it is: a technical list.
   */
  profileClass(product: Product | null | undefined): string {
    const code = product?.code || '';
    if (code.indexOf('Ø') >= 0 || /DN-/.test(code)) {
      return 'p-round';
    }
    if (/^Llam/i.test(code)) {
      return 'p-flat';
    }
    if (/^L[\s\d]/i.test(code)) {
      return 'p-angle';
    }
    return 'p-square';
  }

  /** productId -> how many are already on the request list, for the single-dimension cards. */
  onListByProduct: { [productId: number]: number } = {};

  /** Rebuild that map. Called when a page of products arrives and after every card add. */
  private refreshCardList(): void {
    const map: { [productId: number]: number } = {};
    this.quoteList.items().forEach((item) => {
      map[item.productId] = (map[item.productId] || 0) + (item.quantity || 0);
    });
    this.onListByProduct = map;
  }

  cardQuantity(product: Product): number {
    const id = product.id || 0;
    const typed = this.cardQuantities[id];
    if (typeof typed === 'number' && typed > 0) {
      return typed;
    }
    // Nothing typed yet: show what is already ordered rather than a blind one, so the card reads
    // the same as the dialog does for a product with several thicknesses.
    return this.onListByProduct[id] || 1;
  }

  setCardQuantity(product: Product, value: any): void {
    const number = Number(value);
    this.cardQuantities = {
      ...this.cardQuantities,
      [product.id || 0]: Number.isFinite(number) && number > 0 ? Math.floor(number) : 1,
    };
  }

  /** A card's add for a single-dimension product: the dimension it shows, and the typed quantity. */
  addCardToQuote(product: Product): void {
    this.migrateLegacyQuote(product);
    const dimension = (product.dimensions || [])[0];
    if (!dimension) {
      return;
    }
    // Replace, like the dialog. The field shows what is already ordered, so adding would double it:
    // a card reading 20 and pressed twice would mean 40.
    this.quoteList.setQuantity(
      this.quoteItem(product, dimension),
      this.cardQuantity(product)
    );
    this.quoteCount = this.quoteList.count();
    this.quoteNotice = product.code;
    this.refreshCardList();
  }

  /**
   * What a card's add button does.
   *
   * A product with one dimension has nothing to choose, so the card adds it with the quantity shown
   * beside the button. A product with several has a thickness to pick and a quantity per thickness,
   * and only the dialog can ask for both - so the card opens it rather than guessing at either.
   */
  /**
   * A card's own click.
   *
   * A product with one dimension puts everything on the card - the size, the price, the quantity
   * field and both buttons - so a dialog over the top of it adds nothing and only gets in the way.
   * A product with several has a thickness to choose, and only that one opens.
   */
  openDetail(product: Product, event: Event): void {
    if ((product.dimensions || []).length <= 1) {
      return;
    }
    this.openModal(product, event);
    // After openModal, not before: opening a product clears the ticks, so seeding first was wiped
    // - the badges survived because openModal does not know about them, and that asymmetry is what
    // pointed at the order.
    this.seedFromRequestList(product);
  }

  /**
   * Whether a group has any active sub-category to drill into.
   *
   * The groups list comes from /category/top, which carries no children - this page fetches them
   * separately into childrenMap. Reading the row's own `children` would have found nothing and left
   * the button on every row, a change that looks like it worked and did not.
   */
  hasActiveChildren(category: any): boolean {
    const children = this.childrenMap.get(category?.id) || [];
    return children.some((child: any) => child.is_active !== false);
  }

  addOrOpen(product: Product, event: Event): void {
    event.stopPropagation();
    if ((product.dimensions || []).length > 1) {
      this.openModal(product, event);
    // After openModal, not before: opening a product clears the ticks, so seeding first was wiped
    // - the badges survived because openModal does not know about them, and that asymmetry is what
    // pointed at the order.
    this.seedFromRequestList(product);
      return;
    }
    this.addCardToQuote(product);
  }

  tickedDimensions(product: Product): ProductDimension[] {
    const dimensions = (product?.dimensions || []) as ProductDimension[];
    if (dimensions.length <= 1) {
      return dimensions;
    }
    return dimensions.filter((_dimension: ProductDimension, index: number) =>
      this.isChosen(index)
    );
  }

  openModal(product: any, event: Event): void {
    event.stopPropagation(); // Stop event propagation
    this.selectedProduct = product;
    this.clearChoices();

    // Only in a browser. This was reachable by clicking a card, so `document` and Bootstrap were
    // always there; opening a product from a shared link made it reachable from the category's
    // response as well, and that also arrives while the page is being rendered on the server. There
    // it threw "ReferenceError: document is not defined" on every server render of that address.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // The address now points at this product, so it can be sent to somebody or bookmarked. The
    // category goes with it: the single-product endpoint asks for a token, so a link that has to
    // work for anybody has to say which category listing to find the product in.
    this.rememberProduct(product?.id ?? null);

    // Ensure Angular detects the change

    // Open the Bootstrap modal
    const modalElement = document.getElementById('productDetailsModal');
    // Bootstrap closes the dialog on Escape and on the backdrop without telling the component, so
    // the address would go on pointing at a product nobody is looking at.
    modalElement?.addEventListener('hidden.bs.modal', () => this.rememberProduct(null), { once: true });
    const modalInstance = new bootstrap.Modal(modalElement as HTMLElement);
    modalInstance.show();
  }

  /**
   * Keep the open product in the address, or take it out.
   *
   * A null removes the parameter and leaves the category alone: closing a product's dialog leaves
   * the visitor browsing the category they were in.
   */
  private rememberProduct(productId: number | null): void {
    const queryParams: Record<string, number | null> = { product: productId };
    if (productId && this.selectedCategory?.id) {
      queryParams['category'] = this.selectedCategory.id;
    }
    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Open the product a shared link named, once its category has arrived.
   *
   * The listing is where the product comes from, because that endpoint is open to anybody and the
   * single-product one is not - which also means the link carries the category.
   */
  private openWaitingProduct(): void {
    const wanted = this.pendingProductId;
    if (!wanted) {
      return;
    }
    this.pendingProductId = null;
    const product = this.products.find((item) => item.id === wanted);
    if (product) {
      this.openModal(product, new Event('click'));
    }
  }
  
  closeModal(): void {
    const modalElement = document.getElementById('productDetailsModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  
    // Remove inert from body
    document.body.removeAttribute('inert');
  
    this.selectedProduct = null; // Clear selected product context
  }
  
  
  
  getFileNameFromPath(path: string): string {
    return path ? path.split('/').pop() || '' : '';
  }
  get thumbnailPath(): string {
    return this.selectedProduct?.image_asset?.thumbnail_path
      ? this.selectedProduct.image_asset.thumbnail_path.split('/').pop() || ''
      : '';
  }
  
  set thumbnailPath(value: string) {
    if (this.selectedProduct?.image_asset) {
      this.selectedProduct.image_asset.thumbnail_path = value;
  
    }
  }
  
  get originalPath(): string {
    return this.selectedProduct?.image_asset?.original_path
      ? this.selectedProduct.image_asset.original_path.split('/').pop() || ''
      : '';
  }
  
  set originalPath(value: string) {
    if (this.selectedProduct?.image_asset) {
      this.selectedProduct.image_asset.original_path = value;
  
    }
  }
  navigateLeft(): void {
    this.navigateProduct(-1);
  }
  
  navigateRight(): void {
    this.navigateProduct(1);
  }
  /**
   * Whether this product is round, so the first measurement should read "Diameter" rather than
   * "Height". Tubes, solid round bar, pipes, bends, bearings and cylinders all say Ø in their
   * code; every round item in the catalogue has one, and the square and rectangular ones do not.
   * The category is not a safe signal - "Solid round and square bar" holds both.
   *
   * The field itself is untouched: `height` still holds the number, because it is the right name
   * for a square tube or a beam.
   */
  isRound(product: any): boolean {
    const code = product ? String(product.code || '') : '';
    return code.includes('Ø') || code.includes('ø');
  }

  /**
   * Whether this product is a TIPLLA, whose two numbers are a diameter and a length.
   *
   * The owner's reading: "10x120" is Ø10 mm and 120 mm long - not a height and a width. The importer
   * had nowhere else to put the 120 than `width`, so the card has to read it back as a length.
   *
   * Matched on the category rather than the code, because the codes carry no marker: a TIPLLA is
   * "8X80" and nothing in those digits says which number is which.
   */
  isTipla(product: any): boolean {
    const open = (this as any).selectedCategory;
    const parts = [
      product && product.category ? product.category.title : '',
      open ? open.title : '',
    ];
    return parts.some((title: any) => String(title || '').toUpperCase().indexOf('TIPLLA') >= 0);
  }

  /**
   * The length to show. A TIPLLA keeps it in `width`, because that is where the importer put it;
   * every other product keeps it in `length`.
   */
  shownLength(product: any, dimension: any): any {
    if (!dimension) {
      return null;
    }
    if (this.isTipla(product) && !this.showsValue(dimension.length)) {
      return dimension.width;
    }
    return dimension.length;
  }

  /**
   * Whether a dimension value is worth showing.
   *
   * Accepts numeric strings, because the API sends decimals as strings - "3.80" is a real price
   * and the old check, `typeof value === 'number'`, threw it away. Rejects null, undefined, an
   * empty string, "N/A", and zero: a customer should never be shown "Weight: 0 g".
   */
  showsValue(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    const text = String(value).trim();
    if (text === '' || /^(n\/?a|none|null|-)$/i.test(text)) {
      return false;
    }
    const number = Number(text);
    return !isNaN(number) && number !== 0;
  }

  /** 6000 mm reads better to a steel buyer as 6 m. */
  formatLength(millimetres: any): string {
    const value = Number(millimetres);
    if (isNaN(value)) {
      return String(millimetres);
    }
    return value >= 1000 && value % 100 === 0
      ? `${value / 1000} m`
      : `${value} mm`;
  }

  /** Weights are stored in grams; kilograms is what people say. */
  formatWeight(grams: any): string {
    const value = Number(grams);
    if (isNaN(value)) {
      return String(grams);
    }
    return value >= 1000 ? `${+(value / 1000).toFixed(3)} kg` : `${value} g`;
  }

  /** True when the dimension has anything at all worth printing. */
  /**
   * Whether a dimension actually says what it is - its size, its thickness, its weight.
   *
   * Deliberately does not count the price. A price on its own says nothing: 54.00 for what? A
   * dimension carrying only a price is not shown, and neither is its price.
   */
  hasAnyDimension(dimension: any): boolean {
    return ['height', 'width', 'length', 'thickness', 'weight'].some((key) =>
      this.showsValue(dimension ? dimension[key] : null)
    );
  }

  /** True when the customer has something to choose between. One dimension is not a choice. */
  needsChoice(): boolean {
    return (this.selectedProduct?.dimensions || []).length > 1;
  }

  /**
   * Whether this product has any real dimension to show. A price on its own is not one, so a
   * product that carries only a price has nothing to print - not even the heading.
   */
  hasAnythingToShow(): boolean {
    return ((this.selectedProduct?.dimensions || []) as ProductDimension[]).some(
      (dimension: ProductDimension) => this.hasAnyDimension(dimension)
    );
  }

  /** The customer may make contact when they have chosen, or when there was nothing to choose. */
  canContact(): boolean {
    return !this.needsChoice() || this.anyChosen();
  }
  
  addNewDimension(): void {
    if (this.selectedProduct?.dimensions) {
      this.selectedProduct.dimensions.push({
        height: null,
        width: null,
        length: null,
        weight: null,
        price: null,
        currency: "EUR"
      });
    } else {
      this.selectedProduct.dimensions = [
        {
          height: null,
          width: null,
          length: null,
          weight: null,
          price: null,
          currency: "EUR"
        }
      ];
    }
  }
  
  addNewTranslation(): void {
    if (this.selectedProduct?.translations) {
      this.selectedProduct.translations.push({
        id: 0,
        language: '',
        content: '',
        slug: '',
        description: ''
      });
    } else {
      this.selectedProduct.translations = [
        {
          id: 0,
          language: '',
          content: '',
          slug: '',
          description: ''
        }
      ];
    }
  }
  
  removeDimension(index: number): void {
    if (this.selectedProduct?.dimensions) {
      this.selectedProduct.dimensions.splice(index, 1);
    }
  }
  
  removeTranslation(index: number): void {
    if (this.selectedProduct?.translations) {
      this.selectedProduct.translations.splice(index, 1);
    }
  }
    
 
  
  
  ngOnInit(): void {
      // Only the browser fetches data: prerendering/SSR must not call the API.
      if (isPlatformBrowser(this.platformId)) {
        // The groups load only when nothing is being searched for. A term handed over as ?q= starts
        // its own search below, and loading the groups as well left the two racing: whichever
        // answered last took the screen, so the term sometimes sat in the box with the whole group
        // list behind it instead of the results.
        const handedOver = (this.route.snapshot.queryParamMap.get('q') || '').trim();
        if (!handedOver) {
          this.loadCategoryGroups();
        }
        // Product descriptions come from the API per language, so reload the
        // open product list when the visitor switches language.
        this.subscriptions.push(
          this.translate.onLangChange.subscribe(() => {
            if (this.searchQuery.trim().length >= 2) {
              this.runSearch();
            } else if (this.selectedCategory?.id) {
              this.loadCategoryWithProducts(this.selectedCategory.id, this.currentPage);
            }
          })
        );
      }
    // this.loadCategories();
    this.isLoggedIn= this.authService.isAuthenticated();

    // The filters when the address carries them. Read from the snapshot and before anything loads,
    // because the first category load has to know them already - and a subscription would fire on
    // every change the controls make and re-apply them in a loop.
    const start = this.route.snapshot.queryParamMap;
    const startThickness = Number(start.get('thickness'));
    const startMinHeight = Number(start.get('minHeight'));
    const startMaxHeight = Number(start.get('maxHeight'));
    if (startThickness) { this.filterThickness = startThickness; }
    if (startMinHeight) { this.filterMinHeight = startMinHeight; }
    if (startMaxHeight) { this.filterMaxHeight = startMaxHeight; }

    // A link to one product - somebody shared it, or bookmarked it. Opened once its category has
    // arrived, which is why the category travels in the link too.
    const shared = Number(start.get('product'));
    if (shared) {
      this.pendingProductId = shared;
    }
// A search handed over from the header, the hero or a featured product's card arrives as ?q=.
// A subscription, not a snapshot: the header's box is used while already on the products page,
// where this component is reused and ngOnInit never runs again. The snapshot worked from the home
// page's hero, which is a different route, and silently did nothing from the navigation.
this.subscriptions.push(
  this.route.queryParamMap.subscribe((params) => {
    const asked = (params.get('q') || '').trim();
    if (asked) {
      this.searchQuery = asked;
      this.runSearch();
    }

    // A link from the admin panel's worklists opens the editor for one product. Pressing a row
    // there is meant to be the start of fixing it, not the start of looking for it.
    const edit = Number(params.get('edit'));
    if (edit && this.isLoggedIn) {
      this.openEditorFor(edit, Number(params.get('category')) || null);
    } else {
      // A plain link to one category, which is what the admin panel's list of switched-off
      // categories offers: what is actually in it, before deciding whether to switch it back on.
      // Only when it is a different category: this subscription also fires when the filter controls
      // change the address, and reloading the same category there would be a second request for
      // nothing. The filters come with it, because the address is where they live.
      const category = Number(params.get('category'));
      if (category && category !== this.selectedCategory?.id) {
        this.showProducts({ id: category } as any, true);
      }
    }

    // A link from the panel's list of categories with no image: straight into that category's
    // editor, which is where the image is set.
    const categoryEdit = Number(params.get('editCategory'));
    if (categoryEdit && this.isLoggedIn) {
      this.openCategoryEditorFor(categoryEdit);
    }
  })
);

// Get the navigation object
const navigation = this.router.getCurrentNavigation();

// Check if the navigation contains a state
 if (this.sharedService.getCategory()){
  const requested = this.sharedService.getCategory();
  this.sharedService.setCategory(null);
  if (requested.parent_id === null || requested.parent_id === undefined) {
    // A top-level group holds no products of its own - the catalogue stores them on the
    // subcategories - so opening one used to land on an empty page. Show the groups instead,
    // with the one that was pressed at the top, and its subcategories one click away.
    // Open it, without hiding the others: pressing "Decorative metal" should show all the groups
    // with Decorative metal expanded. expandedParentId holds one group at a time by design, so
    // the rest arrive closed.
    this.expandedParentId = requested.id ?? null;
    this.scrollToGroupId = requested.id ?? null;
    this.showingGroups = true;
  } else {
    this.selectedCategory = requested;
    this.showProducts(requested);
  }
 }


}
private loadCategoryGroups(): void {
  this.loadingGroups = true;
  this.groupsError = null;

  // One request instead of seven. /category/tree carries each group's children, and this page needs
  // exactly that pair: it used to ask for the groups and then for every group's children in turn -
  // six more round trips for data that was already in the tree.
  const sub = this.productService.getCategoryTree().subscribe({
    next: (tree) => {
      this.topCategories = tree || [];
      this.childrenMap.clear();
      this.topCategories.forEach((parent) => {
        this.childrenMap.set(parent.id!, parent.children || []);
      });
      this.loadingGroups = false;
      // Do not force the group view back on when the visitor arrived asking for a particular
      // category: ngOnInit already applied it, and this callback arrives afterwards, so setting
      // it unconditionally threw the request away and showed the groups list instead.
      if (!this.selectedCategory) {
        this.showingGroups = true; // ensure group view
      }
      this.scrollToRequestedGroup();
    },
    error: (err) => {
      // Store the translation key, not a resolved string: instant() runs before
      // the language file has finished loading and would render the raw key.
      console.error('Error occurred while fetching category groups:', err);
      this.groupsError = 'PRODUCTS.LOAD_ERROR';
      this.loadingGroups = false;
    }
  });
  this.subscriptions.push(sub);
}
createCategory() {
  this.productService.createCategory(this.newCategory).subscribe({
    next: () => {
      this.statusMessage = 'PRODUCTS.SAVED';
      this.newCategory = this.emptyCategory();
      this.closeCreateCategoryModal();
      // The page shows the parent/child groups, so refresh those - reloading
      // the flat category list changed nothing on screen.
      this.loadCategoryGroups();
    },
    error: (error) => {
      console.error('Error creating category:', error);
      this.statusMessage = 'PRODUCTS.SAVE_FAILED';
    },
  });
}

closeCreateCategoryModal(): void {
  const modalElement = document.getElementById('createCategoryModal');
  if (modalElement) {
    bootstrap.Modal.getInstance(modalElement)?.hide();
    setTimeout(() => {
      document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');
    }, 200);
  }
}
NewProdAddTranslation() {
  this.newProduct.translations!.push({
    language: '',
    slug: '',
    description: '',
    content: '' // If your schema expects 'content'
  });
}

addDimension() {
  this.newProduct.dimensions!.push({
    height: 0,
    width: 0,
    length: 0,
    weight: 0,
    price: 0,
    currency: 'EUR'
  });
}


createProduct() {
  if (!this.selectedCategory) {
    alert('Please select a category first.');
    return;
  }
  if (this.newProduct.dimensions.length === 0) {
    alert('Please add at least one dimension.');
    return;
  }
  if (this.newProduct.translations.length === 0) {
    alert('Please add at least one translation.');
    return;
  }
  
  // Attach the categoryId
  this.newProduct.category_id = this.selectedCategory.id!;

  // POST the product
  this.productService.createProduct(this.newProduct).subscribe({
    next: (response) => {
      // Reset the form
      this.newProduct = {
        code: '',
        category_id: 0,
        new_product:false,
        dimensions: [
          {
            height: 0,
            width: 0,
            length: 0,
            weight: 0,
            price: 0,
            currency: 'EUR',
          },
        ],
        translations: [
          {
            language: 'en',
            slug: '',
            description: '',
            content: '',
          },
        ],
        cut_type: 0,
        is_active: true,
        image_asset: {
          file_name: '',
          alternative_text: '',
          thumbnail_path: '',
          original_path: '',
        },
      };
      





      
this.statusMessage = 'PRODUCTS.SAVED';
this.closeProductModals();
this.showProducts(this.selectedCategory)
    },
    error: (error) => {
      console.error('Error creating product:', error);
      this.statusMessage = 'PRODUCTS.SAVE_FAILED';
    },
  });
  
}


 closeProductModals(): void {
    const modalElementa = document.getElementById('createProductModal');
    if (modalElementa) {
      const modal = bootstrap.Modal.getInstance(modalElementa);
      modal.hide();
      setTimeout(() => {
  document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
  document.body.style.removeProperty('overflow');
}, 200);

    }}


  /**
   * Open the editor for one product, by id.
   *
   * The category has to come from the link as well: the API's product schema excludes category_id,
   * so a product cannot say which category it is in, and the dialog is fetched from the DOM by id -
   * it only exists while the page is showing a category. That one is opened first and the view
   * brought up to date, because a dialog that has not been rendered cannot be opened.
   *
   * Once per id, because the query parameters emit again on other navigations.
   */
  private openEditorFor(id: number, categoryId: number | null): void {
    if (this.openedEditorFor === id) {
      return;
    }
    this.openedEditorFor = id;

    if (categoryId) {
      this.showProducts({ id: categoryId } as any);
      this.changeDetector.detectChanges();
    }

    this.subscriptions.push(
      this.productService.getProductById(id).subscribe({
        next: (product) => this.openEditModal(product),
        error: () => {
          // Said nothing about: the products page is still there to work from.
          this.openedEditorFor = null;
        },
      })
    );
  }

  /**
   * Open the editor for one category, by id.
   *
   * The panel's list of categories with no image carries a title and an id; the editor needs the
   * whole category, including whether it already has an image, which is the point of opening it.
   * The dialog element is always in the DOM, unlike the product's, so nothing has to be opened
   * behind it first.
   */
  private openCategoryEditorFor(id: number): void {
    if (this.openedCategoryEditorFor === id) {
      return;
    }
    this.openedCategoryEditorFor = id;
    this.subscriptions.push(
      this.productService.getCategoryById(id, 1, 8, this.currentLanguage()).subscribe({
        next: (response: any) => this.editCategory(response),
        error: () => {
          // Said nothing about: the products page is still there to work from.
          this.openedCategoryEditorFor = null;
        },
      })
    );
  }

  openEditModal(product: Product): void {
    // Clone the product to avoid direct mutation
    this.selectedProduct = { ...product };

    // The dialog binds straight to selectedProduct.image_asset.file_name and friends.
    // The `!` marks in the template are compile-time only, so a product with no image
    // made every change detection throw "Cannot read properties of null (reading
    // 'file_name')" and the dialog was unusable. An empty asset gives those fields
    // something to write into, and the save path already skips an all-empty image.
    if (!this.selectedProduct.image_asset) {
      this.selectedProduct.image_asset = {
        file_name: '',
        alternative_text: '',
        thumbnail_path: '',
        original_path: '',
      } as ImageAsset;
    }

    // Update the paths when the modal is opened
    if (this.selectedProduct?.image_asset) {
      this.originalPath = this.originalPath;
      this.thumbnailPath = this.thumbnailPath;
    }
  
    // The dialog sits behind *ngIf="selectedProduct" (its bindings used to throw on
    // every change detection while nothing was selected), so render it before
    // handing the element to Bootstrap: constructing a Modal while the dialog is
    // still missing leaves it holding a null reference and show() then fails with
    // "Illegal invocation".
    this.changeDetector.detectChanges();
    const modalElement = document.getElementById('editProductModal');
    if (modalElement) {
      bootstrap.Modal.getInstance(modalElement)?.dispose();
      bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
  }
  

  updateProduct(): void {
    if (this.selectedProduct) {
      this.productService.updateProduct(this.selectedProduct).subscribe({
        next: () => {
          this.statusMessage = 'PRODUCTS.SAVED';
          this.showProducts(this.selectedCategory);
          this.closeEditModal();
        },
        error: (error) => {
          console.error('Error updating product:', error);
          this.statusMessage = 'PRODUCTS.SAVE_FAILED';
        },
      });
    }
  }

  closeEditModal(): void {
    const modalElement = document.getElementById('editProductModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal.hide();
    }
  }
  // Show products for a specific category
  showProducts(category: any, keepFilters: boolean = false) {
    this.cancelSearch();
    this.searchQuery = this.searchTerm = '';
    this.selectedCategory = category;
    this.showingGroups = false;

    // Filters belong to the category they were chosen in: carrying them into another would narrow
    // it by a size that may not exist there, with the facets left to explain it. The one exception
    // is a link that came with both, where the address is the instruction.
    if (!keepFilters) {
      this.clearFilters(false);
    }

    if (category.products && category.products.length > 0) {
      // Products are already included in the category data
      this.products = category.products;
    } else {
      // Fetch the category data including products
      this.loadCategoryWithProducts(category.id, 1);
    }
  }

  /** Whether anything is being narrowed, for the clear link and the count. */
  hasFilters(): boolean {
    return this.filterThickness != null || this.filterMinHeight != null || this.filterMaxHeight != null;
  }

  /** Apply the controls. Back to the first page: the old one may not exist under the new filter. */
  applyFilters(): void {
    if (!this.selectedCategory?.id) {
      return;
    }
    this.loadCategoryWithProducts(this.selectedCategory.id, 1);
    this.rememberFilters();
  }

  clearFilters(apply: boolean = true): void {
    this.filterThickness = null;
    this.filterMinHeight = null;
    this.filterMaxHeight = null;
    if (apply && this.selectedCategory?.id) {
      this.loadCategoryWithProducts(this.selectedCategory.id, 1);
    }
    this.rememberFilters();
  }

  /**
   * Keep the filters in the address.
   *
   * A narrowed catalogue is worth sharing and worth bookmarking, and the back button then steps
   * back through the filters instead of leaving the page. Merged, because the category is in the
   * address too; a null removes its parameter.
   */
  private rememberFilters(): void {
    // Nothing to write into while the page is rendered on the server: there is no address bar.
    // This is reached during a server render, because opening a category clears the filters.
    if (typeof window === 'undefined') {
      return;
    }
    this.router.navigate([], {
      queryParams: {
        thickness: this.filterThickness,
        minHeight: this.filterMinHeight,
        maxHeight: this.filterMaxHeight,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Bring the group the visitor pressed into view.
   *
   * Opening it is not enough when it sits below the fold - the whole point of pressing a card is
   * to be taken to that group. The offset leaves room for the sticky header, which would otherwise
   * cover the title it scrolled to.
   */
  private scrollToRequestedGroup(): void {
    const id = this.scrollToGroupId;
    if (id === null || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.scrollToGroupId = null;
    setTimeout(() => {
      const element = document.getElementById('group-' + id);
      if (!element) {
        return;
      }
      const top = element.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }, 150);
  }

  // Go back to showing categories
  goBackToGroups() {
    this.cancelSearch();
    this.showingGroups = true;
    this.selectedCategory = null;
    this.expandedParentId = null;
    this.searchTerm = '';
    this.products = [];
  }

  /**
   * Search the catalogue as the visitor types.
   *
   * The catalogue is called by its codes, so this is how someone who knows what they want -
   * "IPE 100", "15x15" - finds it without guessing which group it was filed under.
   */
  onSearchInput(): void {
    this.cancelSearch();
    if (this.searchQuery.trim().length < 2) { this.goBackToGroups(); return; }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.runSearch(), 350);
  }

  private cancelSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchSubscription?.unsubscribe();
    this.searching = false;
    this.searchError = false;
  }

  runSearch(): void {
    this.cancelSearch();
    const term = this.searchQuery.trim();
    if (term.length < 2) {
      this.goBackToGroups();
      return;
    }
    this.searching = true;
    // The skeleton cards are for a category loading. A search that finds eight results would
    // otherwise sit behind eight placeholders, because this flag was left true by the group load.
    this.isLoading = false;
    this.searchSubscription = this.productService
      .searchProducts(term, this.translate.currentLang || 'al')
      .subscribe({
        next: (results) => {
          this.products = results;
          this.refreshCardList();
          this.searchTerm = term;
          this.selectedCategory = null;
          this.showingGroups = false;
          this.searching = false;
        },
        error: () => {
          this.searchError = true;
          this.products = [];
          this.searchTerm = term;
          this.selectedCategory = null;
          this.showingGroups = false;
          this.searching = false;
        },
      });
  }

  /** Leave the search results and go back to the groups. */
  clearSearch(): void {
    this.cancelSearch();
    this.searchQuery = '';
    this.searchTerm = '';
    this.goBackToGroups();
  }

  // Generate WhatsApp link
  getWhatsAppLink(product: Product): string {
    // Say which thickness, or the enquiry is "tell me about 100x100" with no idea which wall.
    // When a product has only one dimension there is nothing to tick, so that one is what the
    // customer means.
    const dimensions = (product?.dimensions || []) as ProductDimension[];
    const chosen = dimensions.length === 1
      ? [{ dimension: dimensions[0] }]
      : dimensions
          .map((dimension: ProductDimension, index: number) => ({ dimension, index }))
          .filter(({ index }: { index: number }) => this.isChosen(index));
    const wanted = chosen
      .map(({ dimension }: { dimension: ProductDimension }) => {
        const parts = [];
        if (dimension.thickness) {
          parts.push(
            `${this.translate.instant("PRODUCTS.THICKNESS")} ${dimension.thickness} mm`
          );
        } else if (dimension.height) {
          parts.push(`${dimension.height}${dimension.width ? 'x' + dimension.width : ''} mm`);
        }
        if (dimension.length) {
          parts.push(
            `${this.translate.instant("PRODUCTS.LENGTH")} ${this.formatLength(dimension.length)}`
          );
        }
        if (dimension.price) {
          parts.push(`${dimension.price} ${dimension.currency || ''}`.trim());
        }
        return parts.join(' - ');
      })
      .filter(Boolean);
    // Written in the customer's language: the page was Albanian and the message went out in
    // English, which is no way to open an enquiry.
    const intro = `${this.translate.instant("PRODUCTS.WHATSAPP_INTRO")} ${product?.code}.`;
    const want = wanted.length
      ? ` ${this.translate.instant("PRODUCTS.WHATSAPP_WANT")} ${wanted.join("; ")}.`
      : "";
    const ask = ` ${this.translate.instant("PRODUCTS.WHATSAPP_ASK")}`;
    const message = `${intro}${want}${ask}`;
    const whatsappNumber = environment.whatsappNumber;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      message
    )}`;
  }

  // Helper method to get a dimension value
  getProductDimension(
    product: Product,
    dimensionKey: DimensionKey
  ): number | string {
    if (product.dimensions && product.dimensions.length > 0) {
      const dimensionValue = product.dimensions[0][dimensionKey];
      return dimensionValue !== undefined && dimensionValue !== null
        ? dimensionValue
        : 'N/A';
    }
    return 'N/A';
  }

  // Helper method to get cut type name
  getCutTypeName(cutType: number): string {
    return this.cutTypeNames[cutType] || 'Unknown';
  }

  ngOnDestroy(): void {
    this.cancelSearch();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
  loadCategoryWithProducts(category_id: number, page: number = 1) {
    this.isLoading=true;
    // Product text (description/slug) is stored per language in the API, so the
    // requested language has to travel with the request.
    const lang = this.currentLanguage();
    const sub = this.productService.getCategoryById(category_id, page, 8, lang, {
      thickness: this.filterThickness,
      minHeight: this.filterMinHeight,
      maxHeight: this.filterMaxHeight,
    }).subscribe({
      next: (categoryResponse: CategoryResponse) => {
        this.products = categoryResponse.products || [];
        // Which of these are already on the request list, so the cards can say so.
        this.refreshCardList();
        this.currentPage = categoryResponse.pagination.page;
        this.totalPages = categoryResponse.pagination.total_pages;
        this.totalItems = categoryResponse.pagination.total_items;
        // The facets describe the whole category, not the filtered page, so choosing a thickness
        // does not shorten the list of thicknesses.
        this.facets = categoryResponse.facets || this.facets;
        this.isLoading = false; // Turn off loader
        this.openWaitingProduct();

      },
      error: (error) => {
        console.error('Error occurred while fetching category:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  private currentLanguage(): string {
    return this.translate.currentLang || this.translate.getDefaultLang() || 'en';
  }

  loadNextPage() {
    if (this.currentPage < this.totalPages && this.selectedCategory) {
      this.loadCategoryWithProducts(
        this.selectedCategory.id!,
        this.currentPage + 1
      );
    }
  }

  loadPreviousPage() {
    if (this.currentPage > 1 && this.selectedCategory) {
      this.loadCategoryWithProducts(
        this.selectedCategory.id!,
        this.currentPage - 1
      );
    }
  }
  navigateProduct(direction: number): void {
    const currentIndex = this.products.findIndex(
      (p) => p.id === this.selectedProduct?.id
    );
  
    if (currentIndex === -1) {
      console.error('Selected product not found in the product list.');
      return;
    }
  
    const newIndex = (currentIndex + direction + this.products.length) % this.products.length;
    this.selectedProduct = this.products[newIndex];
    this.clearChoices();
  }

  /**
   * Which thicknesses the customer has ticked, by position in the list.
   *
   * A product can be several thicknesses of the same size, and those differ only in thickness
   * and price. The customer ticks the one (or ones) they want, and the WhatsApp message says
   * which - otherwise the enquiry is "tell me about 100x100" with no idea which wall.
   */
  chosenDimensions: { [index: number]: boolean } = {};

  /**
   * How many of each ticked thickness the customer wants.
   *
   * Twenty of 2 mm and five of 3 mm is the ordinary order, and they are two lines, not one - which
   * is why the quantity belongs to the dimension and not to the product.
   */
  quantities: { [index: number]: number } = {};

  /** The quantity chosen for a dimension, or 1 when none was - the card has no field of its own. */
  quantityFor(product: Product, dimension: ProductDimension): number {
    const index = (product.dimensions || []).indexOf(dimension);
    const chosen = this.quantities[index];
    return typeof chosen === 'number' && chosen > 0 ? chosen : 1;
  }

  /** True when every ticked thickness has a quantity of at least one. */
  canAddTicked(): boolean {
    const indexes = Object.keys(this.chosenDimensions).filter(
      (key) => this.chosenDimensions[Number(key)]
    );
    return indexes.length > 0 && indexes.every((key) => {
      const quantity = this.quantities[Number(key)];
      return typeof quantity === 'number' && quantity > 0;
    });
  }

  /** Keeps a quantity in step with the ticks, and never lets one fall below zero. */
  setQuantity(index: number, value: any): void {
    const number = Number(value);
    this.quantities = {
      ...this.quantities,
      [index]: Number.isFinite(number) && number > 0 ? Math.floor(number) : 0,
    };
  }

  private clearChoices(): void {
    this.chosenDimensions = {};
  }

  isChosen(index: number): boolean {
    return this.chosenDimensions[index] === true;
  }

  toggleDimension(index: number): void {
    const nowChosen = !this.chosenDimensions[index];
    this.chosenDimensions = {
      ...this.chosenDimensions,
      [index]: nowChosen,
    };
    // A ticked thickness starts at one. The commonest order is a single piece, and a field that
    // begins empty makes the customer do arithmetic before they can add anything at all.
    if (nowChosen && !this.quantities[index]) {
      this.quantities = { ...this.quantities, [index]: 1 };
    }
  }

  anyChosen(): boolean {
    return Object.values(this.chosenDimensions).some(Boolean);
  }

  /**
   * The value every dimension of this product shares, or null when they differ.
   *
   * '20x20, wall 0.9 / 1.3 / 1.5 / 1.8 mm' is one size in four walls, so the size is worth
   * saying once instead of repeating "Lartësia: 20 mm" four times. Only for products with more
   * than one dimension: a single one reads better in full, as it always did.
   */
  sharedDimensionValue(key: DimensionKey): number | string | null {
    const dimensions: ProductDimension[] = this.selectedProduct?.dimensions || [];
    if (dimensions.length < 2) {
      return null;
    }
    const values = dimensions.map((dimension: ProductDimension) => dimension[key]);
    const first = values[0];
    const allTheSame = values.every(
      (value: unknown) => String(value ?? '') === String(first ?? '')
    );
    return allTheSame && first !== undefined && first !== null ? first : null;
  }
  editCategory(category: Category): void {
    this.selectedCategory = { ...category }; // Clone to avoid direct mutation
        // Update the paths when the modal is opened
        if (this.selectedCategory?.image_asset) {
          this.originalPathC = this.getFileNameFromPath(this.selectedCategory.image_asset.original_path);
          this.thumbnailPathC = this.getFileNameFromPath(this.selectedCategory.image_asset.thumbnail_path);
        }
    const modalElement = document.getElementById('editCategoryModal');
    if (modalElement) {
      const modalInstance = new bootstrap.Modal(modalElement);
      modalInstance.show();
    }
  }
  
  updateCategory(): void {
    if (this.selectedCategory) {
      this.productService.updateCategory(this.selectedCategory).subscribe({
        next: () => {
          this.statusMessage = 'PRODUCTS.SAVED';
          this.loadCategoryGroups();
          this.closeEditCategoryModal();
        },
        error: (err) => {
          console.error('Error updating category:', err);
          this.statusMessage = 'PRODUCTS.SAVE_FAILED';
        },
      });
    }
  }
  
  closeEditCategoryModal(): void {
    const modalElement = document.getElementById('editCategoryModal');

    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
    this.selectedCategory = null; // Clear the selected category
  }
  get categoryTitle(): string {
    return this.selectedCategory?.title || '';
  }
  
  set categoryTitle(value: string) {
    if (this.selectedCategory) {
      this.selectedCategory.title = value;
    }
  }
  
  get isActive(): boolean {
    return !!this.selectedCategory?.is_active;
  }
  
  set isActive(value: boolean) {
    if (this.selectedCategory) {
      this.selectedCategory.is_active = value;
    }
  }
  
  /** Parent of the category being edited (null means it is top level). */
  get parentId(): number | null {
    return this.selectedCategory?.parent_id ?? null;
  }

  set parentId(value: number | null) {
    if (this.selectedCategory) {
      this.selectedCategory.parent_id = value;
    }
  }

  /**
   * Categories that can be chosen as a parent: the loaded top-level categories
   * and their children, so the tree can be built from the UI.
   */
  get parentOptions(): Category[] {
    const options: Category[] = [...this.topCategories];
    this.childrenMap.forEach((children) => options.push(...children));
    return options;
  }

  /** Same list, minus the category being edited and its own children (no cycles). */
  get parentOptionsForEdit(): Category[] {
    const self = this.selectedCategory?.id;
    const ownChildren = new Set((this.childrenMap.get(self ?? -1) ?? []).map((c) => c.id));
    return this.parentOptions.filter(
      (option) => option.id !== self && !ownChildren.has(option.id)
    );
  }
  
  get fileName(): string {
    return this.selectedCategory?.image_asset?.file_name || '';
  }
  
  set fileName(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.file_name = value;
    }
  }
  
  get alternativeText(): string {
    return this.selectedCategory?.image_asset?.alternative_text || '';
  }
  
  set alternativeText(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.alternative_text = value;
    }
  }
  get thumbnailPathC(): string {
    return this.selectedCategory?.image_asset?.thumbnail_path
    ? this.selectedCategory.image_asset.thumbnail_path.split('/').pop() || ''
    : '';
  }
  
  set thumbnailPathC(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.thumbnail_path = value;
    }
  }
  
  get originalPathC(): string {
    return this.selectedCategory?.image_asset?.original_path
    ? this.selectedCategory.image_asset.original_path.split('/').pop() || ''
    : '';
    
  }
  
  set originalPathC(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.original_path = value;
    }
  }
  
}
