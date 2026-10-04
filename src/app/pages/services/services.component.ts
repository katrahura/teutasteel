import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SERVICES } from '../../shared/services';

/**
 * What the company does beyond selling stock: cutting, bending and decorating to the customer's
 * own drawing. The five services were already described on the home page and photographed; this
 * gives them a page of their own that can be linked, with a way to ask about each one.
 */
@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './services.component.html',
})
export class ServicesComponent {
  readonly services = SERVICES;
}
