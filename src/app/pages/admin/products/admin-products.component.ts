import { CommonModule } from '@angular/common';
import { Component, HostListener, ViewChild, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { ActivityRecord, AdminService, BulkPriceReport, CatalogueQuery, CatalogueRow, ImportRecord, ImportReport } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { Product, TopCategory } from '../../../models/product.model';
import { ProductEditorComponent } from './product-editor.component';
import { confirmUnsaved } from '../../../shared/unsaved-work';
import { csvDocument } from '../../../shared/csv';

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
  @ViewChild(ProductEditorComponent) editor?: ProductEditorComponent;
  canLeave(): boolean { return this.editor?.canLeave() ?? true; }
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
  /** The panel is open on a product that does not exist yet. */
  creating = false;
  /** The code of the product in the panel, so the panel can say which one it is. */
  openedCode: string | null = null;
  savedCode: string | null = null;

  /** The importer: the spreadsheet as text, what the preview said, and what the apply said. */
  private importPreviewToken?: string;
  private importRetryKey?: string;
  private reviewedCsv = '';
  importCsv = '';
  importName = '';
  importReport: ImportReport | null = null;
  importing = false;
  importError = '';
  importDone: string | null = null;
  importHistory: ImportRecord[] = [];
  activity: ActivityRecord[] = [];
  activityLoaded = false;
  /** Opened from the dashboard's compact "recent changes" link. */
  activityOpen = false;
  /** The history's own filters and page: a year of changes should still be findable. */
  activityQuery = '';
  activityAction = '';
  activityPage = 1;
  activityPages = 1;
  activityTotal = 0;
  activityActions: string[] = [];

  /** The rows ticked for a bulk change. Cleared on every load: a selection is for one page's work. */
  selectedIds = new Set<number>();

  /** A bulk price change: what was asked, what the preview said, and what happened. */
  bulkMode: 'percent' | 'amount' | 'set' = 'percent';
  bulkValue: number | null = null;
  bulkReport: BulkPriceReport | null = null;
  bulkBusy = false;
  bulkError = '';
  bulkDone = '';
  /** The token the last preview returned, and the key that makes this apply safe to retry. */
  private bulkPreviewToken: string | null = null;
  private bulkIdempotencyKey: string | null = null;
  private bulkPreviewSignature = '';

  q = '';
  category: number | null = null;
  active: 'all' | '1' | '0' | 'hidden' = 'all';
  /** A dashboard quality check, applied by the API's own definition of it. */
  gap: string | null = null;
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
    this.active = (asked.get('active') as 'all' | '1' | '0' | 'hidden') || 'all';
    this.category = Number(asked.get('category')) || null;
    this.gap = asked.get('gap');
    this.activityOpen = asked.get('activity') === '1';
    if (this.activityOpen) {
      this.loadActivity();
    }
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
    // The fourth choice is not a value of `active`: it asks for the products whose category is off,
    // which is a different question from whether the product itself is switched on.
    const hidden = this.active === 'hidden';
    const active = this.active === 'hidden' ? 'all' : this.active;
    return { q: this.q, category: this.category, active, hidden, gap: this.gap,
             page, perPage: this.perPage };
  }

  private remember(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const queryParams: Record<string, string | number> = {};
    if (this.q.trim()) { queryParams['q'] = this.q.trim(); }
    if (this.category) { queryParams['category'] = this.category; }
    if (this.active !== 'all') { queryParams['active'] = this.active; }
    if (this.gap) { queryParams['gap'] = this.gap; }
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
          this.selectedIds.clear();
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
    this.gap = null;
    this.load(1);
  }

  /** The heading of the quality filter the dashboard sent us to, or '' when none is applied. */
  gapLabelKey(): string {
    const keys: Record<string, string> = {
      no_photo: 'ADMIN.PRICED_WITHOUT_PHOTO',
      no_size: 'ADMIN.PRICED_WITHOUT_SIZE',
      no_thickness: 'ADMIN.PRICED_WITHOUT_THICKNESS',
      off_category: 'ADMIN.IN_OFF_CATEGORIES',
      hidden_by_category: 'ADMIN.HIDDEN_BY_CATEGORY',
      no_details: 'ADMIN.NO_DETAILS',
      missing_language: 'ADMIN.MISSING_LANGUAGE',
      bad_price: 'ADMIN.BAD_PRICE',
      no_price_unit: 'ADMIN.PRICED_WITHOUT_UNIT',
    };
    return this.gap ? (keys[this.gap] || '') : '';
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

  /** Read the chosen file, then show what it would do before anything is written. */
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    file.text().then((text) => {
      this.importCsv = text;
      this.importName = file.name;
      this.importReport = null;
      this.importDone = null;
      this.loadHistory();
      this.runImport(true);
    });
  }

  /** The history, read when the list is opened rather than on every visit. */
  openActivity(): void {
    if (!this.activityLoaded) {
      this.loadActivity(1);
    }
  }

  /** Read one page, optionally restarting because a filter changed. */
  loadActivity(page = 1, reload = false): void {
    if (this.activityLoaded && !reload && page === this.activityPage) {
      return;
    }
    this.activityLoaded = true;
    this.subscriptions.add(
      this.admin.getActivity({
        q: this.activityQuery,
        action: this.activityAction,
        page,
        perPage: 20,
      }).subscribe({
        next: (body) => {
          this.activity = body.activity || [];
          this.activityPage = body.page || page;
          this.activityPages = Math.max(body.pages || 1, 1);
          this.activityTotal = body.total || 0;
          this.activityActions = body.actions || [];
        },
        error: () => { this.activityLoaded = false; },
      })
    );
  }

  /** What was imported before, so a change can be traced back to the file that made it. */
  loadHistory(): void {
    this.subscriptions.add(
      this.admin.getImportHistory().subscribe({
        next: (body) => { this.importHistory = body.imports || []; },
        error: () => { this.importHistory = []; },
      })
    );
  }

  /** The refused lines as a spreadsheet, so the file can be fixed and offered again. */
  downloadRejected(): void {
    const refused = (this.importReport && this.importReport.rejected) || [];
    if (!refused.length || typeof window === 'undefined') {
      return;
    }
    const lines = csvDocument(
      ['line', 'code', 'reason'],
      refused.map((row) => [row.line, row.code, row.reason])
    );
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'refused-lines.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  previewImport(): void {
    this.runImport(true);
  }

  /** Write what the preview showed. Same call, one flag between them. */
  applyImport(): void {
    if (!this.importPreviewToken || this.importCsv !== this.reviewedCsv) { this.importError = 'ADMIN.BULK_PREVIEW_FIRST'; return; }
    this.runImport(false);
  }

  private runImport(dryRun: boolean): void {
    if (!this.importCsv || this.importing) {
      return;
    }
    this.importing = true;
    this.importError = '';
    this.importDone = null;
    this.subscriptions.add(
      this.admin.importThickness(this.importCsv, dryRun, this.importPreviewToken, this.importRetryKey).subscribe({
        next: (report) => {
          this.importing = false;
          this.importReport = report;
          if (report.dry_run) { this.importPreviewToken = report.preview_token; this.reviewedCsv = this.importCsv; this.importRetryKey = this.newIdempotencyKey(); }
          if (!report.dry_run) {
            this.importDone = String(report.applied.length);
            this.importPreviewToken = undefined; this.importRetryKey = undefined;
            this.load(this.page);
            this.loadHistory();
          }
        },
        error: (error) => {
          this.importing = false;
          const status = error && error.status;
          if (status === 409) { this.importPreviewToken = undefined; this.importReport = null; }
          this.importError = status === 401 || status === 403
            ? 'ADMIN.NOT_ALLOWED'
            : (error && error.error && error.error.error) || 'ADMIN.TABLE_FAILED';
        },
      })
    );
  }

  /** Escape closes the panel: a keyboard leaves it the way a mouse does. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.openId || this.creating) {
      this.closeEditor();
    }
  }

  /** Open a blank product in the panel. It is saved switched off. */
  startCreate(): void {
    if (this.creating) return;
    if (!this.canLeave()) return;
    this.savedCode = null;
    this.copied = null;
    this.openId = null;
    this.openedCode = null;
    this.creating = true;
  }

  /** Open a product in the panel beside the table, without leaving the list. */
  open(row: CatalogueRow): void {
    if (this.openId === row.id && !this.creating) return;
    if (!this.canLeave()) return;
    this.savedCode = null;
    this.copied = null;
    this.creating = false;
    this.openId = row.id;
    this.openedCode = row.code;
  }

  closeEditor(): void {
    if (!this.canLeave()) return;
    this.dismissEditor();
  }

  dismissEditor(): void {
    this.openId = null;
    this.openedCode = null;
    this.creating = false;
  }

  /** After a save: close the panel, keep the filters and the page, and say what was saved. */
  onSaved(product: Product): void {
    this.savedCode = product && product.code ? product.code : null;
    this.openId = null;
    this.openedCode = null;
    this.creating = false;
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

  /** Tick or untick one row. */
  toggleRow(row: CatalogueRow): void {
    if (this.selectedIds.has(row.id)) {
      this.selectedIds.delete(row.id);
    } else {
      this.selectedIds.add(row.id);
    }
  }

  /** Tick every row on this page, or clear them all. */
  toggleAllRows(): void {
    if (!this.rows.length) {
      return;
    }
    if (this.selectedIds.size >= this.rows.length) {
      this.selectedIds.clear();
      return;
    }
    this.rows.forEach((row) => this.selectedIds.add(row.id));
  }

  /** What a bulk change would do, before it does it. */
  previewBulk(): void {
    this.runBulk(true);
  }

  /** Write what the preview showed. Refused when the preview is no longer the one on screen. */
  applyBulk(): void {
    if (!this.bulkPreviewToken) {
      this.bulkError = 'ADMIN.BULK_PREVIEW_FIRST';
      return;
    }
    if (this.bulkSignature() !== this.bulkPreviewSignature) {
      this.bulkReport = null;
      this.bulkPreviewToken = null;
      this.bulkError = 'ADMIN.BULK_STALE_PREVIEW';
      return;
    }
    this.runBulk(false);
  }

  /** What the preview promised: the mode, the value and exactly which rows are selected. */
  private bulkSignature(): string {
    return `${this.bulkMode}|${this.bulkValue}|${Array.from(this.selectedIds).sort().join(',')}`;
  }

  private newIdempotencyKey(): string {
    const at = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    return `bulk-${at}`;
  }

  /** Typing a new value or changing the mode invalidates the preview on screen. */
  resetBulkPreview(): void {
    this.bulkReport = null;
    this.bulkPreviewToken = null;
    this.bulkPreviewSignature = '';
    this.bulkError = '';
  }

  private runBulk(dryRun: boolean): void {
    if (!this.selectedIds.size || this.bulkValue === null || this.bulkBusy) {
      return;
    }
    this.bulkBusy = true;
    this.bulkError = '';
    this.bulkDone = '';
    this.subscriptions.add(
      this.admin.bulkPrices({
        products: Array.from(this.selectedIds),
        mode: this.bulkMode,
        value: Number(this.bulkValue),
        dryRun,
        previewToken: this.bulkPreviewToken || undefined,
        idempotencyKey: this.bulkIdempotencyKey || undefined,
      }).subscribe({
        next: (report) => {
          this.bulkBusy = false;
          this.bulkReport = report;
          if (dryRun) {
            this.bulkPreviewToken = report.preview_token || null;
            this.bulkPreviewSignature = this.bulkSignature();
            if (!this.bulkIdempotencyKey) {
              this.bulkIdempotencyKey = this.newIdempotencyKey();
            }
            return;
          }
          this.bulkDone = String(report.count);
          this.bulkReport = null;
          this.bulkPreviewToken = null;
          this.bulkIdempotencyKey = null;
          this.bulkPreviewSignature = '';
          this.selectedIds.clear();
          this.load(this.page);
        },
        error: (error) => {
          this.bulkBusy = false;
          const status = error && error.status;
          if (status === 409) {
            this.bulkReport = null;
            this.bulkPreviewToken = null;
            this.bulkError = 'ADMIN.BULK_STALE_PREVIEW';
            return;
          }
          this.bulkError = status === 401 || status === 403
            ? 'ADMIN.NOT_ALLOWED'
            : (error && error.error && error.error.error) || 'ADMIN.TABLE_FAILED';
        },
      })
    );
  }
}
