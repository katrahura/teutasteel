import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AdminService, GapProduct, MediaConfig } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
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
export class AdminMediaComponent implements OnInit {
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
    this.chosen = row;
    this.uploadedUrl = '';
    this.altText = '';
    this.progress = 0;
    this.savedCode = null;
    this.errorMessage = '';
  }

  /** Upload with XHR rather than fetch: only XHR reports how far along an upload is. */
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file || !this.config || !this.config.configured) {
      return;
    }
    this.uploading = true;
    this.progress = 0;
    this.errorMessage = '';
    this.uploadedUrl = '';

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', this.config.upload_preset);
    if (this.config.folder) {
      form.append('folder', this.config.folder);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${this.config.cloud_name}/image/upload`);
    xhr.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        this.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      }
    };
    xhr.onload = () => {
      this.uploading = false;
      this.progress = 100;
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
          this.uploadedUrl = body.secure_url;
          if (!this.altText) {
            this.altText = (this.chosen && this.chosen.code) || '';
          }
        } else {
          this.errorMessage = (body && body.error && body.error.message) || 'ADMIN.MEDIA_FAILED';
        }
      } catch {
        this.errorMessage = 'ADMIN.MEDIA_FAILED';
      }
    };
    xhr.onerror = () => {
      this.uploading = false;
      this.errorMessage = 'ADMIN.MEDIA_FAILED';
    };
    xhr.send(form);
  }

  /** Write the address that came back onto the product, and nothing else about it. */
  save(): void {
    if (!this.chosen || !this.uploadedUrl || this.saving) {
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
    this.products.updateProduct({ id: this.chosen.id, image_asset: asset } as unknown as Product)
      .subscribe({
        next: () => {
          this.saving = false;
          this.savedCode = this.chosen ? this.chosen.code : null;
          this.chosen = null;
          this.uploadedUrl = '';
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