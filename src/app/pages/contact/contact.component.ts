import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
export class ContactComponent {
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
  requested: QuoteItem[] = this.quoteList.items();

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

  /** The shop cannot answer without a name, a phone, and something to quote for. */
  isQuoteValid(): boolean {
    const essentials = this.quote.name.trim() && this.quote.phone.trim();
    // Either they described what they need, or they added it from the catalogue while browsing.
    return !!(essentials && (this.quote.product.trim() || this.requested.length));
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
