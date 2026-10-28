import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AdminService, GapProduct, MediaConfig } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { CloudinaryService } from '../../../services/cloudinary.service';
import { confirmUnsaved } from '../../../shared/unsaved-work';
import { Product } from '../../../models/product.model';

/**
 * Photographs, for the products that have none.
 *
 * The file goes from this browser straight to Cloudinary with an unsigned preset, and only the address
 * that comes back is written to the product: the photograph never passes through the shop's server.
 *
 * Three hundred and ninety-six products carry a price and no picture. This page lists them and lets one
 * be photographed without opening the editor.
 */
@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './admin-media.component.html',
  styleUrls: ['./admin-media.component.css'],
})
export class AdminMediaComponent implements OnInit, OnDestroy {
  private cloudinary = inject(CloudinaryService);
  private uploadAbort?: AbortController;
  private generation = 0;
  canLeave(): boolean { return !this.saving && confirmUnsaved(this.uploading || !!this.uploadedUrl); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.uploading || this.uploadedUrl) { event.preventDefault(); event.returnValue = ''; } }
  cancelUpload(): void { this.generation++; this.uploadAbort?.abort(); this.uploading = false; this.progress = 0; }
  close(): void { if (!this.canLeave()) return; this.cancelUpload(); this.chosen = null; this.uploadedUrl = ''; }
  ngOnDestroy(): void { this.cancelUpload(); }
  private admin = inject(AdminService);
  private products = inject(ProductService);

  config: MediaConfig | null = null;
  rows: GapProduct[] = [];
  loading = true;
  denied = false;
  failed = false;

  page = 1;
  pages = 1;
  total = 0;

  chosen: GapProduct | null = null;
  uploading = false;
  progress = 0;
  uploadedUrl = '';
  /** The product the running/finished upload belongs to: an upload must never land on another one. */
  private uploadedFor: number | null = null;
  altText = '';
  saving = false;
  savedCode: string | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.admin.getMediaConfig().subscribe({
      next: (config) => { this.config = config; },
      error: () => { this.config = null; },
    });
    this.load(1);
  }

  load(page: number): void {
    this.loading = true;
    this.failed = false;
    this.admin.getGapProducts('no_photo', page, 20).subscribe({
      next: (body) => {
        this.rows = body.products || [];
        this.page = body.page || page;
        this.pages = Math.max(body.pages || 1, 1);
        this.total = body.total || 0;
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

  pick(row: GapProduct): void {
    if (!this.canLeave()) return;
    this.cancelUpload();
    this.chosen = row;
    this.uploadedUrl = '';
    this.uploadedFor = null;
    this.altText = '';
    this.progress = 0;
    this.savedCode = null;
    this.errorMessage = '';
  }

  /** Upload with XHR rather than fetch: only XHR reports how far along an upload is. */
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || !this.config || !this.config.configured || !this.chosen) {
      return;
    }
    const forProduct = this.chosen.id;
    this.uploadedFor = forProduct;
    this.uploading = true;
    this.progress = 0;
    this.errorMessage = '';
    this.uploadedUrl = '';

    const generation = ++this.generation;
    this.uploadAbort = new AbortController();
    this.cloudinary.upload(file, this.config, percent => {
      if (generation === this.generation) this.progress = percent;
    }, this.uploadAbort.signal).then(url => {
      if (generation !== this.generation || this.chosen?.id !== forProduct) return;
      this.uploading = false;
      this.progress = 100;
      this.uploadedUrl = url;
      this.altText ||= this.chosen.code || '';
    }).catch(() => {
      if (generation !== this.generation) return;
      this.uploading = false;
      this.errorMessage = 'ADMIN.MEDIA_FAILED';
    });
  }

  /** Write the address that came back onto the product it was uploaded for, and nothing else. */
  save(): void {
    if (!this.chosen || !this.uploadedUrl || this.saving) {
      return;
    }
    if (this.uploadedFor !== this.chosen.id) {
      this.errorMessage = 'ADMIN.MEDIA_WRONG_PRODUCT';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    const asset = {
      file_name: this.uploadedUrl.split('/').pop() || '',
      alternative_text: this.altText || (this.chosen.code || ''),
      thumbnail_path: this.uploadedUrl,
      original_path: this.uploadedUrl,
    };
    // The version is not sent: this writes the image and nothing else, so it cannot overwrite an
    // edit made elsewhere while the file was going up.
    this.products.updateProduct({ id: this.chosen.id, image_asset: asset } as unknown as Product)
      .subscribe({
        next: () => {
          this.saving = false;
          this.savedCode = this.chosen ? this.chosen.code : null;
          this.chosen = null;
          this.uploadedUrl = '';
          this.uploadedFor = null;
          this.load(this.page);
        },
        error: (error) => {
          this.saving = false;
          const status = error && error.status;
          this.errorMessage = status === 401 || status === 403
            ? 'ADMIN.NOT_ALLOWED'
            : 'ADMIN.TABLE_FAILED';
        },
      });
  }
}