import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService, MediaConfig } from '../../../services/admin.service';
import { CloudinaryService } from '../../../services/cloudinary.service';
import { ProductService } from '../../../services/product.service';
import { ImageAsset, Product, ProductDimension, ProductTranslation, TopCategory } from '../../../models/product.model';
import { environment } from '../../../../environments/environment';

/** The form's shape before a product is loaded: empty, but never null. */
const EMPTY_PRODUCT: Product = {
  code: '',
  cut_type: 0,
  is_active: true,
  new_product: false,
  dimensions: [],
  translations: [],
  image_asset: { file_name: '', alternative_text: '', thumbnail_path: '', original_path: '' },
};

/**
 * The units a price may be quoted in. `null` is the honest unknown: most of the catalogue has never
 * been asked, and guessing one from the shape would be inventing a commercial term. The server has
 * the same list; a value outside it is refused there as well.
 */
export const PRICE_UNITS = ['piece', 'tube', 'sheet', 'bar', 'metre', 'kilogram'] as const;

/** A message from the API, split into what happened and which fields it blames. */
interface FieldErrors {
  [path: string]: string;
}

/**
 * One product's editor: code, category, cut type, visibility, photograph, variants and translations.
 *
 * The markup is the catalogue's own modal, moved here unchanged - nineteen fields - so both the
 * catalogue and the administrator's table open the same editor. It is a component with an id rather
 * than a modal bound to a page's selected product: `productId` comes in, `saved` and `closed` go
 * out, and it knows nothing about the page it is rendered in.
 *
 * The API answers a rejected save with a message and a `details` object keyed by field path -
 * `dimensions.0.price`, `translations.1.slug`, `code`. Those are kept as they arrive, so the field
 * that is wrong can say so itself instead of one sentence at the top standing in for all of them.
 *
 * Phase 4 additions, each in the smallest form that works:
 * - `newProduct`: create inside the panel, not only edit;
 * - `price_unit` per variant, never inferred;
 * - the version the form was built from travels with the save, so a stale form gets a conflict
 *   instead of overwriting somebody else's change;
 * - a load that is no longer wanted (the owner opened another product) is ignored, and an upload is
 *   bound to the product it started on;
 * - unsaved changes are warned about before the editor closes or switches product.
 */
@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './product-editor.component.html',
  styleUrls: ['./product-editor.component.css'],
})
export class ProductEditorComponent implements OnChanges, OnInit {
  private products = inject(ProductService);
  private admin = inject(AdminService);
  private cloudinary = inject(CloudinaryService);

  /** What the browser needs to upload, fetched once; null until it arrives, empty when unset. */
  mediaConfig: MediaConfig | null = null;
  private mediaConfigLoaded = false;
  uploading = false;
  uploadProgress = 0;
  uploadError = '';
  private translate = inject(TranslateService);

  /** Which product to edit. Changing it reloads; the panel stays where it is. */
  @Input() productId: number | null = null;

  /** Create a new product instead of editing one. The admin passes its category list. */
  @Input() newProduct = false;
  @Input() adminMode = false;
  @Input() categories: TopCategory[] = [];
  @Input() presetCategoryId: number | null = null;

  @Output() saved = new EventEmitter<Product>();
  @Output() closed = new EventEmitter<void>();

  /**
   * A product that always has the shape the form binds to. Rendering the form against a null and
   * trusting *ngIf to hide it does not work: the template dereferences the product itself, so it must
   * exist with empty dimensions, translations and an empty image from the first render.
   */
  product: Product = EMPTY_PRODUCT;
  loaded = false;
  loading = false;
  saving = false;
  failed = false;
  /** What went wrong, in one sentence, above the fields. */
  errorMessage = '';
  /** And the same thing per field, for the field itself. */
  fieldErrors: FieldErrors = {};

  /**
   * The photograph's paths are edited through the component rather than through the product, because
   * the two controls are plain text inputs and the product's image may not exist yet. Neither is
   * written back until a save succeeds.
   */
  thumbnailPath = '';
  originalPath = '';

  /**
   * The image as the form edits it. A field rather than a getter: ngModel writes into whatever it is
   * bound to, and a getter that builds a fresh object on every change detection would receive the
   * typing and drop it on the next cycle.
   */
  image: ImageAsset = { file_name: '', alternative_text: '', thumbnail_path: '', original_path: '' };

  /** The version and the form content the editor last loaded or saved, for stale checks and "dirty". */
  private loadedId: number | null = null;
  private snapshot = '';
  /** Incremented on every load, so an answer for an older selection is dropped rather than shown. */
  private loadToken = 0;
  /** The record changed under this form: the save was refused, and reloading is the way out. */
  conflict = false;

  readonly units = PRICE_UNITS;

  ngOnInit(): void {
    // Nothing is asked for until somebody reaches for the file field: the form must not open a request
    // just by existing, and a test that only reads the form should not have to answer one.
    if (this.newProduct && !this.productId) {
      this.startNew();
    }
  }

  /** Ask once what uploading needs, when the file field is first reached for. */
  ensureMediaConfig(): void {
    if (this.mediaConfigLoaded) {
      return;
    }
    this.mediaConfigLoaded = true;
    this.admin.getMediaConfig().subscribe({
      next: (config) => { this.mediaConfig = config; },
      error: () => { this.mediaConfig = null; },
    });
  }

  /**
   * Take a photograph the way the Media page does - from this browser straight to Cloudinary - and
   * write the address it returns into the three fields the form already has.
   *
   * Bound to the product the upload started on: switching product while it runs must not attach the
   * picture to the new one.
   */
  onImage(event: Event): void {
    this.ensureMediaConfig();
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || this.uploading || !this.mediaConfig || !this.mediaConfig.configured) {
      return;
    }
    const forProduct = this.loadedId;
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadError = '';
    this.cloudinary.upload(file, this.mediaConfig, (percent) => { this.uploadProgress = percent; })
      .then((url) => {
        if (this.loadedId !== forProduct) {
          // The owner moved to another product while this was going up: drop it rather than
          // assigning a photograph to the wrong record.
          this.uploading = false;
          return;
        }
        this.uploading = false;
        this.image = {
          ...this.image,
          file_name: url.split('/').pop() || '',
          thumbnail_path: url,
          original_path: url,
          alternative_text: this.image.alternative_text || (this.product.code || ''),
        };
      })
      .catch(() => {
        this.uploading = false;
        this.uploadError = 'MISC.IMAGE_UPLOAD_FAILED';
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['productId'] || !this.productId) {
      return;
    }
    if (this.dirty && this.loaded && !this.confirmDiscard()) {
      // The address changed but the owner chose to keep what they typed: stay on the old product
      // rather than silently discarding it.
      this.productId = this.loadedId;
      return;
    }
    this.load(this.productId);
  }

  /** A new product, switched off, with one empty variant and both language rows ready. */
  private startNew(): void {
    this.loadToken++;
    this.loadedId = null;
    this.product = {
      code: '',
      cut_type: 0,
      // A new product starts switched off. Saving a half-written page straight into the public
      // catalogue is the kind of mistake an "active by default" checkbox invites.
      is_active: false,
      new_product: true,
      category_id: this.presetCategoryId ?? undefined,
      dimensions: [{ currency: 'EUR' }],
      translations: [
        { language: 'al', description: '', content: '', slug: '' },
        { language: 'en', description: '', content: '', slug: '' },
      ],
      image_asset: { file_name: '', alternative_text: '', thumbnail_path: '', original_path: '' },
    };
    this.image = { file_name: '', alternative_text: '', thumbnail_path: '', original_path: '' };
    this.thumbnailPath = '';
    this.originalPath = '';
    this.loaded = true;
    this.loading = false;
    this.failed = false;
    this.conflict = false;
    this.markClean();
  }

  load(id: number): void {
    const token = ++this.loadToken;
    this.loading = true;
    this.failed = false;
    this.conflict = false;
    this.errorMessage = '';
    this.fieldErrors = {};
    const language = this.translate.currentLang || 'al';
    this.products.getProductById(id, language).subscribe({
      next: (product) => {
        if (token !== this.loadToken) {
          // A slower answer for a product the owner has already left. Showing it would replace the
          // newer selection with an older one.
          return;
        }
        this.product = this.withEditableShape(product);
        this.loaded = true;
        this.loadedId = product && product.id ? product.id : id;
        this.image = { ...this.image, ...(product?.image_asset || {}) };
        this.thumbnailPath = product?.image_asset?.thumbnail_path || '';
        this.originalPath = product?.image_asset?.original_path || '';
        this.loading = false;
        this.markClean();
      },
      error: (error) => {
        if (token !== this.loadToken) {
          return;
        }
        this.failed = true;
        this.loading = false;
        this.errorMessage = this.explain(error).message;
      },
    });
  }

  /** Read the product again after a conflict: the owner decides what to keep. */
  reload(): void {
    const id = this.loadedId;
    if (!id) {
      return;
    }
    if (this.dirty && !this.confirmDiscard()) {
      return;
    }
    this.load(id);
  }

  /** A product with the pieces the form binds to, so a missing dimension or image cannot crash it. */
  private withEditableShape(product: Product): Product {
    const editable: Product = { ...product };
    editable.dimensions = (product.dimensions || []).map((dimension) => ({
      ...dimension,
      currency: dimension.currency || 'EUR',
      // NULL is the honest unknown; the select needs one value for it.
      price_unit: dimension.price_unit || null,
    }));
    editable.translations = (product.translations || []).map((translation) => ({ ...translation }));
    editable.image_asset = product.image_asset || {
      file_name: '',
      alternative_text: '',
      thumbnail_path: '',
      original_path: '',
    };
    editable.version = product.version ?? null;
    return editable;
  }

  addNewDimension(): void {
    if (!this.product) {
      return;
    }
    const row: ProductDimension = { currency: 'EUR' };
    this.product.dimensions = [...(this.product.dimensions || []), row];
  }

  removeDimension(index: number): void {
    if (!this.product || !this.product.dimensions) {
      return;
    }
    this.product.dimensions = this.product.dimensions.filter((_row, at) => at !== index);
  }

  addNewTranslation(): void {
    if (!this.product) {
      return;
    }
    const row: ProductTranslation = { language: 'en', description: '', content: '', slug: '' };
    this.product.translations = [...(this.product.translations || []), row];
  }

  removeTranslation(index: number): void {
    if (!this.product || !this.product.translations) {
      return;
    }
    this.product.translations = this.product.translations.filter((_row, at) => at !== index);
  }

  /** Save the product, and tell the listener, or say which field is wrong. */
  updateProduct(): void {
    if (!this.loaded || this.saving || this.uploading) {
      return;
    }
    if (this.newProduct && !this.product.category_id) {
      this.fieldErrors = { category_id: 'Choose a category' };
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.fieldErrors = {};
    this.conflict = false;

    const payload = this.payload();
    const request = this.newProduct
      ? this.products.createProduct(payload)
      : this.products.updateProduct(payload);

    request.subscribe({
      next: (saved) => {
        this.saving = false;
        this.product = this.withEditableShape(saved || payload);
        this.loadedId = this.product.id ?? this.loadedId;
        this.newProduct = false;
        this.markClean();
        this.saved.emit(saved || payload);
      },
      error: (error) => {
        this.saving = false;
        const explained = this.explain(error);
        this.errorMessage = explained.message;
        this.fieldErrors = explained.fields;
        if (error && error.status === 409) {
          this.conflict = true;
        }
      },
    });
  }

  /**
   * What is sent.
   *
   * The version the form was built from goes with it, so the server can refuse a save built on an
   * older record. The image paths are the ones the form shows, not the ones the product arrived with.
   */
  private payload(): Product {
    return {
      ...this.product,
      image_asset: {
        ...this.image,
        thumbnail_path: this.thumbnailPath,
        original_path: this.originalPath,
      },
      ...(this.newProduct ? {} : { expected_version: this.product.version }),
    } as Product;
  }

  /** Whether anything on the form differs from what was loaded or saved. */
  get dirty(): boolean {
    return this.loaded && JSON.stringify(this.payload()) !== this.snapshot;
  }

  private markClean(): void {
    this.snapshot = JSON.stringify(this.payload());
  }

  private confirmDiscard(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.confirm(this.translate.instant('ADMIN.DISCARD_CONFIRM'));
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    // Closing the tab is the one close the page cannot ask about itself.
    if (this.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  close(): void {
    if (this.dirty && !this.confirmDiscard()) {
      return;
    }
    this.closed.emit();
  }

  /** Where a customer would see this product, once it is saved. */
  previewLink(): string {
    if (!this.product || !this.product.id) {
      return '';
    }
    return `${(environment.siteUrl || '').replace(/\/$/, '')}/products?product=${this.product.id}`;
  }

  /** The categories the select offers: groups, then their sections marked as such. */
  get categoryOptions(): { id: number; label: string }[] {
    const options: { id: number; label: string }[] = [];
    for (const group of this.categories || []) {
      if (group.id) {
        options.push({ id: group.id, label: group.title });
      }
      for (const child of group.children || []) {
        if (child.id) {
          options.push({ id: child.id, label: '— ' + child.title });
        }
      }
    }
    return options;
  }

  unitLabel(unit: string): string {
    return 'ADMIN.UNIT_' + unit.toUpperCase();
  }

  /**
   * Whether this is a round section, whose two numbers are a diameter and a length.
   *
   * The catalogue's own test, moved with the markup: codes such as "Ø28 x 1.5" carry the diameter
   * sign. It takes an argument because the form asks it about a row as well as about the product.
   */
  isRound(value?: Product | { code?: string } | null): boolean {
    const code = value && (value as { code?: string }).code !== undefined
      ? String((value as { code?: string }).code || '')
      : String(this.product.code || '');
    return code.includes('Ø') || code.includes('ø');
  }

  /** The message beside a field, if the API blamed it. */
  errorFor(path: string): string {
    return this.fieldErrors[path] || '';
  }

  /**
   * Turn an API failure into something a person can act on.
   *
   * The API sends `{error, details}`, with details keyed by field path - marshmallow's own naming,
   * `dimensions.0.price` and the like. Both halves are kept: the sentence for the top of the form and
   * the paths for the fields that are wrong.
   */
  private explain(error: unknown): { message: string; fields: FieldErrors } {
    const fields: FieldErrors = {};
    const body = (error as { error?: unknown; message?: unknown })?.error ?? error;
    const parsed = typeof body === 'string' ? this.tryParse(body) : body;
    const object = (parsed || {}) as { error?: unknown; message?: unknown; details?: unknown };

    const details = object.details;
    if (details && typeof details === 'object') {
      for (const [path, value] of Object.entries(details as Record<string, unknown>)) {
        const text = Array.isArray(value) ? value.join(' ') : String(value);
        fields[path] = text;
      }
    }

    const sentence =
      (typeof object.error === 'string' && object.error) ||
      (typeof object.message === 'string' && object.message) ||
      (error as { message?: string })?.message ||
      '';
    const count = Object.keys(fields).length;
    if (!sentence && count) {
      return { message: Object.values(fields)[0], fields };
    }
    if (sentence && count && !sentence.includes(':') && sentence.length < 40) {
      // Something like "Validation Error" on its own says nothing; the fields do the talking.
      return { message: `${sentence}: ${Object.values(fields)[0]}`, fields };
    }
    return { message: sentence || 'The save did not go through.', fields };
  }

  private tryParse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
