import { reviewLine } from './enquiry-line';
import { Product } from '../models/product.model';
import { QuoteItem } from './quote-list.service';
const product = (dimensions: any[]): Product => ({id:4191,code:'Multival',category_id:113,cut_type:0,new_product:false,is_active:true,translations:[],dimensions});
const item = (): QuoteItem => ({productId:4191,dimensionId:4412,variantKey:'id:4412',code:'Multival',detail:'old Albanian text',quantity:2,unitPrice:7,priceUnit:null,currency:'Eur',dimensions:{width:2100,length:6000,thickness:4}});
describe('enquiry catalogue review',()=>{
 it('does not reinterpret an old shared-pattern row as one specific mesh',()=>{
  const old={...item(),code:'R1-R2-R3'};
  expect(reviewLine(old,{...product([{id:4412,price:30}]),code:'R1'}).reviewStatus).toBe('unavailable');
 });
 it('refreshes a stale square-metre price and preserves the chosen thickness and quantity',()=>{
  const next=reviewLine(item(),product([{id:4412,width:2100,length:6000,thickness:4,price:'88.20',price_unit:'piece',currency:'Eur'}]));
  expect(next.unitPrice).toBe(88.2);expect(next.priceUnit).toBe('piece');expect(next.quantity).toBe(2);expect(next.reviewStatus).toBe('changed');expect(next.productUrl).toContain('product=4191');expect(next.measurementUnit).toBe('mm');
 });
 it('never substitutes another thickness when a known variant disappears',()=>{
  expect(reviewLine(item(),product([{id:4413,thickness:6,price:113.4}])).reviewStatus).toBe('unavailable');
 });
 it('refuses to guess between ambiguous legacy variants',()=>{
  const old={...item(),dimensionId:undefined,variantKey:undefined,dimensions:undefined};
  expect(reviewLine(old,product([{id:1,price:7},{id:2,price:8}])).reviewStatus).toBe('unavailable');
 });
 it('keeps an unknown selling unit unknown and flags the change',()=>{
  const old={...item(),priceUnit:'piece'};
  const next=reviewLine(old,product([{id:4412,price:7,currency:'Eur'}]));expect(next.priceUnit).toBeNull();expect(next.reviewStatus).toBe('changed');
 });
 it('does not ask for another review when the current information is unchanged',()=>{
  const p=product([{id:4412,price:88.2,price_unit:'piece',currency:'Eur',width:2100,length:6000,thickness:4}]);
  const next=reviewLine(reviewLine(item(),p),p);expect(next.reviewStatus).toBeUndefined();
 });
});
