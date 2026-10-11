import { QuoteListService } from '../../shared/quote-list.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactComponent } from './contact.component';
import { provideTestConfig } from '../../testing/test-providers';

describe('ContactComponent', () => {
  let component: ContactComponent;
  let fixture: ComponentFixture<ContactComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
      providers: [provideTestConfig()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calculates the EUR subtotal from structured prices rather than display text', () => {
    const list=TestBed.inject(QuoteListService);list.clear();
    list.setQuantity({productId:1,variantKey:'id:1',code:'A',detail:'arbitrary text 999 EUR',unitPrice:4,currency:'EUR',quantity:1},3);
    list.setQuantity({productId:2,variantKey:'id:2',code:'B',detail:'5 EUR',unitPrice:5,currency:'USD',quantity:1},2);
    const local=TestBed.createComponent(ContactComponent);local.detectChanges();
    expect(local.componentInstance.pricedTotal).toBe(12);
    expect(local.componentInstance.unpricedItems.length).toBe(1);
    list.clear();local.destroy();
  });

});
