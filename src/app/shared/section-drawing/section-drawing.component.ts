import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * The cross-section of a product, drawn from the dimensions in the catalogue.
 *
 * The review asked for a dimension drawing wherever a photograph would not tell two products
 * apart - forty tubes look the same in a picture, and what a customer actually needs to see is the
 * section: round, square, angle, flat, I-beam. The catalogue carries the numbers, so the drawing
 * is made from them rather than invented: the shape is drawn to their proportions, so an 18 x 18
 * angle and an 80 x 46 beam do not come out the same size.
 *
 * Which shape it is comes from the category, and where that is not enough, from the product code -
 * which is the shop's own convention: a code starting with the diameter sign is a round tube, "L-"
 * is an angle, "IPE" is a beam, "Llam" is a sheet. The dimensions cannot be trusted with this: a
 * square tube and an angle both read 18 x 18.
 *
 * The numbers are printed without a unit. The catalogue does not always agree with itself on one -
 * sheets are entered in millimetres, some sheet sizes in metres - and "2 mm" printed under a
 * two-metre sheet is worse than no unit at all. The unit is settled with the owner, not guessed
 * here.
 *
 * The values arrive as they are stored, which is a number for a size and a string for a price, so
 * everything is read through one place that turns them into numbers or null.
 */
type Shape =
  | 'round-hollow'
  | 'rect-hollow'
  | 'solid-round'
  | 'solid-square'
  | 'sheet'
  | 'angle'
  | 'ibeam'
  | 'channel'
  | 'bend'
  | 'plain';

/** Category id to shape. These are the ids in the catalogue, read from it rather than assumed. */
const BY_CATEGORY: Record<number, Shape> = {
  122: 'round-hollow', // Round tubes
  123: 'rect-hollow', // Square & rectangular tubes
  125: 'bend', // Bends (Kthesa)
  130: 'sheet', // Aluminium and special sheet
  131: 'solid-square', // Flat bars (SHP)
  132: 'sheet', // Galvanised sheet
  133: 'solid-round', // Solid round and square bar
  134: 'sheet', // Steel sheets (black, galvanised, ribbed)
  135: 'angle', // Angles (L-Profil)
  136: 'ibeam', // I-beams and channels
  137: 'plain', // Spacers, nuts and T/D profiles
};

@Component({
  selector: 'app-section-drawing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="drawing">
      <svg viewBox="0 0 120 96" role="img" [attr.aria-label]="label()">
        <g [attr.transform]="'translate(' + offsetX + ',' + offsetY + ')'">
          <!-- Hollow sections: the outside, then the wall inside it. -->
          <ng-container *ngIf="shape === 'round-hollow'">
            <circle [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="w / 2" fill="#cbd5e1" stroke="#94a3b8" />
            <circle [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="Math.max(w / 2 - wall, 2)" fill="#f8fafc" stroke="#94a3b8" />
            <line [attr.x1]="w / 2" [attr.y1]="h / 2 - w / 2" [attr.x2]="w / 2" [attr.y2]="h / 2 - w / 2 + wall" stroke="#475569" />
            <line [attr.x1]="w / 2 - w / 2" [attr.y1]="h / 2" [attr.x2]="w / 2 - w / 2 + wall" [attr.y2]="h / 2" stroke="#475569" />
          </ng-container>

          <ng-container *ngIf="shape === 'rect-hollow'">
            <rect [attr.width]="w" [attr.height]="h" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
            <rect [attr.x]="wall" [attr.y]="wall" [attr.width]="Math.max(w - 2 * wall, 4)" [attr.height]="Math.max(h - 2 * wall, 4)"
                  rx="1" fill="#f8fafc" stroke="#94a3b8" />
          </ng-container>

          <!-- Solid sections. -->
          <circle *ngIf="shape === 'solid-round'" [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="w / 2"
                  fill="#cbd5e1" stroke="#94a3b8" />
          <rect *ngIf="shape === 'solid-square'" [attr.width]="w" [attr.height]="h" rx="2"
                fill="#cbd5e1" stroke="#94a3b8" />
          <!-- A sheet or a flat bar, seen end on. -->
          <rect *ngIf="shape === 'sheet'" [attr.width]="w" [attr.height]="h" fill="#cbd5e1" stroke="#94a3b8" />

          <!-- An angle: two legs of the same length. -->
          <path *ngIf="shape === 'angle'" [attr.d]="anglePath" fill="#cbd5e1" stroke="#94a3b8" />

          <!-- A beam: two flanges and a web. -->
          <path *ngIf="shape === 'ibeam'" [attr.d]="ibeamPath" fill="#cbd5e1" stroke="#94a3b8" />

          <!-- A channel: two flanges and one web, open on one side. -->
          <path *ngIf="shape === 'channel'" [attr.d]="channelPath" fill="#cbd5e1" stroke="#94a3b8" />

          <!-- A bend, seen from the side: two straight runs and the arc between them. -->
          <ng-container *ngIf="shape === 'bend'">
            <path [attr.d]="bendPath" fill="none" stroke="#cbd5e1" [attr.stroke-width]="Math.max(6, w / 4)" />
            <path [attr.d]="bendPath" fill="none" stroke="#94a3b8" stroke-width="1" />
          </ng-container>

          <!-- Nothing recognisable: a plain section with the numbers, which is still more than a
               silhouette said. -->
          <rect *ngIf="shape === 'plain'" [attr.width]="w" [attr.height]="h" rx="2"
                fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="4 3" />
        </g>
      </svg>
      <figcaption class="dims" *ngIf="label()">{{ label() }}</figcaption>
    </figure>
  `,
  styles: [
    `
      .drawing {
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      svg {
        width: 100%;
        max-width: 150px;
        height: auto;
      }
      .dims {
        font-size: 12.5px;
        color: #475569;
        font-weight: 600;
        text-align: center;
        line-height: 1.3;
      }
    `,
  ],
})
export class SectionDrawingComponent {
  readonly Math = Math;

  @Input() categoryId: number | null = null;
  @Input() code: string | null = null;
  @Input() thickness: number | string | null = null;
  @Input() width: number | string | null = null;
  @Input() height: number | string | null = null;

  /** The box the section is drawn in, inside the 120 x 96 viewBox. */
  private readonly boxW = 96;
  private readonly boxH = 72;

  /** Everything stored as a size goes through here: a number, or null when there is none. */
  private num(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  }

  private get widthValue(): number | null {
    return this.num(this.width);
  }

  private get heightValue(): number | null {
    return this.num(this.height);
  }

  private get thicknessValue(): number | null {
    return this.num(this.thickness);
  }

  get shape(): Shape {
    const byCategory = this.categoryId ? BY_CATEGORY[this.categoryId] : undefined;
    if (byCategory) {
      // An I-beam category also holds channels, and the code is the only thing that tells them
      // apart: UNP is a channel, everything else in that category is an I or an H.
      if (byCategory === 'ibeam' && /^unp/i.test((this.code || '').trim())) {
        return 'channel';
      }
      return byCategory;
    }
    return this.fromCode();
  }

  /** When the category is unknown or missing, the shop's own code convention still says a lot. */
  private fromCode(): Shape {
    const code = (this.code || '').trim().toLowerCase();
    if (!code) {
      return 'plain';
    }
    if (code.startsWith('ø') || code.startsWith('o ') || code.includes(' fi ')) {
      return 'round-hollow';
    }
    if (code.startsWith('l-') || code.startsWith('l ')) {
      return 'angle';
    }
    if (/^(ipe|hea|heb|inp|hla|hlb)/.test(code)) {
      return 'ibeam';
    }
    if (code.startsWith('unp')) {
      return 'channel';
    }
    if (/(llam|zn|briz|flet|tabak|panel)/.test(code)) {
      return 'sheet';
    }
    if (!code.startsWith('shp') && code.includes('ø')) {
      return 'round-hollow';
    }
    // Two sizes close together and a third much smaller: a hollow section.
    const w = this.widthValue ?? 0;
    const h = this.heightValue ?? 0;
    if (w > 0 && h > 0 && Math.abs(w - h) / Math.max(w, h) < 0.25 && this.thicknessValue) {
      return 'rect-hollow';
    }
    return 'plain';
  }

  /** The drawn width and height, keeping the catalogue's proportions. */
  get w(): number {
    return this.proportions().w;
  }

  get h(): number {
    return this.proportions().h;
  }

  get offsetX(): number {
    return (120 - this.w) / 2;
  }

  get offsetY(): number {
    return (96 - this.h) / 2;
  }

  /** The wall thickness in drawing units, kept visible even when the real one is a sliver. */
  get wall(): number {
    const smallest = Math.min(this.w, this.h);
    const thickness = this.thicknessValue;
    const reference = Math.max(this.widthValue || 1, this.heightValue || 1);
    if (!thickness) {
      return Math.max(3, smallest * 0.14);
    }
    const ratio = thickness / reference;
    return Math.min(Math.max(smallest * ratio * 3, 3), smallest * 0.32);
  }

  get anglePath(): string {
    const w = this.w;
    const h = this.h;
    const t = Math.max(3, Math.min(w, h) * 0.22);
    return `M0,0 H${w} V${t} H${t} V${h} H0 Z`;
  }

  get ibeamPath(): string {
    const w = this.w;
    const h = this.h;
    const flange = Math.max(4, h * 0.18);
    const web = Math.max(3, w * 0.22);
    const webX = (w - web) / 2;
    return `M0,0 H${w} V${flange} H${webX + web} V${h - flange} H${w} V${h} H0 V${h - flange} H${webX} V${flange} H0 Z`;
  }

  get channelPath(): string {
    const w = this.w;
    const h = this.h;
    const flange = Math.max(4, h * 0.18);
    const web = Math.max(3, w * 0.22);
    return `M0,0 H${w} V${flange} H${web} V${h - flange} H${w} V${h} H0 Z`;
  }

  get bendPath(): string {
    const w = this.w;
    const h = this.h;
    const r = Math.min(w, h) * 0.45;
    return `M${w * 0.1},${h} L${w * 0.1},${r} A${r},${r} 0 0 1 ${w * 0.1 + r},${h * 0.1} L${w},${h * 0.1}`;
  }

  /** The drawn size, from the catalogue's numbers, or a sensible default when there are none. */
  private proportions(): { w: number; h: number } {
    const shape = this.shape;
    const ratio = (a: number, b: number) => {
      const big = Math.max(a, b) || 1;
      const scale = this.boxW / big;
      let w = a * scale;
      let h = b * scale;
      if (h > this.boxH) {
        const shrink = this.boxH / h;
        w *= shrink;
        h *= shrink;
      }
      return { w: Math.max(w, 8), h: Math.max(h, 8) };
    };

    const width = this.widthValue;
    const height = this.heightValue;
    const thickness = this.thicknessValue;

    switch (shape) {
      case 'sheet':
        // A sheet end-on: as wide as it is, and as thick as it is, with a floor so it stays visible.
        return ratio(Math.max(width || 0, height || 0, 100), Math.max(thickness || 1, 1) * 3);
      case 'solid-square':
        return ratio(width || height || 10, height || width || 10);
      case 'angle':
        return ratio(width || height || 20, height || width || 20);
      case 'ibeam':
      case 'channel':
        return ratio(width || 46, height || 80);
      case 'bend':
        return { w: this.boxW * 0.8, h: this.boxH * 0.8 };
      default:
        if (width && height) {
          return ratio(width, height);
        }
        const only = width || height || 20;
        return ratio(only, only);
    }
  }

  /**
   * What the section is, with the numbers the catalogue holds - and no unit it does not.
   *
   * Every value can be missing, and one product in the beam category carries a code and no
   * dimensions at all: without this it printed "null x null" under the drawing, which is worse than
   * saying nothing. When there is nothing to print, the code stands on its own; when there is not
   * even that, the line is left out.
   */
  label(): string {
    const width = this.widthValue;
    const height = this.heightValue;
    const thickness = this.thicknessValue;
    const cross = (values: Array<number | string | null>) =>
      values.filter((value) => value !== null && value !== '').join(' × ');

    switch (this.shape) {
      case 'round-hollow': {
        const diameter = height ?? width;
        return cross([diameter !== null ? `Ø${diameter}` : null, thickness]) || this.code || '';
      }
      case 'solid-round': {
        const diameter = height ?? width;
        return (diameter !== null ? `Ø${diameter}` : '') || this.code || '';
      }
      case 'rect-hollow':
        return cross([width, height, thickness]) || this.code || '';
      case 'angle':
        return (cross([width, height, thickness]) ? 'L ' + cross([width, height, thickness]) : '') || this.code || '';
      case 'ibeam': {
        const size = cross([height, width]);
        return [this.code, size].filter(Boolean).join(' · ');
      }
      case 'channel': {
        const size = cross([height, width]);
        return [this.code, size].filter(Boolean).join(' · ');
      }
      case 'sheet':
        return cross([width || height, height || width, thickness]) || this.code || '';
      case 'solid-square':
        return cross([width || height, height || width]) || this.code || '';
      default:
        return cross([width, height, thickness]) || this.code || '';
    }
  }
}
