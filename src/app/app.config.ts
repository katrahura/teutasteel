import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  HttpClient,
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideClientHydration } from '@angular/platform-browser';

import { appRoutes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';

// AOT (Ahead of Time) compilation support for HttpLoaderFactory
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

/**
 * The single provider list for the application: used by the browser bootstrap
 * (main.ts) and merged with the server providers by app.config.server.ts, so
 * client and server can no longer drift apart.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    // Reuse the prerendered HTML instead of discarding it and re-rendering.
    // Verified against the production build: no hydration mismatch on /,
    // /products or /about, the language switcher and client-side routing keep
    // working, and the browser-only category fetch simply adds those sections
    // after hydration (the language is applied client-side, which hydration
    // tolerates because text bindings are updated, not re-created).
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    importProvidersFrom(
      BrowserAnimationsModule,
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
      })
    ),
  ],
};
