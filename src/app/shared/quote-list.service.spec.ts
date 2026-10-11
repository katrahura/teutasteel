import { TestBed } from '@angular/core/testing';
import { QuoteListService } from './quote-list.service';

describe('QuoteListService', () => {
  let service: QuoteListService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuoteListService);
    service.clear();
  });

  afterEach(() => service.clear());

  it('adds an item and counts it', () => {
    service.add({ productId: 1, code: '15x15', detail: '1.3 mm', quantity: 1 });

    expect(service.items().length).toBe(1);
    expect(service.count()).toBe(1);
    expect(service.has(1)).toBe(true);
  });

  it('treats two thicknesses of one product as two items', () => {
    // The first version matched on the product alone, so these collapsed into one line with a
    // quantity of two - and the shop would have priced a thickness nobody asked for.
    service.add({ productId: 7, code: '15x15', detail: 'Trashësia 1.3 mm', quantity: 1 });
    service.add({ productId: 7, code: '15x15', detail: 'Trashësia 1.5 mm', quantity: 1 });

    expect(service.items().length).toBe(2);
    expect(service.count()).toBe(2);
  });

  it('raises the quantity when the same thickness is added twice', () => {
    service.add({ productId: 7, code: '15x15', detail: 'Trashësia 1.3 mm', quantity: 1 });
    service.add({ productId: 7, code: '15x15', detail: 'Trashësia 1.3 mm', quantity: 2 });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(3);
    expect(service.count()).toBe(3);
  });

  it('removes one item and clears the list', () => {
    service.add({ productId: 1, code: 'A', detail: 'x', quantity: 1 });
    service.add({ productId: 2, code: 'B', detail: 'y', quantity: 1 });

    service.remove(1);
    expect(service.items().map((item) => item.productId)).toEqual([2]);

    service.clear();
    expect(service.items()).toEqual([]);
    expect(service.count()).toBe(0);
  });

  it('survives a corrupted list rather than taking the page down', () => {
    localStorage.setItem('quote-list', 'not json at all');

    expect(service.items()).toEqual([]);
    expect(service.count()).toBe(0);
  });

  it('keeps one variant when language and price change', () => {
    service.setQuantity({productId:7,variantKey:'id:4',code:'A',detail:'Trashësia 2 mm — 4 EUR',unitPrice:4,currency:'EUR',quantity:1}, 5);
    service.setQuantity({productId:7,variantKey:'id:4',code:'A',detail:'Thickness 2 mm — 6 EUR',unitPrice:6,currency:'EUR',quantity:1}, 3);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(3);
    expect(service.items()[0].unitPrice).toBe(6);
  });
  it('keeps distinct variants even when their display text is identical', () => {
    service.setQuantity({productId:7,variantKey:'id:4',code:'A',detail:'2 mm',quantity:1}, 2);
    service.setQuantity({productId:7,variantKey:'id:5',code:'A',detail:'2 mm',quantity:1}, 3);
    expect(service.items().length).toBe(2);
    service.setQuantity(service.items()[0],0);
    expect(service.items()[0].variantKey).toBe('id:5');
  });
  it('preserves an old saved list and adopts only unambiguous variants', () => {
    localStorage.setItem('quote-list',JSON.stringify([{productId:7,code:'A',detail:'Trashësia 2 mm — 4 EUR',quantity:5}]));
    service.migrateLegacy(7,[{signature:'2',variantKey:'id:4'},{signature:'2',variantKey:'id:5'}]);
    expect(service.items()[0].variantKey).toBeUndefined();
    service.migrateLegacy(7,[{signature:'2',variantKey:'id:4'}]);
    expect(service.items()[0].variantKey).toBe('id:4');
    expect(service.items()[0].quantity).toBe(5);
    expect(service.items()[0].unitPrice).toBe(4);
  });

});
