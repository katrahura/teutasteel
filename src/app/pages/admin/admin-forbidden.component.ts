import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/** Signed in, and not allowed here - which is not the same as being signed out. */
@Component({
  selector: 'app-admin-forbidden',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  template: `
    <section class="forbidden">
      <h1>{{ 'ADMIN.FORBIDDEN_TITLE' | translate }}</h1>
      <p>{{ 'ADMIN.FORBIDDEN_BODY' | translate }}</p>
      <p class="links">
        <a routerLink="/">{{ 'ADMIN.FORBIDDEN_HOME' | translate }}</a>
        <a routerLink="/login">{{ 'ADMIN.FORBIDDEN_LOGIN' | translate }}</a>
      </p>
    </section>
  `,
  styles: [
    `
      .forbidden { max-width: 560px; margin: 60px auto; padding: 0 16px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { color: #475569; font-size: 14.5px; }
      .links { display: flex; gap: 18px; margin-top: 18px; }
      a { color: #0a58ca; font-weight: 600; }
    `,
  ],
})
export class AdminForbiddenComponent {}
