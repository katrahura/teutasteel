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
});
