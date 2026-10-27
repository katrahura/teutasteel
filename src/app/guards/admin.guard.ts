import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';

import { AdminSessionService } from '../services/admin-session.service';

/**
 * Lets an administrator or an editor into the panel, and nobody else.
 *
 * Three outcomes, deliberately distinct: no token means "go and sign in, and come back here"; a token
 * the server refuses (401) means the same thing, because an expired session is not a permission
 * problem; a signed-in account with no capabilities means "signed in, not allowed", which is a
 * different page and a different sentence. Conflating them is how a panel ends up in a redirect loop.
 */
export const adminGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const session = inject(AdminSessionService);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const comeBack = router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (!token) {
    return of(comeBack);
  }

  return session.me().pipe(
    map((answer) =>
      answer && answer.can_enter_admin ? true : router.createUrlTree(['/admin', 'forbidden'])
    ),
    catchError((error) => {
      const status = error && error.status;
      if (status === 401 || status === 403) {
        session.forget();
        // 401 is "sign in again"; 403 on this endpoint should not happen, and signing in again is the
        // one thing that would fix it either way.
        return of(comeBack);
      }
      // The server is unreachable. Sending the owner to a login page would claim their session is bad
      // when the truth is that nothing answered; the shell shows an error instead.
      return of(true);
    })
  );
};
