import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent {
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
}
