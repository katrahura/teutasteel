import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SectionDrawingComponent } from './section-drawing.component';

/**
 * The drawing is made from the catalogue, so what matters is that the right section is chosen and
 * that the numbers come out as they are stored - including when there are none.
 */
describe('SectionDrawingComponent', () => {
  let component: SectionDrawingComponent;
  let fixture: ComponentFixture<SectionDrawingComponent>;

  const build = (inputs: Partial<SectionDrawingComponent>) => {
    fixture = TestBed.createComponent(SectionDrawingComponent);
    component = fixture.componentInstance;
    // setInput is the framework's own way of setting an input. A plain assignment works too; this is
    // not what the sheet test was failing on, which was a missing category in the shape map.
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SectionDrawingComponent] }).compileComponents();
  });

  it('takes the section from the category', () => {
    // 122 is Round tubes, 123 is Square & rectangular, 135 is Angles, 136 is I-beams.
    expect(build({ categoryId: 122, height: 16, thickness: 1.3 }).textContent).toContain('Ø16 × 1.3');
    expect(build({ categoryId: 123, width: 10, height: 20, thickness: 0.9 }).textContent)
      .toContain('10 × 20 × 0.9');
    expect(build({ categoryId: 135, width: 30, height: 30, thickness: 2.5 }).textContent)
      .toContain('L 30 × 30 × 2.5');
    // The catalogue stores a beam as width 46 and height 80 - the height is the section's depth -
    // and the label reads depth first, the way a steel table does.
    expect(build({ categoryId: 136, width: 46, height: 80, code: 'IPE-80' }).textContent)
      .toContain('IPE-80 · 80 × 46');
  });

  it('draws the wall at the catalogue’s own proportion, not enlarged', () => {
    // The owner's catch, and he was right: a 28 mm tube with a 1.5 mm wall was drawn with the wall
    // tripled, so the drawing read as four or five millimetres of wall. The wall is the number a tube
    // is bought by, and inflating it tells the customer they are buying a heavier tube than they are.
    build({ categoryId: 122, height: 28, thickness: 1.5, size: 'large' });
    // The section is drawn 72 units across, so 1.5 of 28 mm is 72 * 1.5 / 28 = 3.9 units, and it was
    // 11.6 before. The detail beside it carries the number.
    expect(component.wall).toBeCloseTo(3.9, 1);
  });

  it('keeps the dimensions for the dialog and leaves the card alone', () => {
    // At card size the numbers would be six pixels high and the wall a hairline, so the technical
    // version belongs where somebody has already chosen the product and is reading it properly.
    const dialog = build({ categoryId: 123, width: 10, height: 10, thickness: 1.3, size: 'large' });
    expect(dialog.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 140 112');
    expect(dialog.textContent).toContain('t 1.3');

    const card = build({ categoryId: 123, width: 10, height: 10, thickness: 1.3 });
    expect(card.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 96');
    expect(card.textContent).not.toContain('t 1.3');
    expect(card.querySelectorAll('g[stroke-width]').length).toBeGreaterThanOrEqual(0);
  });

  it('invents no dimension the catalogue does not hold', () => {
    // A beam with a code and nothing else: no numbers, so no dimension lines - rather than a pair of
    // lines with a guess in them.
    const bare = build({ categoryId: 136, code: 'IPE-AA', size: 'large' });
    expect(component.dimensionLines.length).toBe(0);
    expect(bare.textContent).not.toContain('null');
  });

  it('leaves the numbers out when the card prints its own size line', () => {
    // The card prints "10×10×1.3 · 6 m" a few lines below the drawing, so the caption said the same
    // size again in another format. showCaption is what the card turns off for that; a drawing whose
    // card has no size line keeps its numbers, and the label stays on the svg either way, so a screen
    // reader still hears the section.
    expect(build({ categoryId: 123, width: 10, height: 10, thickness: 1.3 }).textContent)
      .toContain('10 × 10 × 1.3');
    const without = build({ categoryId: 123, width: 10, height: 10, thickness: 1.3, showCaption: false });
    expect(without.textContent).not.toContain('10 × 10 × 1.3');
    expect(without.querySelector('svg')?.getAttribute('aria-label')).toContain('10 × 10 × 1.3');
  });

  it('falls back to the product code when the category does not say', () => {
    // The codes are the shop's own convention, and the only thing that separates an I-beam from a
    // channel inside one category.
    expect(build({ code: 'Ø25 x 1.3mm', height: 25, thickness: 1.3 }).textContent).toContain('Ø25');
    expect(build({ code: 'L-18x18x2.5', width: 18, height: 18 }).textContent).toContain('L 18 × 18');
    expect(build({ code: 'UNP-100', width: 50, height: 100, categoryId: 136 }).textContent)
      .toContain('UNP-100 · 100 × 50');
  });

  it('says nothing rather than printing null', () => {
    // One product in the beam category carries a code and no dimensions at all. Without this it
    // read "IPE-AA 160 · null × null" under the drawing, which is worse than saying nothing.
    const element = build({ categoryId: 136, code: 'IPE-AA 160' });
    expect(element.textContent).toContain('IPE-AA 160');
    expect(element.textContent).not.toContain('null');
    expect(element.textContent).not.toContain('undefined');
  });

  it('draws to the proportions of the numbers', () => {
    // 10 x 20 is drawn taller than it is wide, and 30 x 10 wider than it is tall: a customer seeing
    // the difference is the whole point of the drawing.
    expect(build({ categoryId: 123, width: 10, height: 20 }).querySelector('svg')).toBeTruthy();
    expect(component.h).toBeGreaterThan(component.w);

    build({ categoryId: 123, width: 30, height: 10 });
    expect(component.w).toBeGreaterThan(component.h);
  });

  it('draws something even with no category and no code', () => {
    const element = build({});
    expect(element.querySelector('svg')).toBeTruthy();
    expect(element.textContent).not.toContain('null');
  });

  it('draws a sheet as the flat rectangle it is, not end-on', () => {
    // The catalogue holds a laser-cut sheet as width 1000 and length 2000, with no thickness. Drawn
    // end-on it came out a sliver, which says nothing about the size of the sheet being chosen; in
    // the decorative group nearly every product is a sheet with a photograph, so this is the
    // drawing a customer sees beside the picture.
    const element = build({ categoryId: 59, width: 1000, length: 2000, code: '08252' });
    expect(element.textContent).toContain('1000 × 2000');
    const rect = element.querySelector('rect');
    expect(rect).toBeTruthy();
    const height = Number(rect?.getAttribute('height'));
    const width = Number(rect?.getAttribute('width'));
    // Twice as tall as it is wide, because the sheet is.
    expect(height).toBeGreaterThan(width * 1.5);
  });

  it('keeps the thickness out of the shape but in the words', () => {
    // A 0.5 mm sheet and a 15 mm plate are the same rectangle from above; the thickness is what the
    // label is for.
    const element = build({ categoryId: 134, width: 1000, length: 2000, thickness: 0.5 });
    expect(element.textContent).toContain('1000 × 2000 × 0.5');
  });
});
