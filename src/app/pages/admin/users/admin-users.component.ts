import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AdminService, AdminUser } from '../../../services/admin.service';

/**
 * The people who can sign in.
 *
 * Administrator only, and the API is the one that decides: this page offers the same form to an editor
 * and the answer comes back as "only an administrator". A hidden button would be a lie about which of
 * the two is in charge.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.css'],
})
export class AdminUsersComponent implements OnInit {
  private admin = inject(AdminService);

  users: AdminUser[] = [];
  loading = true;
  denied = false;
  failed = false;

  draft = { username: '', email: '', password: '', role: 'editor' };
  saving = false;
  saved: string | null = null;
  errorMessage = '';
  fieldErrors: { [field: string]: string } = {};

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.admin.getUsers().subscribe({
      next: (body) => {
        this.users = body.users || [];
        this.loading = false;
      },
      error: (error) => {
        this.users = [];
        this.loading = false;
        const status = error && error.status;
        this.denied = status === 401 || status === 403;
        this.failed = !this.denied;
      },
    });
  }

  create(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.fieldErrors = {};
    this.saved = null;
    this.admin.createUser({ ...this.draft }).subscribe({
      next: (user) => {
        this.saving = false;
        this.saved = user.username;
        this.draft = { username: '', email: '', password: '', role: 'editor' };
        this.load();
      },
      error: (error) => {
        this.saving = false;
        const status = error && error.status;
        if (status === 401 || status === 403) {
          this.denied = true;
          return;
        }
        const body = (error && error.error) || {};
        this.errorMessage = body.error || 'ADMIN.TABLE_FAILED';
        this.fieldErrors = body.details && typeof body.details === 'object' ? body.details : {};
      },
    });
  }

  /** The message beside a field, if the API blamed it. */
  errorFor(field: string): string {
    return this.fieldErrors[field] || '';
  }
}
