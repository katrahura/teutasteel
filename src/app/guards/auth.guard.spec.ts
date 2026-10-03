import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { clearToken, setToken } from '../services/token-storage';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: { navigate: jasmine.Spy };

  beforeEach(() => {
    router = { navigate: jasmine.createSpy('navigate') };
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        provideHttpClient(),
        { provide: Router, useValue: router },
      ],
    });
    guard = TestBed.inject(AuthGuard);
    clearToken();
  });

  afterEach(() => clearToken());

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('sends an anonymous visitor to the login page', () => {
    // Regression: the guard used to navigate to '/home', which does not exist.
    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('lets a visitor with a token through', () => {
    setToken('jwt-123');
    expect(guard.canActivate()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
