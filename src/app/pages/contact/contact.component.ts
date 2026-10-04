import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterModule, TranslateModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent {
  private translate = inject(TranslateService);

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

  /** The shop cannot answer without these three, so the send button waits for them. */
  isQuoteValid(): boolean {
    return !!(this.quote.name.trim() && this.quote.phone.trim() && this.quote.product.trim());
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
      `${this.translate.instant('QUOTE.PRODUCT')}: ${this.quote.product.trim()}`,
    ];
    if (this.quote.quantity.trim()) {
      lines.push(`${this.translate.instant('QUOTE.QUANTITY')}: ${this.quote.quantity.trim()}`);
    }
    if (this.quote.notes.trim()) {
      lines.push(`${this.translate.instant('QUOTE.NOTES')}: ${this.quote.notes.trim()}`);
    }
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
  }
}
