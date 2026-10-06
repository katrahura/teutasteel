import { EnvironmentProviders, importProvidersFrom, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of } from 'rxjs';

/** Returns an empty translation table so the translate pipe renders keys. */
class EmptyTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, never>> {
    return of({});
  }
}

/**
 * Shared providers for the TestBed specs.
 *
 * The generated stubs had none, so the whole suite failed with
 * "No provider for TranslateService!" / "No provider for HttpClient!".
 */
export function provideTestConfig(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
    // Without this the @routeAnimations / @fadeInOut bindings throw NG05105.
    provideNoopAnimations(),
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: {
          paramMap: convertToParamMap({}),
          queryParamMap: convertToParamMap({}),
        },
        params: of({}),
        queryParams: of({}),
        // The products page subscribes to queryParamMap to pick up a search term handed over as
        // ?q=. The stub had the snapshot's version but not the observable, so the subscription hit
        // undefined and thirteen specs failed.
        queryParamMap: of(convertToParamMap({})),
      },
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useClass: EmptyTranslateLoader },
      })
    ),
  ];
}
