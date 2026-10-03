import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { clearToken, getToken } from './token-storage';

/**
 * Attaches the JWT to outgoing API calls, and signs the user out when the API says it is
 * no longer good.
 *
 * This is a functional interceptor, registered through
 * `provideHttpClient(withInterceptors([authInterceptor]))` in app.config.ts. The previous
 * class-based version did nothing at all: it was bound to the legacy HTTP_INTERCEPTORS
 * token, which `provideHttpClient()` does not honour unless `withInterceptorsFromDi()` is
 * also used.
 *
 * A 401 means the token is expired, revoked or otherwise unusable. The app used to keep
 * believing it was signed in, so the editing controls stayed on screen and every save
 * failed with "try again" — which retrying never fixed. It now clears the token and sends
 * the user to the login page, where the message says why.
 *
 * A 403 is deliberately left alone: that means "signed in, not allowed", which is a
 * different thing, and a member reaching an admin-only route should not be signed out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getToken();
  if (!token) {
    return next(req);
  }

  const router = inject(Router);
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  ).pipe(
    catchError((error: unknown) => {
      const response = error as HttpErrorResponse;
      // Only when a token was actually sent: a failed login is a 401 as well, and there is
      // nothing to sign out of or redirect away from in that case.
      if (response?.status === 401) {
        clearToken();
        void router.navigate(['/login'], { queryParams: { expired: '1' } });
      }
      return throwError(() => error);
    })
  );
};
