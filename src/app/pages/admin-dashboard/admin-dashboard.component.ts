import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import {
  AdminService,
  CatalogueSummary,
  SearchReport,
} from '../../services/admin.service';

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
  private subscriptions = new Subscription();

  summary: CatalogueSummary | null = null;
  report: SearchReport | null = null;
  loading = true;
  /** Signed in without the right, or not signed in at all. */
  denied = false;
  failed = false;

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

  private noteRefusal(error: any): void {
    const status = error && error.status;
    if (status === 401 || status === 403) {
      this.denied = true;
    } else {
      this.failed = true;
    }
  }
}
