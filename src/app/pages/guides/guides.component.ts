import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Four short guides to the material itself.
 *
 * The review asked for practical buying guides - galvanized against untreated, how tube sizes are
 * named, sheet thicknesses, and how to prepare a cutting drawing - and this is the one part of that
 * list that can be written without the owner's facts. Everything here is general steel knowledge:
 * the same sentences stand in any textbook, and none of them promises a service, a price or a lead
 * time. The claims about this company are the owner's to make, and are not invented here.
 *
 * The guides are data rather than markup, so a fifth one is a matter of adding its keys to this
 * list and to the two language files.
 */
@Component({
  selector: 'app-guides',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './guides.component.html',
  styleUrl: './guides.component.css',
})
export class GuidesComponent {
  readonly guides: { titleKey: string; bodyKeys: string[] }[] = [
    {
      titleKey: 'GUIDES.GALV_TITLE',
      bodyKeys: ['GUIDES.GALV_1', 'GUIDES.GALV_2', 'GUIDES.GALV_3', 'GUIDES.GALV_4'],
    },
    {
      titleKey: 'GUIDES.TUBE_TITLE',
      bodyKeys: ['GUIDES.TUBE_1', 'GUIDES.TUBE_2', 'GUIDES.TUBE_3', 'GUIDES.TUBE_4'],
    },
    {
      titleKey: 'GUIDES.SHEET_TITLE',
      bodyKeys: ['GUIDES.SHEET_1', 'GUIDES.SHEET_2', 'GUIDES.SHEET_3', 'GUIDES.SHEET_4'],
    },
    {
      titleKey: 'GUIDES.DRAW_TITLE',
      bodyKeys: ['GUIDES.DRAW_1', 'GUIDES.DRAW_2', 'GUIDES.DRAW_3', 'GUIDES.DRAW_4'],
    },
  ];
}
