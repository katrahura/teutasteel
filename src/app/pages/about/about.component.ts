import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PhotoSlotComponent } from '../../shared/photo-slot/photo-slot.component';
import { SHOW_PLACEHOLDERS } from '../../shared/placeholders';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PhotoSlotComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  /**
   * The review's ask for this page was the workshop and the team rather than statements that would
   * suit any company. The two places for those photographs are drawn while they do not exist, so
   * the room they take can be seen and judged before anyone goes and takes them.
   */
  readonly showPlaceholders = SHOW_PLACEHOLDERS;
}
