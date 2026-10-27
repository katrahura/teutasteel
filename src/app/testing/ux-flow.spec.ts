import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ProductsComponent } from '../pages/products/products.component';
import { ContactComponent } from '../pages/contact/contact.component';
import { QuoteListService } from '../shared/quote-list.service';
import { provideTestConfig } from './test-providers';

describe('Customer enquiry flow', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductsComponent, ContactComponent], providers: [provideTestConfig()] }).compileComponents();
    localStorage.removeItem('quote-list');
    localStorage.removeItem('teutasteel-enquiry-draft-v1');
  });
  afterEach(() => TestBed.inject(QuoteListService).clear());

  it('does not let a dialog selection select a variant on another card', () => {
    const c=TestBed.createComponent(ProductsComponent).componentInstance;
    const a={ id:1, code:'15x15', dimensions:[{thickness:1.3,price:4.2},{thickness:1.5,price:4.8}] } as any;
    const b={ id:2, code:'20x20', dimensions:[{thickness:0.9,price:4.5},{thickness:2,price:7}] } as any;
    c.selectedProduct=a;c.chosenDimensions={0:true};
    expect(decodeURIComponent(c.getWhatsAppLink(a,true))).toContain('1.3 mm');
    expect(decodeURIComponent(c.getWhatsAppLink(b))).not.toContain('0.9 mm');
    expect(decodeURIComponent(c.getWhatsAppLink(b,true))).not.toContain('0.9 mm');
    expect(decodeURIComponent(c.getWhatsAppLink(a))).not.toContain('1.3 mm');
  });

  it('uses the lowest positive variant price regardless of API order', () => {
    const c=TestBed.createComponent(ProductsComponent).componentInstance;
    expect(c.lowestPrice({dimensions:[{price:'4.80'},{price:0},{price:'4.20'}]} as any)).toBe(4.2);
    expect(c.lowestPrice({dimensions:[]} as any)).toBe(0);
  });

  it('shows the request summary before the customer details', () => {
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{data:{requestPage:true}},queryParamMap:new BehaviorSubject(convertToParamMap({}))}});
    const list=TestBed.inject(QuoteListService);
    list.setQuantity({productId:1,variantKey:'id:1',code:'IPE-100',detail:'100 × 55 mm',unitPrice:54,currency:'EUR',quantity:1},2);
    const f=TestBed.createComponent(ContactComponent);f.detectChanges();
    const html=f.nativeElement.innerHTML;
    expect(html.indexOf('request-review')).toBeLessThan(html.indexOf('id="quoteName"'));
    expect(f.componentInstance.pricedTotal).toBe(108);
    expect(f.nativeElement.querySelector('.map-responsive')).toBeNull();
    f.destroy();
  });

  it('uses a drawing checkbox and includes the attachment reminder in the draft', () => {
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{data:{requestPage:true}},queryParamMap:new BehaviorSubject(convertToParamMap({service:'cnc'}))}});
    const f=TestBed.createComponent(ContactComponent);f.detectChanges();
    const input=f.nativeElement.querySelector('#quoteDrawing');
    expect(input.type).toBe('checkbox');
    f.componentInstance.hasDrawing=true;
    expect(decodeURIComponent(f.componentInstance.getQuoteLink())).toContain('QUOTE.DRAWING_MESSAGE');
    f.destroy();
  });

  it('clears the selected service when navigating to a general request', () => {
    const params=new BehaviorSubject(convertToParamMap({service:'cnc'}));
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{data:{requestPage:true}},queryParamMap:params}});
    const f=TestBed.createComponent(ContactComponent);f.detectChanges();
    expect(f.componentInstance.selectedService?.id).toBe('cnc');
    params.next(convertToParamMap({}));
    expect(f.componentInstance.selectedService).toBeNull();f.destroy();
  });

  it('keeps the general contact page separate and opens WhatsApp instead of the dialler', () => {
    const f=TestBed.createComponent(ContactComponent);f.detectChanges();
    expect(f.nativeElement.querySelector('#quoteName')).toBeNull();
    expect(f.nativeElement.querySelector('a[href="https://wa.me/38344776650"]')).toBeTruthy();
    f.destroy();
  });
});
