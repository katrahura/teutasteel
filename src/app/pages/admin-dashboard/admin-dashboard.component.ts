import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, forkJoin } from 'rxjs';
import {
  AdminService,
  CatalogueSummary,
  GapProduct,
  SearchReport,
} from '../../services/admin.service';
import { ProductService } from '../../services/product.service';

/**
 * The owner's dashboard.
 *
 * It used to be a heading, a sentence and a button to the products page - a placeholder that told
 * the owner nothing they could act on. It now shows the two things the shop records and never read
 * back: what customers searched for, and where the catalogue has gaps.
 *
 * The two requests fail on their own. One refused report must not blank the other, and a refusal is
 * not a failure: this page belongs to the owner, and somebody signed in without the right needs to
 * be told that rather than shown an error.
 */
@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  imports: [RouterModule, TranslateModule, CommonModule],
  standalone: true,
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private admin = inject(AdminService);
  private products = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private subscriptions = new Subscription();

  summary: CatalogueSummary | null = null;
  report: SearchReport | null = null;
  loading = true;
  /** Signed in without the right, or not signed in at all. */
  denied = false;
  failed = false;
  /** The category currently being switched back on, so its own button can wait. */
  switching: number | null = null;

  /** The worklist open under the figures: which products, not just how many. */
  gap: string | null = null;
  gapProducts: GapProduct[] = [];
  gapTotal = 0;
  gapPage = 1;
  gapPages = 1;
  gapLoading = false;
  /** Whether the searches are filtered to the terms that found nothing. */
  onlyEmpty = false;
  /** True while the whole open list is being gathered for a download. */
  exporting = false;

  ngOnInit(): void {
    this.loading = true;

    this.subscriptions.add(
      this.admin.getSummary().subscribe({
        next: (summary) => {
          this.summary = summary;
          this.loading = false;
        },
        error: (error) => {
          this.noteRefusal(error);
          this.loading = false;
        },
      })
    );

    this.subscriptions.add(
      this.admin.getSearches().subscribe({
        next: (report) => {
          this.report = report;
          this.loading = false;
        },
        error: (error) => {
          this.noteRefusal(error);
          this.loading = false;
        },
      })
    );

    // The address says which list was open. Working through 396 products without photographs means
    // going to a product and coming back, and without this every return lands at the top of the
    // dashboard with the list closed and the page forgotten.
    const asked = this.route.snapshot.queryParamMap;
    if ((asked.get('searches') || '') === 'empty') {
      this.loadSearches(true);
    }
    const gap = asked.get('gap');
    if (gap) {
      this.openGap(gap, Number(asked.get('page')) || 1);
    }
  }

  /**
   * Keep the open list in the address.
   *
   * Replaced rather than pushed: the back button should leave the dashboard, not walk back through
   * every page of a list somebody is working through.
   */
  private remember(): void {
    // Nothing to write into while the page is rendered on the server: there is no address bar, and
    // navigating there is meaningless.
    if (typeof window === 'undefined') {
      return;
    }
    const queryParams: Record<string, string | number> = {};
    if (this.gap) {
      queryParams['gap'] = this.gap;
      queryParams['page'] = this.gapPage;
    }
    if (this.onlyEmpty) {
      queryParams['searches'] = 'empty';
    }
    this.router.navigate([], { queryParams, replaceUrl: true });
  }

  /**
   * Read the tally again, either the whole of it or only the terms that found nothing.
   *
   * The panel's own line is the reason to have it: a hundred terms is a report, and the handful
   * nobody could find is the list worth acting on.
   */
  loadSearches(onlyEmpty: boolean = false): void {
    this.onlyEmpty = onlyEmpty;
    this.remember();
    this.subscriptions.add(
      this.admin.getSearches(100, onlyEmpty).subscribe({
        next: (report) => { this.report = report; },
        error: (error) => this.noteRefusal(error),
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Switch a category back on, from the list of the ones that are off.
   *
   * The list is the reason to have this page: twenty-seven categories are off, and finding the one
   * you mean on the products page means opening groups until it turns up. A partial update is all
   * the API needs for this - editing catalogue content is a signed-in act, deleting is not - and
   * the summary is read again afterwards so the figures and the list agree with what was done.
   */
  switchOn(category: { id: number; title: string }): void {
    if (this.switching !== null) {
      return;
    }
    this.switching = category.id;
    this.subscriptions.add(
      this.products.updateCategory({ id: category.id, is_active: true } as any).subscribe({
        next: () => {
          this.switching = null;
          this.subscriptions.add(
            this.admin.getSummary().subscribe({
              next: (summary) => { this.summary = summary; },
              error: (error) => this.noteRefusal(error),
            })
          );
        },
        error: (error) => {
          this.switching = null;
          this.noteRefusal(error);
        },
      })
    );
  }

  private noteRefusal(error: any): void {
    const status = error && error.status;
    if (status === 401 || status === 403) {
      this.denied = true;
    } else {
      this.failed = true;
    }
  }

  /**
   * Open the worklist behind one of the figures.
   *
   * The figures say how many products are missing a photograph, have no size, or sit under a
   * category that is switched off. None of that is actionable until it says which one, so each
   * opens the list underneath.
   */
  openGap(name: string, page: number = 1): void {
    this.gap = name;
    this.gapPage = page;
    this.gapLoading = true;
    this.remember();
    this.subscriptions.add(
      this.admin.getGapProducts(name, page).subscribe({
        next: (result) => {
          this.gapProducts = result.products || [];
          this.gapTotal = result.total;
          this.gapPage = result.page;
          this.gapPages = result.pages;
          this.gapLoading = false;
          this.remember();
        },
        error: (error) => {
          this.noteRefusal(error);
          this.gapLoading = false;
        },
      })
    );
  }

  closeGap(): void {
    this.gap = null;
    this.gapProducts = [];
    this.remember();
  }

  /**
   * The open list as a CSV, so it can leave the screen.
   *
   * The pictures for these products are not added here - they go up through the hosting panel -
   * which makes this list a shopping list for whoever takes them rather than a form to fill in.
   * Kept apart from the download so what it produces can be tested without a browser.
   *
   * The escaping is not optional: a code like `+ Korit 10x100cm` is harmless, but one holding a
   * comma or a quote would shift every column after it.
   */
  csvOf(products: GapProduct[]): string {
    const cell = (value: string | null | undefined): string => {
      const text = value == null ? '' : String(value);
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const head = [
      this.translate.instant('ADMIN.CODE'),
      this.translate.instant('ADMIN.GROUP'),
      this.translate.instant('ADMIN.CATEGORY'),
    ];
    const rows = products.map((product) => [product.code, product.group, product.category]);
    return [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  }

  /** Gather every page of the open list and hand it to the browser as a file. */
  downloadOpenGap(): void {
    const gap = this.gap;
    if (!gap || this.exporting) {
      return;
    }
    this.exporting = true;
    // A hundred to a request: the API's ceiling, so 1107 products is twelve calls rather than
    // fifty-six.
    const pageCount = Math.max(1, Math.ceil(this.gapTotal / 100));
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

    this.subscriptions.add(
      forkJoin(pages.map((page) => this.admin.getGapProducts(gap, page, 100))).subscribe({
        next: (results) => {
          const all: GapProduct[] = [];
          results.forEach((result) => all.push(...(result.products || [])));
          this.saveCsv(gap, this.csvOf(all));
          this.exporting = false;
        },
        error: (error) => {
          this.noteRefusal(error);
          this.exporting = false;
        },
      })
    );
  }

  private saveCsv(gap: string, csv: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const name = `teutasteel-${gap}-${new Date().toISOString().slice(0, 10)}.csv`;
    // The byte order mark is for Excel: without it the Albanian names arrive as mojibake.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Which figure the open list belongs to, so its heading can say the same thing. */
  gapLabelKey(): string {
    if (this.gap === 'no_photo') {
      return 'ADMIN.PRICED_WITHOUT_PHOTO';
    }
    if (this.gap === 'no_size') {
      return 'ADMIN.PRICED_WITHOUT_SIZE';
    }
    if (this.gap === 'off_category') {
      return 'ADMIN.IN_OFF_CATEGORIES';
    }
    if (this.gap === 'no_details') {
      return 'ADMIN.NO_DETAILS';
    }
    return '';
  }
}
