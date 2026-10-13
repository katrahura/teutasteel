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
    Object.assign(component, inputs);
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
    expect(build({ categoryId: 136, width: 80, height: 46, code: 'IPE-80' }).textContent)
      .toContain('IPE-80 · 80 × 46');
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
});
