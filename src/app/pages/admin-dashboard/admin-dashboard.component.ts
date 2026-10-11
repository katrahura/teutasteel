import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
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
    this.gapLoading = true;
    this.subscriptions.add(
      this.admin.getGapProducts(name, page).subscribe({
        next: (result) => {
          this.gapProducts = result.products || [];
          this.gapTotal = result.total;
          this.gapPage = result.page;
          this.gapPages = result.pages;
          this.gapLoading = false;
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
    return '';
  }
}
