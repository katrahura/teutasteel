import { QuoteListService } from '../../shared/quote-list.service';
import { SERVICES } from '../../shared/services';
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

  it('keeps the service chosen on the services page and puts it in the enquiry', () => {
    // Those cards have always passed ?service=<id>, and nothing read it: choosing a service and
    // pressing "request a quote" arrived as a general enquiry, with the choice dropped.
    component.selectedService = SERVICES.find((service) => service.id === 'cnc') || null;
    component.quote.name = 'Ana';
    component.quote.phone = '044 133 208';

    expect(component.serviceName).toBe('MISC.CNC_METAL_CUTTING');
    expect(decodeURIComponent(component.getQuoteLink()))
      .toContain('QUOTE.SERVICE: MISC.CNC_METAL_CUTTING');
  });

  it('says nothing about a service when none was chosen', () => {
    component.selectedService = null;
    component.quote.name = 'Ana';
    component.quote.phone = '044';

    expect(decodeURIComponent(component.getQuoteLink())).not.toContain('QUOTE.SERVICE');
  });

  it('asks a service enquiry for the work, and carries it into the message', () => {
    // A cutting or bending job cannot be priced without the thickness, the dimensions, the
    // quantity and whether there is a drawing.
    component.selectedService = SERVICES.find((service) => service.id === 'bending') || null;
    component.quote.name = 'Ana';
    component.quote.phone = '044';
    component.quote.thickness = '3 mm';
    component.quote.dimensions = '1200 x 600';
    component.quote.quantity = '4';
    component.quote.drawing = 'DXF';

    const message = decodeURIComponent(component.getQuoteLink());
    expect(message).toContain('QUOTE.THICKNESS: 3 mm');
    expect(message).toContain('QUOTE.DIMENSIONS: 1200 x 600');
    expect(message).toContain('QUOTE.QUANTITY: 4');
    expect(message).toContain('QUOTE.DRAWING: DXF');
  });

  it('carries a delivery place and a date, and leaves them out when empty', () => {
    component.quote.name = 'Ana';
    component.quote.phone = '044';
    component.quote.deliveryPlace = 'Prishtinë';
    component.quote.requiredDate = '2026-11-02';

    let message = decodeURIComponent(component.getQuoteLink());
    expect(message).toContain('QUOTE.DELIVERY_PLACE: Prishtinë');
    expect(message).toContain('QUOTE.REQUIRED_DATE: 2026-11-02');

    component.quote.deliveryPlace = '';
    component.quote.requiredDate = '';
    message = decodeURIComponent(component.getQuoteLink());
    expect(message).not.toContain('QUOTE.DELIVERY_PLACE');
    expect(message).not.toContain('QUOTE.REQUIRED_DATE');
  });

});
