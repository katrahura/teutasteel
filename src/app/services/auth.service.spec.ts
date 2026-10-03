import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { provideTestConfig } from '../testing/test-providers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTestConfig()],
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
