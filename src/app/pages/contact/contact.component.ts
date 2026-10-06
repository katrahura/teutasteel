import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { QuoteListService, QuoteItem } from '../../shared/quote-list.service';

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
    this.split();
  }

  /** The price inside a line - "Trashesia 1.3 mm - 4.20 Eur" is 4.20 - or null when there is none. */
  private priceOf(item: QuoteItem): number | null {
    const found = /([\d.]+)\s*(?:Eur|EUR|\u20ac)/.exec(item.detail || '');
    if (!found) {
      return null;
    }
    const value = Number(found[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
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
   * Address comes from the environment, next to the other contact details.
   *
   * The map itself is a static `src` in the template: Angular's sanitizer refuses a
   * bound value in an iframe's resource URL context (NG0904), and a static
   * attribute is what ends up in the prerendered HTML as well.
   */
  readonly location = environment.location;

  /**
   * The contact details, from the environment rather than written into the markup.
   *
   * They used to be hardcoded in four places here and two in the mobile menu, so changing
   * a number meant finding all six - and the environment comment promising "one place" was
   * only true for the WhatsApp link on a product card.
   */
  readonly phone = environment.phone;
  readonly phoneDisplay = environment.phoneDisplay;
  readonly whatsappNumber = environment.whatsappNumber;
  readonly whatsappDisplay = environment.whatsappDisplay;
  readonly email = environment.contactEmail;

  /** What the visitor types into the quote form. */
  quote = { name: '', phone: '', product: '', quantity: '', notes: '' };

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
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
  }
}
