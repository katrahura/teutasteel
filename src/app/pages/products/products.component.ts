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
import { environment } from '../../../environments/environment';
import {
  Category,
  CategoryResponse,
  Product,
  ProductDimension,
  ImageAsset,
  TopCategory            
} from '../../models/product.model';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SharedService } from '../../shared.service';
import { QuoteListService } from '../../shared/quote-list.service';
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
  imports: [CommonModule, RouterModule, TranslateModule, FormsModule, ImageFallbackDirective],
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

  /** The group to scroll to once the list has rendered, when the visitor arrived from a card. */
  private scrollToGroupId: number | null = null;
  products: Product[] = [];
  selectedProduct: any = null;
  currentPage = 1;
  totalPages = 1;
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
  addToQuote(product: Product, dimensions?: ProductDimension[]): void {
    // With nothing passed - the card, which has no picker - add the dimension it is showing rather
    // than every thickness the product carries, which for a merged sheet would be fourteen lines.
    const chosen = dimensions && dimensions.length
      ? dimensions
      : (product.dimensions || []).slice(0, 1);
    if (!chosen.length) {
      return;
    }
    for (const dimension of chosen) {
      this.quoteList.add({
        productId: product.id || 0,
        code: product.code,
        detail: this.describeDimension(dimension),
        quantity: this.quantityFor(product, dimension),
      });
    }
    this.quoteCount = this.quoteList.count();
    this.quoteNotice = product.code;
  }

  /** "Trashësia 1.5 mm — 4.80 Eur", or as much of that as the dimension knows. */
  private describeDimension(dimension: ProductDimension): string {
    const parts: string[] = [];
    if (this.showsValue(dimension.thickness)) {
      parts.push(`${this.translate.instant('PRODUCTS.THICKNESS')} ${dimension.thickness} mm`);
    } else if (this.showsValue(dimension.height)) {
      parts.push(`${dimension.height}${dimension.width ? ' × ' + dimension.width : ''} mm`);
    }
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
   * What a card's add button does.
   *
   * A product with one dimension has nothing to choose, so it goes straight in. A product with
   * several has a thickness to pick and a quantity per thickness, and only the dialog can ask for
   * both - so the card opens it rather than guessing at either.
   */
  addOrOpen(product: Product, event: Event): void {
    event.stopPropagation();
    if ((product.dimensions || []).length > 1) {
      this.openModal(product, event);
      return;
    }
    this.addToQuote(product);
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

    // Ensure Angular detects the change

    // Open the Bootstrap modal
    const modalElement = document.getElementById('productDetailsModal');
    const modalInstance = new bootstrap.Modal(modalElement as HTMLElement);
    modalInstance.show();
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
        this.loadCategoryGroups();
        // Product descriptions come from the API per language, so reload the
        // open product list when the visitor switches language.
        this.subscriptions.push(
          this.translate.onLangChange.subscribe(() => {
            if (this.selectedCategory?.id) {
              this.loadCategoryWithProducts(this.selectedCategory.id, this.currentPage);
            }
          })
        );
      }
    // this.loadCategories();
    this.isLoggedIn= this.authService.isAuthenticated();
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

  const sub = this.productService.getTopCategories().pipe(
    switchMap((parents) => {
      this.topCategories = parents || [];
      if (!parents || parents.length === 0) {
        return of([]); // nothing to fetch
      }
      // Fetch children for each parent in parallel
      const calls = parents.map(p =>
        this.productService.getCategoryChildren(p.id!)
      );
      return forkJoin(calls);
    })
  ).subscribe({
    next: (childrenArrays) => {
      // childrenArrays is an array aligned with topCategories
      this.childrenMap.clear();
      this.topCategories.forEach((p, idx) => {
        this.childrenMap.set(p.id!, childrenArrays[idx] || []);
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
  showProducts(category: any) {
    this.selectedCategory = category;
    this.showingGroups = false;

    if (category.products && category.products.length > 0) {
      // Products are already included in the category data
      this.products = category.products;
    } else {
      // Fetch the category data including products
      this.loadCategoryWithProducts(category.id, 1);
    }
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
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.runSearch(), 350);
  }

  runSearch(): void {
    const term = this.searchQuery.trim();
    if (term.length < 2) {
      return;
    }
    this.searching = true;
    // The skeleton cards are for a category loading. A search that finds eight results would
    // otherwise sit behind eight placeholders, because this flag was left true by the group load.
    this.isLoading = false;
    const sub = this.productService
      .searchProducts(term, this.translate.currentLang || 'al')
      .subscribe({
        next: (results) => {
          this.products = results;
          this.searchTerm = term;
          this.selectedCategory = null;
          this.showingGroups = false;
          this.searching = false;
        },
        error: () => {
          // The service has already logged it; show the empty state rather than a stale list.
          this.products = [];
          this.searchTerm = term;
          this.selectedCategory = null;
          this.showingGroups = false;
          this.searching = false;
        },
      });
    this.subscriptions.push(sub);
  }

  /** Leave the search results and go back to the groups. */
  clearSearch(): void {
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
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
  loadCategoryWithProducts(category_id: number, page: number = 1) {
    this.isLoading=true;
    // Product text (description/slug) is stored per language in the API, so the
    // requested language has to travel with the request.
    const lang = this.currentLanguage();
    const sub = this.productService.getCategoryById(category_id, page, 8, lang).subscribe({
      next: (categoryResponse: CategoryResponse) => {
        this.products = categoryResponse.products || [];
        this.currentPage = categoryResponse.pagination.page;
        this.totalPages = categoryResponse.pagination.total_pages;
        this.isLoading = false; // Turn off loader

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
