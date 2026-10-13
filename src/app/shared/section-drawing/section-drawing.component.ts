import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { SectionShape, shapeFor } from '../section-shape';

/**
 * The cross-section of a product, drawn from the dimensions in the catalogue.
 *
 * The review asked for a dimension drawing wherever a photograph would not tell two products
 * apart - forty tubes look the same in a picture, and what a customer actually needs to see is the
 * section: round, square, angle, flat, I-beam. The catalogue carries the numbers, so the drawing
 * is made from them rather than invented: the shape is drawn to their proportions, so an 18 x 18
 * angle and an 80 x 46 beam do not come out the same size.
 *
 * Which shape it is comes from `shared/section-shape.ts`, which the card's size line uses too: the
 * two must not disagree about what a product is.
 *
 * The numbers are printed without a unit. The catalogue does not always agree with itself on one -
 * sheets are entered in millimetres, some sheet sizes in metres - and "2 mm" printed under a
 * two-metre sheet is worse than no unit at all. The unit is settled with the owner, not guessed
 * here.
 *
 * The values arrive as they are stored, which is a number for a size and a string for a price, so
 * everything is read through one place that turns them into numbers or null.
 */
@Component({
  selector: 'app-section-drawing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="drawing">
      <svg viewBox="0 0 120 96" role="img" [attr.aria-label]="label()" [style.max-width.px]="maxWidth">
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
      <figcaption class="dims" *ngIf="showCaption && label()">{{ label() }}</figcaption>
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
  /** Only sheets use it: a sheet is 1000 x 2000, and the 2000 lives in this field. */
  @Input() length: number | string | null = null;

  /**
   * Whether to print the numbers under the drawing.
   *
   * The card prints a size line of its own a few lines further down - with the length and the unit -
   * and the two said the same thing twice, in two formats: "10 × 10 × 1.3" under the drawing and
   * "10×10×1.3 · 6 m" below. A customer reading a card twice over learns nothing the second time.
   * The card turns this off when it has a size line to show and leaves it on when it has not, so a
   * drawing is never left standing without its numbers.
   */
  @Input() showCaption = true;

  /**
   * How much room the drawing takes. The card has a narrow strip and the dialog has half a modal,
   * and a section drawn for the one looks lost in the other.
   */
  @Input() size: 'card' | 'large' = 'card';

  get maxWidth(): number {
    return this.size === 'large' ? 280 : 150;
  }

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

  private get lengthValue(): number | null {
    return this.num(this.length);
  }

  get shape(): SectionShape {
    return shapeFor(
      this.categoryId,
      this.code,
      this.widthValue,
      this.heightValue,
      this.thicknessValue
    );
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
    const length = this.lengthValue;

    switch (shape) {
      case 'sheet':
        // A sheet is drawn as the flat rectangle it is, at its real proportions: 1000 x 2000 comes
        // out twice as tall as it is wide. Drawn end-on it was a sliver, which told a customer
        // nothing about the size of the sheet they were choosing - and in the decorative group
        // nearly every product is a sheet with a photograph, so this is the drawing they see.
        return ratio(width || height || 100, length || height || width || 100);
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
        return cross([width || height, this.lengthValue || height || width, thickness]) || this.code || '';
      case 'solid-square':
        return cross([width || height, height || width]) || this.code || '';
      default:
        return cross([width, height, thickness]) || this.code || '';
    }
  }
}
