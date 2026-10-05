/**
 * How much steel weighs, from the section size.
 *
 * Steel is bought and transported by weight, and the catalogue says nothing about it anywhere: a
 * customer choosing 6 m of 40x40x2 has no way to know whether that is 14 kg or 140 kg. For the van,
 * for the price, and for their back.
 *
 * The arithmetic is exact - steel is 7,850 kg/m3, so a cross-section of A mm2 weighs
 * A x 0.00785 kg per metre - but it assumes sharp corners. A mill's own table for a 40x40x2 square
 * hollow section says 2.31 kg/m where this says 2.39, because the real section has rounded corners
 * and this cannot know their radius. It is right to within a few per cent, and the page says
 * "calculated" so nobody treats it as a certificate.
 */

/** 7,850 kg/m3 expressed for millimetres: a section of A mm2 weighs A x 0.00785 kg per metre. */
export const STEEL_KG_PER_MM2_PER_M = 0.00785;

/** 1 mm3 of steel weighs 7.85e-6 kg. */
export const STEEL_KG_PER_MM3 = 7.85e-6;

export type SectionShape = 'round' | 'rectangular' | 'flat' | 'angle' | 'sheet' | 'unknown';

export interface SectionSize {
  /**
   * The outside diameter of a round tube, or the first leg of a rectangle, an angle or a flat bar.
   *
   * Numbers arrive from the API as strings often enough that the type says so: a dimension reading
   * "40" is the same 40 mm as one reading 40.
   */
  height?: number | string | null;
  /** The second leg: the width of a rectangle, the second leg of an angle, the width of a flat bar. */
  width?: number | string | null;
  /** The wall of a tube, the thickness of a bar, the gauge of a sheet. */
  thickness?: number | string | null;
  /** The third dimension of a sheet, in millimetres. */
  length?: number | string | null;
}

function positive(value: number | string | null | undefined): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** The cross-section in mm2, or null when the product does not carry enough to work it out. */
export function crossSectionArea(shape: SectionShape, size: SectionSize): number | null {
  const height = positive(size.height);
  const width = positive(size.width);
  const thickness = positive(size.thickness);

  if (shape === 'round') {
    // A pipe is an annulus: pi x (D - t) x t.
    if (height === null || thickness === null || thickness >= height / 2) {
      return null;
    }
    return Math.PI * (height - thickness) * thickness;
  }

  if (shape === 'rectangular') {
    // The metal is the perimeter at the wall thickness: 2 x (h + w - 2t) x t.
    const second = width === null ? height : width;
    if (height === null || second === null || thickness === null || thickness >= second / 2) {
      return null;
    }
    return 2 * (height + second - 2 * thickness) * thickness;
  }

  if (shape === 'flat') {
    const barWidth = width === null ? height : width;
    if (barWidth === null || thickness === null) {
      return null;
    }
    return barWidth * thickness;
  }

  if (shape === 'angle') {
    // Two legs less the corner they share: (a + b - t) x t.
    const second = width === null ? height : width;
    if (height === null || second === null || thickness === null) {
      return null;
    }
    return (height + second - thickness) * thickness;
  }

  return null;
}

/** Kilograms per metre of a bar or tube, to two decimals, or null if it cannot be worked out. */
export function weightPerMetre(shape: SectionShape, size: SectionSize): number | null {
  const area = crossSectionArea(shape, size);
  if (area === null) {
    return null;
  }
  return Math.round(area * STEEL_KG_PER_MM2_PER_M * 100) / 100;
}

/** The weight of one plate, in kilograms, or null if it cannot be worked out. */
export function weightPerSheet(size: SectionSize): number | null {
  const width = positive(size.width);
  const length = positive(size.length);
  const thickness = positive(size.thickness);
  if (width === null || length === null || thickness === null) {
    return null;
  }
  return Math.round(width * length * thickness * STEEL_KG_PER_MM3 * 100) / 100;
}

/**
 * Which shape a product is, from the category it sits in.
 *
 * Categories rather than guesses: "Angles (L-Profil)" says exactly what it holds, and a product
 * whose category is unknown gets no weight rather than a wrong one.
 */
export function shapeForCategory(categoryTitle: string | null | undefined): SectionShape {
  const title = (categoryTitle || '').toLowerCase();
  if (title.indexOf('angle') >= 0) {
    return 'angle';
  }
  if (title.indexOf('flat bar') >= 0) {
    return 'flat';
  }
  if (title.indexOf('round tube') >= 0) {
    return 'round';
  }
  if (title.indexOf('tube') >= 0 || title.indexOf('hollow') >= 0) {
    return 'rectangular';
  }
  if (title.indexOf('sheet') >= 0 || title.indexOf('plate') >= 0) {
    return 'sheet';
  }
  return 'unknown';
}

/** "2.39 kg/m", or "18.85 kg per sheet", or null when there is nothing honest to say. */
export function describeWeight(shape: SectionShape, size: SectionSize): string | null {
  if (shape === 'sheet') {
    const sheet = weightPerSheet(size);
    return sheet === null ? null : `${sheet} kg`;
  }
  const metre = weightPerMetre(shape, size);
  return metre === null ? null : `${metre} kg/m`;
}
