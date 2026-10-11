import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsComponent } from './projects.component';
import { provideTestConfig } from '../../testing/test-providers';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [provideTestConfig()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows every project it has', () => {
    const cards = fixture.nativeElement.querySelectorAll('.project');
    expect(cards.length).toBe(component.projects.length);
    expect(cards.length).toBe(6);
    // The translation pipe answers with the key in a unit test, which is enough to prove the words
    // are wired up.
    expect(fixture.nativeElement.textContent).toContain('PROJECTS.P1_TITLE');
  });

  it('says on the page that these are examples', () => {
    // The pictures came from an image model and the text describes work that has not been done.
    // A gallery that does not say so is claiming something untrue.
    expect(component.sample).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('PROJECTS.SAMPLE_NOTE');
    expect(fixture.nativeElement.textContent).toContain('PROJECTS.INTRO');
  });

  it('leaves a slot, not a borrowed picture, where a job has no photograph', () => {
    // Standing a neighbouring photograph in for a job would say something untrue about it.
    const expecting = component.projects.filter((project) => project.images.length === 0);
    expect(expecting.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.awaiting').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('PROJECTS.PHOTO_TOMORROW');
  });

  it('lists what still has to be photographed, while these are samples', () => {
    // The briefs are the owner's shooting list: the page is a to-do as much as a gallery.
    expect(fixture.nativeElement.querySelectorAll('.photos ol').length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('PROJECTS.P1_PHOTO_2');
  });
});
