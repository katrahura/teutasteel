import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { Category } from '../../../models/product.model';
import { ProductService } from '../../../services/product.service';

/**
 * The catalogue's categories, and whether each one is on.
 *
 * Twenty-six of them are switched off, and they hold 1,032 products nobody can see. Until now the only
 * way to switch one on was the dashboard's old panel, one at a time, with no list of what was off.
 *
 * The API already had both halves - the list and the update - so this page is a table with a switch on
 * every row, and it says what happened on the row itself.
 */
@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './admin-categories.component.html',
  styleUrls: ['./admin-categories.component.css'],
})
export class AdminCategoriesComponent implements OnInit {
  private products = inject(ProductService);

  rows: { category: Category; saving: boolean; note: string }[] = [];
  loading = true;
  failed = false;
  denied = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.products.getCategories().subscribe({
      next: (categories) => {
        // Groups first, each followed by its sections: the tree is what the owner thinks in.
        const all = categories || [];
        const top = all.filter((c) => !c.parent_id);
        const ordered: Category[] = [];
        top.forEach((parent) => {
          ordered.push(parent);
          all.filter((c) => c.parent_id === parent.id).forEach((child) => ordered.push(child));
        });
        all.forEach((c) => { if (!ordered.some((o) => o.id === c.id)) { ordered.push(c); } });
        this.rows = ordered.map((category) => ({ category, saving: false, note: '' }));
        this.loading = false;
      },
      error: (error) => {
        const status = error && error.status;
        this.denied = status === 401 || status === 403;
        this.failed = !this.denied;
        this.loading = false;
      },
    });
  }

  /** Switch one category on or off, and say what happened on its own row. */
  toggle(row: { category: Category; saving: boolean; note: string }): void {
    if (row.saving) {
      return;
    }
    const wanted = !row.category.is_active;
    row.saving = true;
    row.note = '';
    this.products.updateCategory({ ...row.category, is_active: wanted } as Category).subscribe({
      next: (saved) => {
        row.saving = false;
        row.category = saved || { ...row.category, is_active: wanted };
        row.note = wanted ? 'ADMIN.CATEGORY_ON' : 'ADMIN.CATEGORY_OFF';
      },
      error: (error) => {
        row.saving = false;
        const status = error && error.status;
        row.note = status === 401 || status === 403 ? 'ADMIN.NOT_ALLOWED' : 'ADMIN.TABLE_FAILED';
      },
    });
  }

  /** How many rows are switched off, which is the number the owner came to change. */
  get offCount(): number {
    return this.rows.filter((r) => !r.category.is_active).length;
  }

  titleOf(row: { category: Category }): string {
    return row.category.title;
  }
}