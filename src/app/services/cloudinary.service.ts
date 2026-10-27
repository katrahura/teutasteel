import { Injectable } from '@angular/core';

import { MediaConfig } from './admin.service';

/**
 * Sends one photograph to Cloudinary and returns the address it can be read from.
 *
 * XHR rather than fetch, because fetch cannot report how far along an upload is, and a 4 MB photograph
 * on a phone connection with no progress looks like nothing happening at all.
 *
 * The file goes from this browser straight to Cloudinary: the shop's server never holds it.
 */
@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  upload(file: File, config: MediaConfig, onProgress?: (percent: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!config || !config.configured) {
        reject(new Error('not_configured'));
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', config.upload_preset);
      if (config.folder) {
        form.append('folder', config.folder);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloud_name}/image/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
            resolve(body.secure_url);
            return;
          }
          reject(new Error((body && body.error && body.error.message) || 'upload_failed'));
        } catch {
          reject(new Error('upload_failed'));
        }
      };
      xhr.onerror = () => reject(new Error('upload_failed'));
      xhr.send(form);
    });
  }
}