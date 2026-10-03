import {
  mergeApplicationConfig,
  ApplicationConfig,
  importProvidersFrom,
} from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from './app.config';

/**
 * ngx-translate's HTTP loader cannot resolve `./assets/i18n/*.json` while
 * prerendering, so every server-rendered page came out with empty navigation
 * and headings. Read the translation files from disk instead.
 */
class ServerTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<object> {
    const candidates = [
      join(process.cwd(), 'src', 'assets', 'i18n', `${lang}.json`),
      join(process.cwd(), 'browser', 'assets', 'i18n', `${lang}.json`),
      join(
        process.cwd(),
        'dist',
        'teutasteel-website',
        'browser',
        'assets',
        'i18n',
        `${lang}.json`
      ),
    ];

    for (const file of candidates) {
      if (existsSync(file)) {
        return of(JSON.parse(readFileSync(file, 'utf-8')) as object);
      }
    }

    console.warn(`[ssr] no translation file found for "${lang}"`);
    return of({});
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useClass: ServerTranslateLoader,
        },
      })
    ),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
