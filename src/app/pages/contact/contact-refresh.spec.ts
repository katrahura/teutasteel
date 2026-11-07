import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ContactComponent } from './contact.component';
import { ProductService } from '../../services/product.service';
import { QuoteListService } from '../../shared/quote-list.service';
import { provideTestConfig } from '../../testing/test-providers';
import { TranslateService } from '@ngx-translate/core';

describe('enquiry price verification',()=>{
 let response: Subject<any>;
 let list: QuoteListService;
 beforeEach(async()=>{
  response=new Subject();
  await TestBed.configureTestingModule({imports:[ContactComponent],providers:[provideTestConfig(),
    {provide:ActivatedRoute,useValue:{snapshot:{data:{requestPage:true}},queryParamMap:of(convertToParamMap({}))}},
    {provide:ProductService,useValue:{getPublicProductById:()=>response}}]}).compileComponents();
  list=TestBed.inject(QuoteListService);list.clear();
  list.setQuantity({productId:4191,dimensionId:4412,variantKey:'id:4412',code:'Multival',detail:'old text',quantity:2,priceUnit:null,unitPrice:7,currency:'EUR'},2);
 });
 afterEach(()=>list.clear());
 it('requires acknowledgement after a changed price and exports complete current dimensions',()=>{
  const fixture=TestBed.createComponent(ContactComponent);fixture.detectChanges();const c=fixture.componentInstance;
  c.quote.name='Test';c.quote.phone='044 133 208';expect(c.reviewing).toBeTrue();expect(c.isQuoteValid()).toBeFalse();
  response.next({id:4191,code:'Multival',category_id:113,dimensions:[{id:4412,width:2100,length:6000,thickness:4,price:88.2,currency:'EUR',price_unit:'piece'}]});response.complete();fixture.detectChanges();
  expect(c.needsReview).toBeTrue();expect(c.pricedTotal).toBe(176.4);expect(c.isQuoteValid()).toBeFalse();
  c.acknowledgeReview();expect(c.isQuoteValid()).toBeTrue();
  const message=decodeURIComponent(c.getQuoteLink());expect(message).toContain('6000 × 2100 mm');expect(message).toContain('88.20');expect(message).toContain('product=4191');
  TestBed.inject(TranslateService).use('en');expect(c.itemDetail(c.requested[0])).not.toContain('Trashësia');fixture.destroy();
 });
 it('blocks sending after a network failure and preserves the requested quantity',()=>{
  const fixture=TestBed.createComponent(ContactComponent);fixture.detectChanges();const c=fixture.componentInstance;c.quote.name='Test';c.quote.phone='044';response.error({status:503});fixture.detectChanges();
  expect(c.reviewFailed).toBeTrue();expect(c.isQuoteValid()).toBeFalse();expect(c.requested[0].quantity).toBe(2);fixture.destroy();
 });
 it('blocks a removed variant until its line is removed',()=>{
  const fixture=TestBed.createComponent(ContactComponent);fixture.detectChanges();const c=fixture.componentInstance;c.quote.name='Test';c.quote.phone='044';response.next({id:4191,code:'Multival',dimensions:[{id:99,thickness:6}]});response.complete();fixture.detectChanges();
  expect(c.unavailable).toBeTrue();expect(c.isQuoteValid()).toBeFalse();c.removeRequested(c.requested[0]);expect(c.isQuoteValid()).toBeTrue();fixture.destroy();
 });
});
