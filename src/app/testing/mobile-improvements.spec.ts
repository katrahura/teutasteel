import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ContactComponent } from '../pages/contact/contact.component';
import { ProductsComponent } from '../pages/products/products.component';
import { ProductService } from '../services/product.service';
import { QuoteListService } from '../shared/quote-list.service';
import { provideTestConfig } from './test-providers';

describe('Mobile customer improvements', () => {
  beforeEach(async () => {
    localStorage.removeItem('teutasteel-enquiry-draft-v1');
    localStorage.removeItem('quote-list');
    await TestBed.configureTestingModule({imports:[ContactComponent,ProductsComponent], providers:[provideTestConfig()]}).compileComponents();
  });
  afterEach(() => { localStorage.removeItem('teutasteel-enquiry-draft-v1'); TestBed.inject(QuoteListService).clear(); });
  it('restores all form details and service after recreation, then clears details without removing products', () => {
    const params = new BehaviorSubject(convertToParamMap({service:'cnc'}));
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{data:{requestPage:true}},queryParamMap:params}});
    const list = TestBed.inject(QuoteListService);
    list.setQuantity({productId:7,variantKey:'id:21',code:'40x40',detail:'1.5 mm',quantity:2},2);
    const first=TestBed.createComponent(ContactComponent); first.detectChanges();
    first.componentInstance.quote.name='Draft customer'; first.componentInstance.quote.notes='Cut to size';
    first.componentInstance.quote.deliveryPlace='Gjilan'; first.componentInstance.hasDrawing=true;
    first.componentInstance.saveDraft(); first.destroy();
    params.next(convertToParamMap({}));
    const restored=TestBed.createComponent(ContactComponent); restored.detectChanges();
    expect(restored.componentInstance.quote.name).toBe('Draft customer');
    expect(restored.componentInstance.quote.notes).toBe('Cut to size');
    expect(restored.componentInstance.quote.deliveryPlace).toBe('Gjilan');
    expect(restored.componentInstance.hasDrawing).toBeTrue();
    expect(restored.componentInstance.selectedService?.id).toBe('cnc');
    restored.componentInstance.clearDraft();
    expect(restored.componentInstance.quote.name).toBe('');
    expect(restored.componentInstance.selectedService?.id).toBe('cnc');
    expect(list.count()).toBe(2); restored.destroy();
  });
  it('loads an exact public product without needing a category or the first results page', () => {
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{queryParamMap:convertToParamMap({product:'4316'}),data:{}},queryParamMap:of(convertToParamMap({product:'4316'})),params:of({}),queryParams:of({})}});
    const api=TestBed.inject(ProductService);
    const product={id:4316,code:'40x40',dimensions:[{thickness:1.5}],translations:[],category_id:3} as any;
    spyOn(api,'getPublicProductById').and.returnValue(of(product));
    const fixture=TestBed.createComponent(ProductsComponent);
    spyOn(fixture.componentInstance,'openModal'); fixture.detectChanges();
    expect(api.getPublicProductById).toHaveBeenCalledWith(4316,jasmine.any(String));
    expect(fixture.componentInstance.openModal).toHaveBeenCalledWith(product,jasmine.any(Event));
    fixture.destroy();
  });
});
