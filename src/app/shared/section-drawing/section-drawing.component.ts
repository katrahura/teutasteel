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
      <svg [attr.viewBox]="viewBox" role="img" [attr.aria-label]="label()" [style.max-width.px]="maxWidth">
        <!-- In the dialog the material is hatched, the way a cut section is drawn on any steel
             drawing. The pattern is defined only where it is used; a page shows one dialog. -->
        <defs *ngIf="size === 'large'">
          <pattern id="sectionHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#eef2f5" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#8496a6" stroke-width="0.55" />
          </pattern>
        </defs>
        <g [attr.transform]="'translate(' + offsetX + ',' + offsetY + ')'" [attr.stroke-width]="strokeWidth">
          <!-- Hollow sections: the outside, then the wall inside it. -->
          <ng-container *ngIf="shape === 'round-hollow'">
            <circle [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="w / 2" [attr.fill]="fill" stroke="#94a3b8" />
            <circle [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="Math.max(w / 2 - wall, 2)" fill="#f8fafc" stroke="#94a3b8" />
            <line [attr.x1]="w / 2" [attr.y1]="h / 2 - w / 2" [attr.x2]="w / 2" [attr.y2]="h / 2 - w / 2 + wall" stroke="#475569" />
            <line [attr.x1]="w / 2 - w / 2" [attr.y1]="h / 2" [attr.x2]="w / 2 - w / 2 + wall" [attr.y2]="h / 2" stroke="#475569" />
          </ng-container>

          <ng-container *ngIf="shape === 'rect-hollow'">
            <rect [attr.width]="w" [attr.height]="h" rx="2" [attr.fill]="fill" stroke="#94a3b8" />
            <rect [attr.x]="wall" [attr.y]="wall" [attr.width]="Math.max(w - 2 * wall, 4)" [attr.height]="Math.max(h - 2 * wall, 4)"
                  rx="1" fill="#f8fafc" stroke="#94a3b8" />
          </ng-container>

          <!-- Solid sections. -->
          <circle *ngIf="shape === 'solid-round'" [attr.cx]="w / 2" [attr.cy]="h / 2" [attr.r]="w / 2"
                  [attr.fill]="fill" stroke="#94a3b8" />
          <rect *ngIf="shape === 'solid-square'" [attr.width]="w" [attr.height]="h" rx="2"
                [attr.fill]="fill" stroke="#94a3b8" />
          <!-- A sheet or a flat bar, seen end on. -->
          <rect *ngIf="shape === 'sheet'" [attr.width]="w" [attr.height]="h" [attr.fill]="fill" stroke="#94a3b8" />

          <!-- An angle: two legs of the same length. -->
          <path *ngIf="shape === 'angle'" [attr.d]="anglePath" [attr.fill]="fill" stroke="#94a3b8" />

          <!-- A beam: two flanges and a web. -->
          <path *ngIf="shape === 'ibeam'" [attr.d]="ibeamPath" [attr.fill]="fill" stroke="#94a3b8" />

          <!-- A channel: two flanges and one web, open on one side. -->
          <path *ngIf="shape === 'channel'" [attr.d]="channelPath" [attr.fill]="fill" stroke="#94a3b8" />

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
        <!-- The dimensions, and the wall seen large, only in the dialog: at card size the numbers
             would be six pixels tall and the wall a hairline. -->
        <ng-container *ngIf="size === 'large'">
          <g *ngFor="let line of dimensionLines">
            <path [attr.d]="line.path" stroke="#334155" stroke-width="0.5" fill="none" />
            <path [attr.d]="line.heads" fill="#334155" stroke="none" />
            <text [attr.x]="line.x" [attr.y]="line.y" [attr.text-anchor]="line.anchor" font-size="6.4"
                  font-weight="600" fill="#1e293b"
                  style="paint-order:stroke;stroke:#fff;stroke-width:2.2px;stroke-linejoin:round">{{ line.text }}</text>
          </g>
          <g *ngIf="detail as d">
            <line [attr.x1]="d.fromX" [attr.y1]="d.fromY" [attr.x2]="d.leadX" [attr.y2]="d.leadY"
                  stroke="#0f766e" stroke-width="0.45" stroke-dasharray="1.6 1.6" />
            <clipPath id="sectionDetailClip">
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r" />
            </clipPath>
            <g clip-path="url(#sectionDetailClip)">
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r" fill="#fff" />
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r - 2.6" fill="none"
                      stroke="url(#sectionHatch)" stroke-width="5.4" />
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r - 2.6" fill="none" stroke="#8496a6" stroke-width="0.45" />
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r - 5.6" fill="#fff" stroke="#8496a6" stroke-width="0.45" />
            </g>
            <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r" fill="none" stroke="#0f766e" stroke-width="0.7" />
            <text [attr.x]="d.cx" [attr.y]="d.cy + d.r + 6.6" text-anchor="middle" font-size="6.4"
                  font-weight="600" fill="#0f766e">{{ d.label }}</text>
          </g>
        </ng-container>
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

  /**
   * The room the drawing needs.
   *
   * In the dialog the section sits ten units in from the corner, which leaves space on the right and
   * below for the dimension lines. The card keeps the plain box it has always had, because nothing is
   * drawn outside the section there and a card is too small to carry numbers anyway.
   */
  get viewBox(): string {
    return this.size === 'large' ? '0 0 140 112' : '0 0 120 96';
  }

  /** The material: hatched in the dialog, flat on the card, where a hatch reads as noise. */
  get fill(): string {
    return this.size === 'large' ? 'url(#sectionHatch)' : '#cbd5e1';
  }

  get strokeWidth(): number {
    return this.size === 'large' ? 0.55 : 1;
  }

  get offsetX(): number {
    return (this.size === 'large' ? 10 : 0) + (120 - this.w) / 2;
  }

  get offsetY(): number {
    return (this.size === 'large' ? 10 : 0) + (96 - this.h) / 2;
  }

  /**
   * The wall, at the catalogue's own proportion - no multiplier.
   *
   * This used to be multiplied by three so that a thin wall stayed visible, and the result was a
   * drawing of a 28 mm tube with a 1.5 mm wall in which the wall looked four or five millimetres
   * thick. The owner spotted it and he was right: the wall is the number a tube is bought by, and a
   * drawing that inflates it tells the customer they are getting a heavier tube than they are.
   *
   * It is drawn true now, lifted only to the thinnest line that still shows. Where even that is not
   * enough, the detail beside the drawing carries the number.
   */
  get wall(): number {
    const smallest = Math.min(this.w, this.h);
    const thickness = this.thicknessValue;
    const reference = Math.max(this.widthValue || 1, this.heightValue || 1);
    if (!thickness) {
      // Nothing in the catalogue to draw from: a thin, neutral wall rather than a heavy one.
      return Math.max(1.2, smallest * 0.05);
    }
    return Math.max(smallest * (thickness / reference), 1.2);
  }

  /**
   * The dimensions, in the dialog only.
   *
   * Every number is the catalogue's own; where it has none, no line is drawn and the code stands on
   * its own, which is what the caption already does. Nothing is measured or rounded up on the way.
   */
  get dimensionLines(): Array<{ path: string; heads: string; x: number; y: number; anchor: string; text: string }> {
    if (this.size !== 'large') {
      return [];
    }
    const lines: Array<{ path: string; heads: string; x: number; y: number; anchor: string; text: string }> = [];
    const width = this.widthValue;
    const height = this.heightValue;
    const left = this.offsetX, top = this.offsetY;
    const right = left + this.w, bottom = top + this.h;
    const gap = 10;
    const round = (n: number) => Math.round(n * 10) / 10;
    const head = (x: number, y: number, vertical: boolean) => {
      const s = 1.9, l = 2.6;
      return vertical
        ? `M${x},${y + l} L${x - s},${y - s * 0.3} L${x + s},${y - s * 0.3} Z`
        : `M${x + l},${y} L${x - s * 0.3},${y - s} L${x - s * 0.3},${y + s} Z`;
    };

    // Across the bottom: the width, or the diameter for a round section.
    const under = bottom + 7;
    const across = this.shape === 'round-hollow' && height !== null
      ? `Ø${height}`
      : (width !== null ? String(width) : '');
    if (across) {
      lines.push({
        path: `M${round(left)},${round(under)} H${round((left + right) / 2 - gap)} ` +
              `M${round(right)},${round(under)} H${round((left + right) / 2 + gap)}`,
        heads: head(left, under, false) + ' ' + head(right, under, false),
        x: round((left + right) / 2), y: round(under + 8), anchor: 'middle', text: across,
      });
    }
    // Down the right side: the height, except for a round section, which its diameter already says.
    if (height !== null && this.shape !== 'round-hollow') {
      const side = right + 7;
      lines.push({
        path: `M${round(side)},${round(top)} V${round((top + bottom) / 2 - gap)} ` +
              `M${round(side)},${round(bottom)} V${round((top + bottom) / 2 + gap)}`,
        heads: head(side, top, true) + ' ' + head(side, bottom, true),
        x: round(side - 4), y: round((top + bottom) / 2 + 2.9), anchor: 'end', text: String(height),
      });
    }
    return lines;
  }

  /**
   * The wall seen large, labelled with the number it stands for.
   *
   * Only for a hollow section whose thickness the catalogue states: this is the one thing the drawing
   * cannot show at its true scale in 72 units, so it is shown magnified next to it rather than
   * exaggerated inside it.
   */
  get detail(): { cx: number; cy: number; r: number; label: string; leadX: number; leadY: number;
                  fromX: number; fromY: number } | null {
    if (this.size !== 'large') {
      return null;
    }
    const thickness = this.thicknessValue;
    const shape = this.shape;
    if (!thickness || (shape !== 'rect-hollow' && shape !== 'round-hollow')) {
      return null;
    }
    const cx = 129, cy = 11, r = 8;
    const fromX = shape === 'round-hollow'
      ? this.offsetX + this.w / 2 + (this.w / 2) * Math.cos(-Math.PI / 4)
      : this.offsetX + this.w;
    const fromY = shape === 'round-hollow'
      ? this.offsetY + this.h / 2 + (this.h / 2) * Math.sin(-Math.PI / 4)
      : this.offsetY;
    return { cx, cy, r, label: `t ${thickness}`, fromX, fromY, leadX: cx - r * 0.7, leadY: cy + r * 0.7 };
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
