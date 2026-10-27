import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QuoteListService, QuoteItem } from '../../shared/quote-list.service';
import { SERVICES, ServiceOffering } from '../../shared/services';
import { ContactService } from '../../services/contact.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent implements OnInit {
  private translate = inject(TranslateService);
  private quoteList = inject(QuoteListService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  /** The shop's own details: what the owner saved, and the built-in value when nothing is saved. */
  readonly contact = inject(ContactService);

  /**
   * The service the visitor pressed on the services page, if they came from there.
   *
   * Those cards have always carried `?service=cnc` and nothing read it, so choosing a service and
   * pressing "request a quote" arrived here as a general enquiry - the service.ts comment even says
   * the id exists "so a button can open it with this service already chosen". It is optional:
   * somebody can open the quote form directly, and the request list is what carries the products.
   */
  selectedService: ServiceOffering | null = null;
  readonly requestPage = this.route.snapshot.data?.['requestPage'] === true;
  hasDrawing = false;

  /**
   * What the visitor added while browsing.
   *
   * A plain field, not a getter. It was a getter returning `quoteList.items()`, which builds a new
   * array on every call - and Angular calls it on every change-detection pass. With the quantity
   * fields bound to it, each pass produced a new array identity, which scheduled another pass, and
   * the renderer locked up: the route stopped replying altogether rather than throwing. The three
   * actions below assign the array the service returns, so the reference only changes when the list
   * actually does.
   */
  private items: QuoteItem[] = this.quoteList.items();

  /**
   * The list, and the two halves the owner asked for.
   *
   * A price in the line means we know what it costs; anything else is for the shop to price, and
   * those are separated because a total that silently leaves them out would be misleading. Set
   * through the setter below, so the halves can never drift from the list.
   */
  get requested(): QuoteItem[] {
    return this.items;
  }

  set requested(value: QuoteItem[]) {
    this.items = value;
    this.split();
  }

  pricedItems: QuoteItem[] = [];
  unpricedItems: QuoteItem[] = [];
  /** What the priced half comes to. The rest is quoted by the shop. */
  pricedTotal = 0;

  private split(): void {
    this.pricedItems = this.items.filter((item) => this.priceOf(item) !== null);
    this.unpricedItems = this.items.filter((item) => this.priceOf(item) === null);
    const sum = this.pricedItems.reduce(
      (running, item) => running + (this.priceOf(item) || 0) * (item.quantity || 1), 0
    );
    this.pricedTotal = Math.round(sum * 100) / 100;
  }

  /**
   * Fill the two halves when the page opens.
   *
   * `split` ran only inside the setter, so a visitor arriving with items already in the list - the
   * normal case, they added them on the products page - got an empty page. `requested` held the
   * items; the groups the template actually renders, pricedItems and unpricedItems, held none.
   * Nothing threw and the console stayed empty, which is why this needed measuring rather than
   * reading.
   */
  ngOnInit(): void {
    this.restoreDraft();
    this.split();
    let firstParams = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const product = (params.get('product') || '').trim();
      if (product && !this.quote.product) this.quote.product = product;
      const asked = (params.get('service') || '').trim();
      if (!firstParams || params.has('service')) this.selectedService = SERVICES.find(service => service.id === asked) || null;
      firstParams = false;
      if (this.requestPage) this.saveDraft();
    });
  }

  private readonly draftKey = 'teutasteel-enquiry-draft-v1';

  private restoreDraft(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = JSON.parse(localStorage.getItem(this.draftKey) || 'null');
      if (!saved || typeof saved !== 'object') return;
      for (const key of Object.keys(this.quote) as (keyof typeof this.quote)[]) {
        if (typeof saved.quote?.[key] === 'string') this.quote[key] = saved.quote[key].slice(0, 10000);
      }
      this.hasDrawing = saved.hasDrawing === true;
      this.selectedService = SERVICES.find(service => service.id === saved.service) || null;
    } catch { /* Unavailable storage must never prevent an enquiry. */ }
  }

  saveDraft(): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this.draftKey,
        JSON.stringify({ quote: this.quote, hasDrawing: this.hasDrawing, service: this.selectedService?.id || null }));
    } catch { /* The form remains usable when storage is full or disabled. */ }
  }

  clearDraft(): void {
    for (const key of Object.keys(this.quote) as (keyof typeof this.quote)[]) this.quote[key] = '';
    this.hasDrawing = false;
    this.saveDraft();
  }

  /** The chosen service's name, in the language the visitor is reading. */
  get serviceName(): string {
    return this.selectedService ? this.translate.instant(this.selectedService.titleKey) : '';
  }

  /** Only EUR lines contribute to the EUR subtotal. Other currencies require a quote. */
  private priceOf(item: QuoteItem): number | null {
    const value = Number(item.unitPrice);
    return (item.currency || '').toUpperCase() === 'EUR' && Number.isFinite(value) && value > 0 ? value : null;
  }

  removeRequested(item: QuoteItem): void {
    this.requested = this.quoteList.setQuantity(item, 0);
  }

  /** One more or one fewer of a line, without leaving the page. */
  bumpRequested(item: QuoteItem, delta: number): void {
    this.requested = this.quoteList.setQuantity(item, (item.quantity || 1) + delta);
  }

  /** A typed quantity. Zero removes the line. */
  setRequestedQuantity(item: QuoteItem, value: any): void {
    this.requested = this.quoteList.setQuantity(item, Number(value));
  }

  clearRequested(): void {
    this.quoteList.clear();
    this.requested = [];
  }

  /**
   * The map itself is a static `src` in the template: Angular's sanitizer refuses a
   * bound value in an iframe's resource URL context (NG0904), and a static
   * attribute is what ends up in the prerendered HTML as well.
   *
   * The address beside it is `contact.address()`: the owner's saved line when there is one, the
   * built-in street when there is not.
   */

  /**
   * What the visitor types into the quote form.
   *
   * The service block appears only when a service was chosen: thickness, dimensions and whether
   * there is a drawing are what a cutting or bending job cannot be priced without, and asking for
   * them here saves a reply. Delivery location and the date are for everybody - one optional, the
   * other what the customer is working towards.
   */
  quote = {
    name: '',
    phone: '',
    product: '',
    quantity: '',
    notes: '',
    thickness: '',
    dimensions: '',
    drawing: '',
    deliveryPlace: '',
    requiredDate: '',
  };

  /**
   * The shop cannot answer without a name and a phone.
   *
   * It used to insist on a product as well. Now that the request list carries the products and
   * their quantities, the free-text box behind that rule has gone - and a customer who has browsed
   * nothing, wanting a general quote, would have been stuck behind it. Name and phone are enough.
   */
  isQuoteValid(): boolean {
    return !!(this.quote.name.trim() && this.quote.phone.trim());
  }

  /**
   * The enquiry as a WhatsApp message, in the language the visitor is reading.
   *
   * Deliberately nothing on the server side. The shop sells on WhatsApp, the product cards
   * already hand enquiries over that way, and a form that posted somewhere would need the owner
   * to go and look at it - a second place for an enquiry to get lost.
   */
  getQuoteLink(): string {
    const lines = [
      this.translate.instant('QUOTE.MESSAGE_INTRO'),
      `${this.translate.instant('QUOTE.NAME')}: ${this.quote.name.trim()}`,
      `${this.translate.instant('QUOTE.PHONE')}: ${this.quote.phone.trim()}`,
    ];
    // The service they picked before they got here, so the shop sees it in the message rather than
    // having to ask which one they meant.
    if (this.selectedService) {
      lines.push(`${this.translate.instant('QUOTE.SERVICE')}: ${this.serviceName}`);
    }
    // Only if they wrote something: with a request list, this box is often left empty, and an empty
    // label in the message reads as a mistake.
    if (this.quote.product.trim()) {
      lines.push(`${this.translate.instant('QUOTE.PRODUCT')}: ${this.quote.product.trim()}`);
    }
    if (this.quote.quantity.trim()) {
      lines.push(`${this.translate.instant('QUOTE.QUANTITY')}: ${this.quote.quantity.trim()}`);
    }
    if (this.quote.notes.trim()) {
      lines.push(`${this.translate.instant('QUOTE.NOTES')}: ${this.quote.notes.trim()}`);
    }
    // The work itself, when a service was chosen. The quantity is above, with the rest of the
    // reply's labels, so it is not repeated here.
    if (this.selectedService) {
      if (this.hasDrawing) lines.push(this.translate.instant('QUOTE.DRAWING_MESSAGE'));
      const details: [string, string][] = [
        ['QUOTE.THICKNESS', this.quote.thickness],
        ['QUOTE.DIMENSIONS', this.quote.dimensions],
        ['QUOTE.DRAWING', this.quote.drawing],
      ];
      details.forEach(([key, value]) => {
        if (value.trim()) {
          lines.push(`${this.translate.instant(key)}: ${value.trim()}`);
        }
      });
    }
    if (this.quote.deliveryPlace.trim()) {
      lines.push(
        `${this.translate.instant('QUOTE.DELIVERY_PLACE')}: ${this.quote.deliveryPlace.trim()}`
      );
    }
    if (this.quote.requiredDate.trim()) {
      lines.push(
        `${this.translate.instant('QUOTE.REQUIRED_DATE')}: ${this.quote.requiredDate.trim()}`
      );
    }
    // What they added while browsing. This is the point of the request list: a tube, its bends, a
    // sheet - one enquiry instead of four messages.
    const items = this.requested;
    if (items.length) {
      lines.push('');
      lines.push(`${this.translate.instant('PRODUCTS.REQUEST_TITLE')}:`);
      items.forEach((item, index) => {
        const detail = item.detail ? ` — ${item.detail}` : '';
        lines.push(`${index + 1}. ${item.code}${detail} (${item.quantity})`);
      });
    }
    return `https://wa.me/${this.contact.whatsappNumber()}?text=${encodeURIComponent(lines.join('\n'))}`;
  }
}
