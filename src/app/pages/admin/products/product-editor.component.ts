import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { ImageAsset, Product, ProductDimension, ProductTranslation } from '../../../models/product.model';

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

/** A message from the API, split into what happened and which fields it blames. */
interface FieldErrors {
  [path: string]: string;
}

/**
 * One product's editor: code, cut type, visibility, photograph, dimensions and translations.
 *
 * The markup is the catalogue's own modal, moved here unchanged - 367 lines, nineteen fields - so both
 * the catalogue and the administrator's table can open the same editor. It is a component with an id
 * rather than a modal bound to a page's selected product: `productId` comes in, `saved` and `closed`
 * go out, and it knows nothing about the page it is rendered in.
 *
 * The API answers a rejected save with a message and a `details` object keyed by field path -
 * `dimensions.0.price`, `translations.1.slug`, `code`. Those are kept as they arrive, so the field
 * that is wrong can say so itself instead of one sentence at the top standing in for all of them.
 */
@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './product-editor.component.html',
  styleUrls: ['./product-editor.component.css'],
})
export class ProductEditorComponent implements OnChanges {
  private products = inject(ProductService);
  private translate = inject(TranslateService);

  /** Which product to edit. Changing it reloads; the panel stays where it is. */
  @Input() productId: number | null = null;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && this.productId) {
      this.load(this.productId);
    }
  }

  load(id: number): void {
    this.loading = true;
    this.failed = false;
    this.errorMessage = '';
    this.fieldErrors = {};
    const language = this.translate.currentLang || 'al';
    this.products.getProductById(id, language).subscribe({
      next: (product) => {
        this.product = this.withEditableShape(product);
        this.loaded = true;
        this.image = { ...this.image, ...(product?.image_asset || {}) };
        this.thumbnailPath = product?.image_asset?.thumbnail_path || '';
        this.originalPath = product?.image_asset?.original_path || '';
        this.loading = false;
      },
      error: (error) => {
        this.failed = true;
        this.loading = false;
        this.errorMessage = this.explain(error).message;
      },
    });
  }

  /** A product with the pieces the form binds to, so a missing dimension or image cannot crash it. */
  private withEditableShape(product: Product): Product {
    const editable: Product = { ...product };
    editable.dimensions = (product.dimensions || []).map((dimension) => ({
      ...dimension,
      currency: dimension.currency || 'EUR',
    }));
    editable.translations = (product.translations || []).map((translation) => ({ ...translation }));
    editable.image_asset = product.image_asset || {
      file_name: '',
      alternative_text: '',
      thumbnail_path: '',
      original_path: '',
    };
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
    if (!this.loaded || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.fieldErrors = {};

    const payload: Product = {
      ...this.product,
      image_asset: {
        ...this.image,
        thumbnail_path: this.thumbnailPath,
        original_path: this.originalPath,
      },
    };

    this.products.updateProduct(payload as unknown as Product).subscribe({
      next: (saved) => {
        this.saving = false;
        this.product = this.withEditableShape(saved || payload);
        this.saved.emit(saved || payload);
      },
      error: (error) => {
        this.saving = false;
        const explained = this.explain(error);
        this.errorMessage = explained.message;
        this.fieldErrors = explained.fields;
      },
    });
  }

  close(): void {
    this.closed.emit();
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
