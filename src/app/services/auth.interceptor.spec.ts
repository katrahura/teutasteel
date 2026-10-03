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

import { authInterceptor } from './auth.interceptor';
import { clearToken, setToken } from './token-storage';

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
});
