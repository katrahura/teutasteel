import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { AdminContentComponent } from './admin-content.component';
import { provideTestConfig } from '../../../testing/test-providers';
import { AdminSessionService } from '../../../services/admin-session.service';
import { environment } from '../../../../environments/environment';

/** The service copy: what it sends, and what an editor may do (read, not write). */
describe('AdminContentComponent', () => {
  let fixture: ComponentFixture<AdminContentComponent>;
  let component: AdminContentComponent;
  let httpMock: HttpTestingController;

  const url = `${environment.apiUrl}/admin/content/services`;

  const row = (overrides: Record<string, string> = {}) => ({
    id: 'cnc', title_al: '', title_en: 'CNC cutting', description_al: '', description_en: '',
    image: '', alt_al: '', alt_en: '', position: '0', active: '1', ...overrides,
  });

  function create(canWrite: boolean) {
    TestBed.configureTestingModule({
      imports: [AdminContentComponent],
      providers: [
        provideTestConfig(),
        { provide: AdminSessionService, useValue: { can: () => canWrite, me: () => of({ capabilities: [] }) } },
      ],
    });
    fixture = TestBed.createComponent(AdminContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(url).flush({ services: [row()] });
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('shows a card for each service, with the shipped copy as the fallback', () => {
    create(true);
    expect(component.rows.length).toBe(1);
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('ADMIN.CONTENT_FALLBACK');
    expect((fixture.nativeElement as HTMLElement).querySelector('.content-card')).toBeTruthy();
  });

  it('saves one service and shows what came back', () => {
    create(true);
    component.rows[0].title_al = 'Prerje CNC';
    component.save(component.rows[0]);

    const put = httpMock.expectOne(url);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.services[0].title_al).toBe('Prerje CNC');
    put.flush({ services: [row({ title_al: 'Prerje CNC' })] });
    expect(component.saved).toBe('cnc');
  });

  it('gives an editor the copy without a way to save it', () => {
    create(false);
    expect(component.canWrite).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('.save')).toBeNull();
  });
});
