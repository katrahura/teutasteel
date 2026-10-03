import { HttpInterceptorFn } from '@angular/common/http';
import { getToken } from './token-storage';

/**
 * Attaches the JWT to outgoing API calls.
 *
 * This is a functional interceptor, registered through
 * `provideHttpClient(withInterceptors([authInterceptor]))` in app.config.ts.
 * The previous class-based version did nothing at all: it was bound to the
 * legacy HTTP_INTERCEPTORS token, which `provideHttpClient()` does not honour
 * unless `withInterceptorsFromDi()` is also used.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getToken();
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
