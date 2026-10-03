import { TestBed } from '@angular/core/testing';

import { ProductService } from './product.service';
import { provideTestConfig } from '../testing/test-providers';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTestConfig()],
    });
    service = TestBed.inject(ProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
