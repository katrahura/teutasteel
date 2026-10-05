import {
  STEEL_KG_PER_MM2_PER_M,
  crossSectionArea,
  describeWeight,
  shapeForCategory,
  weightPerMetre,
  weightPerSheet,
} from './steel-weight';

describe('steel weight', () => {
  // Hand-checked against a mill's own table where one exists. Steel is 7,850 kg/m3, so a section of
  // A mm2 weighs A x 0.00785 kg/m, and the corner rounding a mill's table includes is what separates
  // the two figures - a few per cent, never more.
  it('weighs a round tube as an annulus', () => {
    // pi x (60 - 2) x 2 = 364.42 mm2, and a 60.3 x 2 CHS is listed at 2.87 kg/m.
    expect(crossSectionArea('round', { height: 60, thickness: 2 })).toBeCloseTo(364.42, 1);
    expect(weightPerMetre('round', { height: 60, thickness: 2 })).toBe(2.86);
  });

  it('weighs a square tube by its perimeter', () => {
    // 2 x (40 + 40 - 4) x 2 = 304 mm2. The mill's table says 2.31 kg/m, because its corners are
    // rounded and this assumes they are not.
    expect(crossSectionArea('rectangular', { height: 40, width: 40, thickness: 2 })).toBe(304);
    expect(weightPerMetre('rectangular', { height: 40, width: 40, thickness: 2 })).toBe(2.39);
  });

  it('weighs a rectangular tube with unequal sides', () => {
    expect(crossSectionArea('rectangular', { height: 80, width: 40, thickness: 3 })).toBe(
      2 * (80 + 40 - 6) * 3
    );
  });

  it('weighs a flat bar exactly', () => {
    // A 40 x 5 flat bar is listed at 1.57 kg/m, and this agrees to the penny.
    expect(weightPerMetre('flat', { width: 40, thickness: 5 })).toBe(1.57);
  });

  it('weighs an angle by its two legs less the corner', () => {
    // (30 + 30 - 3) x 3 = 171 mm2; the table for a 30x30x3 angle says 1.36 kg/m.
    expect(crossSectionArea('angle', { height: 30, width: 30, thickness: 3 })).toBe(171);
    expect(weightPerMetre('angle', { height: 30, width: 30, thickness: 3 })).toBe(1.34);
  });

  it('weighs a whole sheet, not a metre of one', () => {
    // 1000 x 2000 x 1.2 mm = 2.4 million mm3, and a 1.2 mm sheet that size is 18.84 kg.
    expect(weightPerSheet({ width: 1000, length: 2000, thickness: 1.2 })).toBe(18.84);
  });

  it('uses the density it is given', () => {
    expect(STEEL_KG_PER_MM2_PER_M).toBe(0.00785);
    expect(crossSectionArea('flat', { width: 100, thickness: 10 })).toBe(1000);
  });

  describe('refuses to guess', () => {
    it('gives nothing without a thickness', () => {
      expect(weightPerMetre('flat', { width: 40 })).toBeNull();
      expect(weightPerMetre('rectangular', { height: 40, width: 40 })).toBeNull();
    });

    it('gives nothing for a wall thicker than the section could hold', () => {
      // A 60 mm tube cannot have a 40 mm wall: it would be solid, and the formula would go negative.
      expect(weightPerMetre('round', { height: 60, thickness: 40 })).toBeNull();
      expect(weightPerMetre('rectangular', { height: 40, width: 40, thickness: 25 })).toBeNull();
    });

    it('gives nothing for zero or missing numbers', () => {
      expect(weightPerMetre('flat', { width: 0, thickness: 5 })).toBeNull();
      expect(weightPerMetre('flat', { width: 40, thickness: 0 })).toBeNull();
      expect(weightPerSheet({ width: 1000, length: 0, thickness: 1 })).toBeNull();
      expect(weightPerMetre('flat', { width: null, thickness: null })).toBeNull();
    });

    it('gives nothing for a shape it does not know', () => {
      expect(weightPerMetre('unknown', { height: 100, width: 50, thickness: 5 })).toBeNull();
      expect(describeWeight('unknown', { height: 100 })).toBeNull();
    });
  });

  describe('reading the shape from the category', () => {
    it('knows the shop\'s categories', () => {
      expect(shapeForCategory('Round tubes')).toBe('round');
      expect(shapeForCategory('Square & rectangular tubes')).toBe('rectangular');
      expect(shapeForCategory('Flat bars (SHP)')).toBe('flat');
      expect(shapeForCategory('Angles (L-Profil)')).toBe('angle');
      expect(shapeForCategory('Steel sheets (black, galvanised, ribbed)')).toBe('sheet');
    });

    it('says nothing about a category it does not recognise', () => {
      // Decorative metal and laser sheets are not sections, and a weight for them would be fiction.
      expect(shapeForCategory('Motifs')).toBe('unknown');
      expect(shapeForCategory('Decorative metal')).toBe('unknown');
      expect(shapeForCategory(null)).toBe('unknown');
      expect(shapeForCategory(undefined)).toBe('unknown');
    });
  });

  it('describes the answer the way a customer reads it', () => {
    expect(describeWeight('flat', { width: 40, thickness: 5 })).toBe('1.57 kg/m');
    expect(describeWeight('sheet', { width: 1000, length: 2000, thickness: 1.2 })).toBe('18.84 kg');
    expect(describeWeight('flat', { width: 40 })).toBeNull();
  });
});
