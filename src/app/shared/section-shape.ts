/**
 * What shape a product is, worked out once for the whole site.
 *
 * Two places need to know: the drawing that shows the section, and the one-line size on the card,
 * which reads differently for a sheet than for a tube. They must not disagree, so the rule lives
 * here rather than in either of them.
 *
 * The category is the first answer, read from the catalogue rather than assumed. The dimensions
 * cannot decide on their own: a square tube and an angle both read 18 x 18, and a flat bar and a
 * round bar both carry one number. Where the category does not say, the product code does - it is
 * the shop's own convention, where a diameter sign means a round tube, "L-" an angle, "IPE" a beam,
 * "Llam" a sheet.
 */
export type SectionShape =
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

/** Category id to shape. Read out of the catalogue, not guessed. */
export const SHAPE_BY_CATEGORY: Record<number, SectionShape> = {
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

/** The shapes that are sold as a flat sheet, and so are written width x length x thickness. */
export function isSheet(shape: SectionShape): boolean {
  return shape === 'sheet';
}

export function shapeFromCode(code: string | null | undefined): SectionShape {
  const value = (code || '').trim().toLowerCase();
  if (!value) {
    return 'plain';
  }
  if (value.startsWith('ø') || value.startsWith('o ') || value.includes(' fi ') || value.includes('ø')) {
    return 'round-hollow';
  }
  if (value.startsWith('l-') || value.startsWith('l ')) {
    return 'angle';
  }
  if (/^(ipe|hea|heb|inp|hla|hlb)/.test(value)) {
    return 'ibeam';
  }
  if (value.startsWith('unp')) {
    return 'channel';
  }
  if (/(llam|zn|briz|flet|tabak|panel)/.test(value)) {
    return 'sheet';
  }
  return 'plain';
}

/**
 * The shape, from the category where it is known and from the code where it is not.
 *
 * `nearSquareWithWall` catches the one case the code cannot: a square tube whose code is just its
 * size, "10x10 x 1.3mm", where two sides match and a third number is much smaller.
 */
export function shapeFor(
  categoryId: number | null | undefined,
  code: string | null | undefined,
  width?: number | null,
  height?: number | null,
  thickness?: number | null
): SectionShape {
  const byCategory = categoryId ? SHAPE_BY_CATEGORY[categoryId] : undefined;
  if (byCategory) {
    // An I-beam category also holds channels, and the code is the only thing that separates them.
    if (byCategory === 'ibeam' && /^unp/i.test((code || '').trim())) {
      return 'channel';
    }
    return byCategory;
  }
  const byCode = shapeFromCode(code);
  if (byCode !== 'plain') {
    return byCode;
  }
  if (width && height && Math.abs(width - height) / Math.max(width, height) < 0.25 && thickness) {
    return 'rect-hollow';
  }
  return 'plain';
}
