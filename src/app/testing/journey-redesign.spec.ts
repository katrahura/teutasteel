import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AppComponent } from '../app.component';
import { HomeComponent } from '../pages/home/home.component';
import { ProductsComponent } from '../pages/products/products.component';
import { ContactComponent } from '../pages/contact/contact.component';
import { ServiceDetailComponent } from '../pages/services/service-detail.component';
import { SERVICES } from '../shared/services';
import { QuoteListService } from '../shared/quote-list.service';
import { ProductService } from '../services/product.service';
import { provideTestConfig } from './test-providers';

describe('Redesigned customer journey', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports:[AppComponent,HomeComponent,ProductsComponent,ContactComponent,ServiceDetailComponent],
      providers:[provideTestConfig()]
    }).compileComponents();
    localStorage.removeItem('quote-list');
    localStorage.removeItem('teutasteel-enquiry-draft-v1');
  });
  afterEach(() => TestBed.inject(QuoteListService).clear());

  it('restores the enquiry shortcut from saved exact variants and removes it on the request page', () => {
    localStorage.setItem('quote-list',JSON.stringify([
      {productId:7,variantKey:'id:21',code:'40x40',detail:'1.5 mm',quantity:2},
      {productId:7,variantKey:'id:22',code:'40x40',detail:'2 mm',quantity:3}
    ]));
    const fixture=TestBed.createComponent(AppComponent);fixture.detectChanges();
    expect(fixture.componentInstance.quoteCount).toBe(5);
    expect(fixture.nativeElement.querySelector('.mobile-enquiry').getAttribute('href')).toBe('/request');
    TestBed.inject(QuoteListService).setQuantity(TestBed.inject(QuoteListService).items()[0],4);
    fixture.detectChanges();expect(fixture.componentInstance.quoteCount).toBe(7);
    fixture.componentInstance.currentRoute='/request?service=cnc';fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mobile-enquiry')).toBeNull();fixture.destroy();
  });

  it('renders the right quote destination for every service and handles an unknown service', () => {
    const params=new BehaviorSubject(convertToParamMap({id:'cnc'}));
    TestBed.overrideProvider(ActivatedRoute,{useValue:{paramMap:params,snapshot:{params:{},queryParams:{},data:{}}}});
    const fixture=TestBed.createComponent(ServiceDetailComponent);
    for(const service of SERVICES) {
      params.next(convertToParamMap({id:service.id}));fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain(service.titleKey);
      expect(fixture.nativeElement.querySelector('.primary-action').getAttribute('href')).toBe('/request?service='+service.id);
    }
    params.next(convertToParamMap({id:'unknown'}));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.primary-action')).toBeNull();fixture.destroy();
  });

  it('keeps the edit dialog in the page and leaves the refusal to the API', () => {
    const fixture=TestBed.createComponent(ProductsComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    component.isLoggedIn=false;component.showingGroups=false;
    component.selectedCategory={id:123,title:'Square tubes',is_active:true};
    component.selectedProduct={id:4286,code:'15x15',dimensions:[],translations:[],is_active:true,new_product:false,cut_type:0};
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#editProductModal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-product-editor')).not.toBeNull();fixture.destroy();
  });
  it('allows homepage catalogue recovery after an error', () => {
    const api=TestBed.inject(ProductService);
    spyOn(api,'getCategoryTree').and.returnValues(throwError(()=>new Error('offline')),of([]));
    const fixture=TestBed.createComponent(HomeComponent);const component=fixture.componentInstance;
    component.loadGroups();expect(component.groupsLoading).toBeFalse();expect(component.groupsError).toBeTrue();
    component.loadGroups();expect(component.groupsError).toBeFalse();expect(component.catalogueLoaded).toBeTrue();fixture.destroy();
  });

  it('stops a failed category loader and permits retry without a late category overwriting search', () => {
    const api=TestBed.inject(ProductService);const pending=new Subject<any>();
    spyOn(api,'getCategoryById').and.returnValues(throwError(()=>new Error('offline')),pending);
    const fixture=TestBed.createComponent(ProductsComponent);const component=fixture.componentInstance;
    component.selectedCategory={id:122,title:'Round tubes',is_active:true};
    component.loadCategoryWithProducts(122);expect(component.isLoading).toBeFalse();expect(component.categoryError).toBeTrue();
    component.retryCategory();expect(component.isLoading).toBeTrue();
    component.goBackToGroups();pending.next({products:[{code:'STALE'}],pagination:{page:1,total_pages:1,total_items:1}});
    expect(component.showingGroups).toBeTrue();expect(component.products).toEqual([]);fixture.destroy();
  });

  it('uses the currency of the priced variant and never infers price units from a shape', () => {
    const fixture=TestBed.createComponent(ProductsComponent);const component=fixture.componentInstance;
    const product={dimensions:[{price:20,currency:'EUR'},{price:10,currency:'GBP'}]} as any;
    expect(component.lowestPriceCurrency(product)).toBe('GBP');
    component.selectedCategory={title:'Flat bars',is_active:true};expect(component.priceUnit(product)).toBe('');
    expect(component.priceUnit({...product,price_unit:'kg'})).toBe('kg');fixture.destroy();
  });

  it('carries an unsuccessful search into a quote without overwriting customer-entered text', () => {
    const params=new BehaviorSubject(convertToParamMap({product:'40x40 special'}));
    TestBed.overrideProvider(ActivatedRoute,{useValue:{snapshot:{data:{requestPage:true}},queryParamMap:params}});
    const fixture=TestBed.createComponent(ContactComponent);fixture.detectChanges();
    expect(fixture.componentInstance.quote.product).toBe('40x40 special');
    fixture.componentInstance.quote.product='My own drawing';params.next(convertToParamMap({product:'different'}));
    expect(fixture.componentInstance.quote.product).toBe('My own drawing');fixture.destroy();
  });
});
