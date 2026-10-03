import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { clearToken, getToken, setToken } from './token-storage';

/**
 * Regression tests for the bug where the interceptor was registered on the
 * legacy HTTP_INTERCEPTORS token and therefore never ran, so authenticated
 * calls went out without a bearer token.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        // the interceptor navigates to the login page when a token turns out to be dead
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    clearToken();
  });

  afterEach(() => {
    httpMock.verify();
    clearToken();
  });

  it('sends no Authorization header when no token is stored', () => {
    http.get('/api/thing').subscribe();
    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('attaches the stored token as a bearer header', () => {
    setToken('jwt-123');
    http.get('/api/thing').subscribe();
    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
  });

  it('signs the user out when the API says the token is no good', () => {
    // Regression: an expired token left the app believing it was signed in, so the editing
    // controls stayed on screen and every save failed with "try again" - which never fixed
    // anything. A 401 has to mean signed out.
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');
    setToken('expired-jwt');

    http.get('/api/thing').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/thing').flush('nope', { status: 401, statusText: 'Unauthorized' });

    expect(getToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: '1' } });
  });

  it('does not redirect on a 403, which only means "not allowed"', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');
    setToken('jwt-123');

    http.get('/api/admin-thing').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/admin-thing').flush('no', { status: 403, statusText: 'Forbidden' });

    expect(getToken()).toBe('jwt-123');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when a failed login answers 401', () => {
    // there is no token, so nothing is signed out and the login page is already showing
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');

    http.post('/auth/login', {}).subscribe({ error: () => undefined });
    httpMock.expectOne('/auth/login').flush('bad', { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
