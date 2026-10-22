import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SERVICES, ServiceOffering } from '../../shared/services';
import { PROJECTS } from '../../shared/projects';

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
  imports: [CommonModule, RouterModule, TranslateModule ],
  templateUrl: './services.component.html',
})
export class ServicesComponent {
  readonly services = SERVICES;

  /** Draws the empty photograph places while there are no photographs to put in them. */


  /**
   * What to send for a price that does not have to be asked about twice.
   *
   * General to any workshop, which is why it can be written here: a DXF goes straight to the
   * machine, a sketch with the sizes and the quantity is the next best thing, and the material,
   * the bends and the deadline are what decide the rest. The guide behind the link goes through
   * the same ground at length.
   */
  readonly sendKeys = [
    'SERVICES.SEND_1',
    'SERVICES.SEND_2',
    'SERVICES.SEND_3',
    'SERVICES.SEND_4',
    'SERVICES.SEND_5',
  ];

  /**
   * The gallery entries that show this service being done, ready to link.
   *
   * The review asked the service pages to carry examples. Rather than a second set of photographs
   * to take, each service points at the jobs in the gallery that used it - one set of pictures,
   * used in both places - and the link lands on that entry rather than the top of the page.
   */
  samplesFor(service: ServiceOffering): { titleKey: string; anchor: string }[] {
    return service.sampleIndexes
      .map((index) => ({ project: PROJECTS[index - 1], index }))
      .filter((entry) => !!entry.project)
      .map((entry) => ({ titleKey: entry.project.titleKey, anchor: 'project-' + entry.index }));
  }
}
