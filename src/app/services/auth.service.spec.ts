import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { provideTestConfig } from '../testing/test-providers';
import { clearToken, setToken } from './token-storage';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTestConfig()],
    });
    service = TestBed.inject(AuthService);
    clearToken();
  });

  afterEach(() => clearToken());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reports no session without a token', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('remembers a stored token', () => {
    service.storeToken('jwt-123');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('forgets the token on logout', () => {
    setToken('jwt-123');
    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
  });
});
