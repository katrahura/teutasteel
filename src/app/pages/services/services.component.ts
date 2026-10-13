import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SERVICES } from '../../shared/services';
import { PhotoSlotComponent } from '../../shared/photo-slot/photo-slot.component';
import { SHOW_PLACEHOLDERS } from '../../shared/placeholders';

/**
 * What the company does beyond selling stock: cutting, bending and decorating to the customer's
 * own drawing. The seven services are the same list the home page and the quote form use - one
 * list, so the three cannot drift apart again.
 *
 * Two of the seven have no photograph yet. Their cards say where one will go rather than borrowing
 * a picture of a different machine.
 */
@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PhotoSlotComponent],
  templateUrl: './services.component.html',
})
export class ServicesComponent {
  readonly services = SERVICES;

  /** Draws the empty photograph places while there are no photographs to put in them. */
  readonly showPlaceholders = SHOW_PLACEHOLDERS;
}
