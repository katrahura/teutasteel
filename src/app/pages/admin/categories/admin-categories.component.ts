import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { Category, ImageAsset } from '../../../models/product.model';
import { ProductService } from '../../../services/product.service';
import { AdminService, MediaConfig } from '../../../services/admin.service';
import { AdminSessionService } from '../../../services/admin-session.service';
import { CloudinaryService } from '../../../services/cloudinary.service';
import { confirmUnsaved } from '../../../shared/unsaved-work';
import { environment } from '../../../../environments/environment';

/** One line of the table: the category, how deep it sits, and what is above it. */
interface Row {
  category: Category;
  depth: number;
  ancestors: Category[];
}

function emptyImage(): ImageAsset {
  return { file_name: '', alternative_text: '', thumbnail_path: '', original_path: '' };
}

/**
 * The catalogue's categories: the tree, what is in each branch, and what switching it off hides.
 *
 * This page used to be a flat list with a switch and nothing else - no way to rename, no way to file
 * a section under a different group, and no image. The API could already do all of it; what was
 * missing was a place that showed the consequences before the switch was pressed.
 *
 * Two rules the screen states rather than hides:
 * - an enabled section under a disabled group is still invisible to a customer;
 * - switching a branch off changes visibility, never data. Nothing here deletes a product.
 */
@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './admin-categories.component.html',
  styleUrls: ['./admin-categories.component.css'],
})
export class AdminCategoriesComponent implements OnInit, OnDestroy {
  private products = inject(ProductService);
  private admin = inject(AdminService);
  private cloudinary = inject(CloudinaryService);
  private session = inject(AdminSessionService);

  all: Category[] = [];
  rows: Row[] = [];
  collapsed = new Set<number>();
  search = '';
  loading = true;
  failed = false;
  denied = false;
  /** Only an administrator may change categories; an editor reads the tree. */
  canWrite = false;

  /** The category being created or edited, or null. */
  editing: Category | null = null;
  isNew = false;
  saving = false;
  errorMessage = '';
  fieldErrors: Record<string, string> = {};
  note = '';

  /** The photograph as the form edits it; the stored one is untouched until a save succeeds. */
  image: ImageAsset = emptyImage();
  mediaConfig: MediaConfig | null = null;
  private mediaConfigLoaded = false;
  private snapshot = '';
  private uploadAbort?: AbortController;
  private editGeneration = 0;
  get dirty(): boolean { return !!this.editing && JSON.stringify({editing:this.editing,image:this.image}) !== this.snapshot; }
  private markClean(): void { this.snapshot = JSON.stringify({editing:this.editing,image:this.image}); }
  canLeave(): boolean { return !this.saving && confirmUnsaved(this.dirty || this.uploading); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty || this.uploading) { event.preventDefault(); event.returnValue = ''; } }
  cancelUpload(): void { this.editGeneration++; this.uploadAbort?.abort(); this.uploading = false; this.uploadProgress = 0; }
  ngOnDestroy(): void { this.cancelUpload(); }
  uploading = false;
  uploadProgress = 0;
  uploadError = '';
  /** The category the running upload belongs to; 'new' for the unsaved one. */
  private uploadFor: number | 'new' | null = null;

  ngOnInit(): void {
    this.canWrite = this.session.can('categories.write');
    // The session answer may arrive after this page; ask once and keep the capability in step.
    if (!this.canWrite) {
      this.session.me().subscribe({
        next: () => { this.canWrite = this.session.can('categories.write'); },
        error: () => { this.canWrite = false; },
      });
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.products.getCategories().subscribe({
      next: (categories) => {
        this.all = categories || [];
        this.rebuild();
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

  /** Groups first, each followed by its sections; a collapsed group hides what is below it. */
  private rebuild(): void {
    const byParent = new Map<number | null, Category[]>();
    for (const category of this.all) {
      const key = category.parent_id ?? null;
      const list = byParent.get(key) || [];
      list.push(category);
      byParent.set(key, list);
    }
    for (const list of byParent.values()) {
      list.sort((left, right) => (left.title || '').localeCompare(right.title || ''));
    }

    const ordered: Row[] = [];
    const seen = new Set<number>();
    const walk = (parent: number | null, depth: number, ancestors: Category[]): void => {
      for (const category of byParent.get(parent) || []) {
        if (category.id) {
          if (seen.has(category.id)) {
            continue;
          }
          seen.add(category.id);
        }
        ordered.push({ category, depth, ancestors });
        if (category.id && !this.collapsed.has(category.id)) {
          walk(category.id, depth + 1, [...ancestors, category]);
        }
      }
    };
    walk(null, 0, []);

    // Anything not reached because its parent no longer exists is still shown rather than lost. A
    // section hidden by a collapse is not "unreached": it has a parent, and the tree is working.
    const ids = new Set(this.all.map((category) => category.id));
    for (const category of this.all) {
      if (!category.id || seen.has(category.id)) {
        continue;
      }
      if (category.parent_id == null || !ids.has(category.parent_id)) {
        ordered.push({ category, depth: 0, ancestors: [] });
      }
    }
    this.rows = ordered;
  }

  /** What the table shows: the tree, or the matches for a search. */
  get visibleRows(): Row[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.rows;
    }
    return this.all
      .filter((category) =>
        (category.title || '').toLowerCase().includes(term) ||
        (category.title_en || '').toLowerCase().includes(term))
      .map((category) => ({ category, depth: 0, ancestors: this.ancestorsOf(category) }));
  }

  ancestorsOf(category: Category): Category[] {
    const byId = new Map(this.all.map((row) => [row.id, row]));
    const chain: Category[] = [];
    let parent = category.parent_id ? byId.get(category.parent_id) : undefined;
    const seen = new Set<number>();
    while (parent && parent.id && !seen.has(parent.id)) {
      seen.add(parent.id);
      chain.unshift(parent);
      parent = parent.parent_id ? byId.get(parent.parent_id) : undefined;
    }
    return chain;
  }

  /** A category switched on under a switched-off ancestor is still hidden; this says which one. */
  hiddenBy(row: Row): Category | null {
    if (!row.category.is_active) {
      return null;
    }
    return row.ancestors.find((ancestor) => !ancestor.is_active) || null;
  }

  hasChildren(category: Category): boolean {
    return this.all.some((row) => row.parent_id === category.id);
  }

  toggleCollapse(category: Category): void {
    if (!category.id) {
      return;
    }
    if (this.collapsed.has(category.id)) {
      this.collapsed.delete(category.id);
    } else {
      this.collapsed.add(category.id);
    }
    this.rebuild();
  }

  titleOf(category: Category): string {
    return category.title;
  }

  /** How many rows are switched off, which is the number the owner came to change. */
  get offCount(): number {
    return this.all.filter((category) => !category.is_active).length;
  }

  /** How many products a branch holds, switched on or not. */
  productTotal(category: Category): number {
    return category.product_total != null
      ? category.product_total
      : this.all
          .filter((row) => row.id === category.id || this.isBelow(row, category.id))
          .reduce((sum, row) => sum + (row.products?.length || 0), 0);
  }

  private isBelow(category: Category, ancestorId: number | undefined): boolean {
    if (!ancestorId) {
      return false;
    }
    return this.ancestorsOf(category).some((row) => row.id === ancestorId);
  }

  // --- the editor ---------------------------------------------------------------------------

  startNew(parent: Category | null = null): void {
    if (!this.canLeave()) return;
    this.cancelUpload();
    if (!this.canWrite) {
      return;
    }
    this.isNew = true;
    this.note = '';
    this.errorMessage = '';
    this.fieldErrors = {};
    this.image = emptyImage();
    this.editing = {
      title: '',
      title_en: '',
      is_active: true,
      parent_id: parent && parent.id ? parent.id : null,
    };
    this.markClean();
  }

  edit(row: Row): void {
    if (!this.canLeave()) return;
    this.cancelUpload();
    if (!this.canWrite) {
      return;
    }
    this.isNew = false;
    this.note = '';
    this.errorMessage = '';
    this.fieldErrors = {};
    this.editing = { ...row.category };
    this.image = { ...emptyImage(), ...(row.category.image_asset || {}) };
    this.markClean();
  }

  cancel(): void {
    if (!this.canLeave()) return;
    this.cancelUpload();
    this.editing = null;
    this.isNew = false;
    this.image = emptyImage();
    this.uploadError = '';
  }

  /** Switch one category on or off without opening the editor. Visibility only; nothing is deleted. */
  toggle(category: Category): void {
    if (!this.canWrite || !category.id) {
      return;
    }
    const wanted = !category.is_active;
    this.note = '';
    this.products.updateCategory({ ...category, is_active: wanted } as Category).subscribe({
      next: (saved) => {
        category.is_active = saved && typeof saved.is_active === 'boolean' ? saved.is_active : wanted;
        this.note = wanted ? 'ADMIN.CATEGORY_ON' : 'ADMIN.CATEGORY_OFF';
        this.load();
      },
      error: (error) => {
        const status = error && error.status;
        this.note = status === 401 || status === 403 ? 'ADMIN.NOT_ALLOWED' : 'ADMIN.TABLE_FAILED';
      },
    });
  }

  /** The parents this category may be filed under: not itself, and not one of its own sections. */
  get parentOptions(): { id: number; label: string; depth: number }[] {
    const banned = new Set<number>();
    if (this.editing && this.editing.id) {
      banned.add(this.editing.id);
      const collect = (id: number): void => {
        for (const row of this.all) {
          if (row.parent_id === id && row.id) {
            banned.add(row.id);
            collect(row.id);
          }
        }
      };
      collect(this.editing.id);
    }
    const byParent = new Map<number | null, Category[]>();
    for (const category of this.all) {
      const key = category.parent_id ?? null;
      const list = byParent.get(key) || [];
      list.push(category);
      byParent.set(key, list);
    }
    const options: { id: number; label: string; depth: number }[] = [];
    const walk = (parent: number | null, depth: number): void => {
      for (const category of byParent.get(parent) || []) {
        if (!category.id || banned.has(category.id)) {
          continue;
        }
        options.push({ id: category.id, label: category.title, depth });
        walk(category.id, depth + 1);
      }
    };
    walk(null, 0);
    return options;
  }

  /** What the current edit would hide, said before the switch is pressed. */
  get impact(): { products: number; categories: number } {
    if (!this.editing || this.isNew) {
      return { products: 0, categories: 0 };
    }
    return {
      products: this.productTotal(this.editing),
      categories: this.editing.descendant_count || 0,
    };
  }

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

  /** The file goes straight to Cloudinary; only the address is written, and only on save. */
  onImage(event: Event): void {
    this.ensureMediaConfig();
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || this.uploading || !this.mediaConfig || !this.mediaConfig.configured) {
      return;
    }
    const forCategory = this.editing && this.editing.id ? this.editing.id : 'new';
    this.uploadFor = forCategory;
    const generation = ++this.editGeneration;
    this.uploadAbort = new AbortController();
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadError = '';
    this.cloudinary.upload(file, this.mediaConfig, (percent) => { if (generation === this.editGeneration) this.uploadProgress = percent; }, this.uploadAbort.signal)
      .then((url) => {
        if (generation !== this.editGeneration) return;
        this.uploading = false;
        const current = this.editing && this.editing.id ? this.editing.id : 'new';
        if (current !== this.uploadFor) {
          // The owner moved to another category while it was going up: it must not land here.
          return;
        }
        this.image = {
          ...this.image,
          file_name: url.split('/').pop() || '',
          thumbnail_path: url,
          original_path: url,
          alternative_text: this.image.alternative_text || (this.editing?.title || ''),
        };
      })
      .catch(() => {
        if (generation !== this.editGeneration) return;
        this.uploading = false;
        this.uploadError = 'MISC.IMAGE_UPLOAD_FAILED';
      });
  }

  clearImage(): void {
    this.image = emptyImage();
  }

  save(): void {
    if (!this.editing || this.saving || this.uploading) {
      return;
    }
    this.fieldErrors = {};
    this.errorMessage = '';
    this.note = '';
    if (!(this.editing.title || '').trim()) {
      this.fieldErrors = { title: 'ADMIN.CATEGORY_TITLE_REQUIRED' };
      return;
    }
    this.saving = true;

    const payload: Category = {
      title: this.editing.title.trim(),
      title_en: (this.editing.title_en || '').trim() || null,
      is_active: this.editing.is_active,
      parent_id: this.editing.parent_id ?? null,
    };
    // Only send an image when there is one to write: omitting it leaves an existing one alone, which
    // is what "I did not touch the photograph" has to mean.
    if (this.image.file_name || this.image.thumbnail_path || this.image.original_path) {
      payload.image_asset = { ...this.image };
    }

    const request = this.isNew
      ? this.products.createCategory(payload)
      : this.products.updateCategory({ ...payload, id: this.editing.id } as Category);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.note = this.isNew ? 'ADMIN.CATEGORY_CREATED' : 'ADMIN.CATEGORY_SAVED';
        this.editing = null;
        this.isNew = false;
        this.image = emptyImage();
        this.load();
      },
      error: (error) => {
        this.saving = false;
        const status = error && error.status;
        if (status === 401 || status === 403) {
          this.errorMessage = 'ADMIN.NOT_ALLOWED';
          return;
        }
        const body = (error && error.error) || {};
        const details = body.details || body.validation_errors || {};
        if (details && typeof details === 'object') {
          for (const [field, value] of Object.entries(details)) {
            this.fieldErrors[field] = Array.isArray(value) ? String(value[0]) : String(value);
          }
        }
        this.errorMessage = body.error || 'ADMIN.TABLE_FAILED';
      },
    });
  }

  previewLink(category: Category): string {
    if (!category.id) {
      return '';
    }
    return `${(environment.siteUrl || '').replace(/\/$/, '')}/products?category=${category.id}`;
  }

  imageOf(category: Category): string {
    const url = category.image_asset?.thumbnail_path || '';
    return url.includes('res.cloudinary.com/') ? url.replace('/image/upload/', '/image/upload/c_limit,w_160,h_160,f_auto,q_auto/') : url;
  }
}
