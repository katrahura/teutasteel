import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { AdminCategoriesComponent } from './admin-categories.component';
import { provideTestConfig } from '../../../testing/test-providers';
import { AdminSessionService } from '../../../services/admin-session.service';
import { environment } from '../../../../environments/environment';

/**
 * The category tree: what it shows, what a collapse hides, and what a save sends.
 *
 * The figures matter here because they are the reason the switch is safe to press: "this hides N
 * products in M categories" has to be the truth, not a decoration.
 */
describe('AdminCategoriesComponent', () => {
  let fixture: ComponentFixture<AdminCategoriesComponent>;
  let component: AdminCategoriesComponent;
  let httpMock: HttpTestingController;

  const categoriesUrl = `${environment.apiUrl}/category/`;

  const categories = () => [
    { id: 1, title: 'Tubes', title_en: 'Tubes', is_active: true, parent_id: null,
      product_total: 10, descendant_count: 2 },
    { id: 2, title: 'Round tubes', title_en: null, is_active: true, parent_id: 1,
      product_total: 6, descendant_count: 1 },
    { id: 3, title: 'Thin round', title_en: null, is_active: false, parent_id: 2,
      product_total: 2, descendant_count: 0 },
    { id: 4, title: 'Profiles', title_en: null, is_active: false, parent_id: null,
      product_total: 4, descendant_count: 0 },
    { id: 5, title: 'Angles', title_en: null, is_active: true, parent_id: 3,
      product_total: 1, descendant_count: 0 },
  ];

  function create(canWrite: boolean) {
    TestBed.configureTestingModule({
      imports: [AdminCategoriesComponent],
      providers: [
        provideTestConfig(),
        {
          provide: AdminSessionService,
          useValue: { can: () => canWrite, me: () => of({ capabilities: canWrite ? ['categories.write'] : [] }) },
        },
      ],
    });
    fixture = TestBed.createComponent(AdminCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne((req) => req.url.startsWith(categoriesUrl)).flush(categories());
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('shows the tree with groups first, then their sections', () => {
    create(true);
    const titles = component.rows.map((row) => row.category.title);
    expect(titles).toEqual(['Profiles', 'Tubes', 'Round tubes', 'Thin round', 'Angles']);
    // Alphabetical inside a level; the sections sit under their group.
    expect(component.rows.find((row) => row.category.title === 'Round tubes')!.depth).toBe(1);
  });

  it('hides a collapsed group’s sections and brings them back', () => {
    create(true);
    component.toggleCollapse(component.all.find((c) => c.id === 1)!);
    expect(component.visibleRows.map((row) => row.category.title)).toEqual(['Profiles', 'Tubes']);
    component.toggleCollapse(component.all.find((c) => c.id === 1)!);
    expect(component.visibleRows.length).toBe(5);
  });

  it('says when an enabled category is hidden by a switched-off ancestor', () => {
    create(true);
    const angles = component.rows.find((row) => row.category.title === 'Angles')!;
    expect(component.hiddenBy(angles)!.title).toBe('Thin round');
    const rounds = component.rows.find((row) => row.category.title === 'Round tubes')!;
    expect(component.hiddenBy(rounds)).toBeNull();
  });

  it('finds a category by either label', () => {
    create(true);
    component.search = 'angles';
    expect(component.visibleRows.length).toBe(1);
    component.search = 'tubes';
    expect(component.visibleRows.map((row) => row.category.title))
      .toContain('Round tubes');
  });

  it('creates a category with both labels and its parent', () => {
    create(true);
    component.startNew(component.all.find((c) => c.id === 1)!);
    component.editing!.title = 'Square tubes';
    component.editing!.title_en = 'Square tubes';
    component.save();

    const post = httpMock.expectOne((req) => req.method === 'POST'
      && req.url.endsWith('/category/create'));
    expect(post.request.body.title).toBe('Square tubes');
    expect(post.request.body.title_en).toBe('Square tubes');
    expect(post.request.body.parent_id).toBe(1);
    post.flush({ id: 9, title: 'Square tubes', is_active: true, parent_id: 1 });
    // The table is read again after a save.
    httpMock.expectOne((req) => req.url.startsWith(categoriesUrl)).flush(categories());
  });

  it('refuses to file a category under itself or one of its own sections', () => {
    create(true);
    component.edit(component.rows.find((row) => row.category.id === 1)!);
    const options = component.parentOptions.map((option) => option.label);
    expect(options).not.toContain('Tubes');
    expect(options).not.toContain('Round tubes');
    expect(options).not.toContain('Thin round');
    expect(options).toContain('Profiles');
  });

  it('says what switching a branch off would hide', () => {
    create(true);
    component.edit(component.rows.find((row) => row.category.id === 1)!);
    // Before the edit, the branch is on and holds ten products in two categories.
    expect(component.impact).toEqual({ products: 10, categories: 2 });
  });

  it('switches visibility without deleting anything', () => {
    create(true);
    const profiles = component.all.find((c) => c.id === 4)!;
    component.toggle(profiles);
    const put = httpMock.expectOne((req) => req.method === 'PUT'
      && req.url.includes('/category/without-products/4'));
    expect(put.request.body.is_active).toBeTrue();
    put.flush({ id: 4, title: 'Profiles', is_active: true });
    httpMock.expectOne((req) => req.url.startsWith(categoriesUrl)).flush(categories());
  });

  it('shows an editor a read-only tree, with no way to start an edit', () => {
    create(false);
    component.startNew();
    expect(component.editing).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.new-category')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.CATEGORIES_READ_ONLY');
  });
});
