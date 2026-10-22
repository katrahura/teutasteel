import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { AdminService, CatalogueQuery, CatalogueRow } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { Product, TopCategory } from '../../../models/product.model';
import { ProductEditorComponent } from './product-editor.component';

/**
 * The catalogue, as a table.
 *
 * The panel could only list one gap at a time - priced without a photograph, priced without a
 * thickness - and anything else meant going to the public catalogue and clicking through groups. This
 * is every product, including the switched-off ones, with the filters that make 2,368 rows usable and
 * a total that makes paging honest.
 *
 * Where you are is kept in the address, like the figures' worklists already do: going to a product
 * and coming back must not land you at the top of an unfiltered list. Replaced rather than pushed, so
 * the back button leaves the panel instead of walking back through every page.
 *
 * The row opens the existing editor in the catalogue for now. Replacing that with a panel beside the
 * list is the next step of this phase; it is left as it is rather than half-built.
 */
@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, ProductEditorComponent],
  templateUrl: './admin-products.component.html',
  styleUrls: ['./admin-products.component.css'],
})
export class AdminProductsComponent implements OnInit, OnDestroy {
  private admin = inject(AdminService);
  private products = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions = new Subscription();
  private debounce: ReturnType<typeof setTimeout> | null = null;

  rows: CatalogueRow[] = [];
  total = 0;
  page = 1;
  pages = 1;
  perPage = 50;
  loading = true;
  failed = false;
  denied = false;
  /** The copy that was just made, so the table can say which one it was. */
  copied: string | null = null;
  duplicating: number | null = null;
  /** The product open in the panel, and the code of the one just saved. */
  openId: number | null = null;
  savedCode: string | null = null;

  q = '';
  category: number | null = null;
  active: 'all' | '1' | '0' = 'all';
  groups: TopCategory[] = [];

  ngOnInit(): void {
    // The filter offers the catalogue's own categories, groups and sections both, so nobody has to
    // remember an id.
    this.subscriptions.add(
      this.products.getCategoryTree().subscribe({
        next: (tree) => { this.groups = tree || []; },
        error: () => { this.groups = []; },
      })
    );

    const asked = this.route.snapshot.queryParamMap;
    this.q = asked.get('q') || '';
    this.active = (asked.get('active') as 'all' | '1' | '0') || 'all';
    this.category = Number(asked.get('category')) || null;
    this.load(Number(asked.get('page')) || 1);
  }

  ngOnDestroy(): void {
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.subscriptions.unsubscribe();
  }

  /** The filters as the API takes them. */
  private query(page: number): CatalogueQuery {
    return { q: this.q, category: this.category, active: this.active, page, perPage: this.perPage };
  }

  private remember(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const queryParams: Record<string, string | number> = {};
    if (this.q.trim()) { queryParams['q'] = this.q.trim(); }
    if (this.category) { queryParams['category'] = this.category; }
    if (this.active !== 'all') { queryParams['active'] = this.active; }
    if (this.page > 1) { queryParams['page'] = this.page; }
    this.router.navigate([], { queryParams, replaceUrl: true });
  }

  load(page: number = 1): void {
    this.loading = true;
    this.failed = false;
    this.remember();
    this.subscriptions.add(
      this.admin.getCatalogue(this.query(page)).subscribe({
        next: (result) => {
          this.rows = result.products || [];
          this.total = result.total;
          this.page = result.page;
          this.pages = Math.max(result.pages, 1);
          this.loading = false;
          this.remember();
        },
        error: (error) => {
          const status = error && error.status;
          if (status === 401 || status === 403) {
            this.denied = true;
          } else {
            this.failed = true;
          }
          this.loading = false;
        },
      })
    );
  }

  /** Typing waits for a pause: one request per word typed would be one per letter. */
  onSearch(): void {
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => this.load(1), 300);
  }

  clearFilters(): void {
    this.q = '';
    this.category = null;
    this.active = 'all';
    this.load(1);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) {
      return;
    }
    this.load(page);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Copy a row, switched off, and refresh this page so the new one is visible where it belongs. */
  duplicate(row: CatalogueRow): void {
    if (this.duplicating !== null) {
      return;
    }
    this.duplicating = row.id;
    this.copied = null;
    this.subscriptions.add(
      this.admin.duplicateProduct(row.id).subscribe({
        next: (created) => {
          this.duplicating = null;
          this.copied = created.code;
          this.load(this.page);
        },
        error: (error) => {
          this.duplicating = null;
          const status = error && error.status;
          if (status === 401 || status === 403) {
            this.denied = true;
          } else {
            this.failed = true;
          }
        },
      })
    );
  }

  /** Open a product in the panel beside the table, without leaving the list. */
  open(row: CatalogueRow): void {
    this.savedCode = null;
    this.copied = null;
    this.openId = row.id;
  }

  closeEditor(): void {
    this.openId = null;
  }

  /** After a save: close the panel, keep the filters and the page, and say what was saved. */
  onSaved(product: Product): void {
    this.savedCode = product && product.code ? product.code : null;
    this.openId = null;
    this.load(this.page);
  }

  /** The chips a row carries: what is wrong with it, or that it is on and complete. */
  statusOf(row: CatalogueRow): string[] {
    const out: string[] = [];
    if (!row.is_active) { out.push('ADMIN.STATUS_OFF'); }
    // Switched on and still invisible: the category above it is off, which is how most of this
    // catalogue's hidden products are hidden.
    if (row.is_active && !row.category_active) { out.push('ADMIN.STATUS_OFF_CATEGORY'); }
    if (!row.has_photo) { out.push('ADMIN.STATUS_NO_PHOTO'); }
    if (row.price === null) { out.push('ADMIN.STATUS_NO_PRICE'); }
    if (row.dimensions_count === 0) { out.push('ADMIN.STATUS_NO_SIZE'); }
    return out;
  }

  /** Whether the row has both languages, so a missing translation is visible without opening it. */
  missingLanguage(row: CatalogueRow): string | null {
    const languages = row.languages || [];
    if (!languages.includes('al')) { return 'AL'; }
    if (!languages.includes('en')) { return 'EN'; }
    return null;
  }

  priceOf(row: CatalogueRow): string {
    if (row.price === null) {
      return '—';
    }
    return `${row.price.toFixed(2)} ${row.currency || ''}`.trim();
  }

  /** A section title for the filter: the group, with its sections marked as such. */
  categoryLabel(category: TopCategory, nested: boolean = false): string {
    const title = (category as unknown as { title?: string }).title || '';
    return nested ? '— ' + title : title;
  }
}
