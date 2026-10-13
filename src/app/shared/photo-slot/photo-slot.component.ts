import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The place where a photograph will go, drawn while there is none.
 *
 * Deliberately plain: grey, dashed, with the label and the size the picture should be. It is not a
 * pretend photograph and does not try to look like one - a stock image standing in for the real
 * thing is how a site starts claiming work it has not done.
 */
@Component({
  selector: 'app-photo-slot',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="slot" [style.aspect-ratio]="ratio">
      <span class="mark" aria-hidden="true">&#128247;</span>
      <strong class="label">{{ labelKey | translate }}</strong>
      <span class="size">{{ size }}</span>
    </div>
  `,
  styles: [
    `
      .slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        text-align: center;
        padding: 14px;
        background: repeating-linear-gradient(
          45deg,
          #f1f3f5,
          #f1f3f5 12px,
          #e9ecef 12px,
          #e9ecef 24px
        );
        border: 2px dashed #adb5bd;
        border-radius: 10px;
        color: #495057;
      }
      .mark {
        font-size: 26px;
        opacity: 0.55;
      }
      .label {
        font-size: 14px;
        font-weight: 700;
      }
      .size {
        font-size: 12.5px;
        color: #6c757d;
      }
    `,
  ],
})
export class PhotoSlotComponent {
  /** Translation key for what this photograph should show. */
  @Input() labelKey = '';

  /** The shape the picture should be, and how big, in the words of a camera. */
  @Input() size = '';

  /** Any CSS aspect-ratio, so the slot occupies the room the photograph will. */
  @Input() ratio = '16 / 10';
}
