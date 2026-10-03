import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { LoginComponent } from './login.component';
import { provideTestConfig } from '../../testing/test-providers';
import { clearToken } from '../../services/token-storage';
import { environment } from '../../../environments/environment';

/** Builds an unsigned JWT; the payload is all the app reads from it. */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;
  let router: { navigate: jasmine.Spy };

  beforeEach(async () => {
    clearToken();
    router = { navigate: jasmine.createSpy('navigate') };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      // the Router stub has to come after the shared providers to win
      providers: [provideTestConfig(), { provide: Router, useValue: router }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => clearToken());

  function signIn(username: string, password: string, id: number) {
    component.loginForm.setValue({ username, password });
    component.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ access_token: fakeJwt({ id, exp: 9999999999 }) });
    return id;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends an admin to the admin dashboard', () => {
    // Regression: the role routing was commented out, so a successful login left
    // the visitor on the login page.
    const id = signIn('admin', 'adminpass', 1);
    httpMock.expectOne(`${environment.apiUrl}/user/${id}`)
      .flush({ id, username: 'admin', role: 'admin' });

    expect(component.role).toBe('admin');
    expect(router.navigate).toHaveBeenCalledWith(['/admin-dashboard']);
  });

  it('sends a regular user to the user dashboard', () => {
    const id = signIn('editor', 'editorpass', 2);
    httpMock.expectOne(`${environment.apiUrl}/user/${id}`)
      .flush({ id, username: 'editor', role: 'user' });

    expect(router.navigate).toHaveBeenCalledWith(['/user-dashboard']);
  });

  it('stays put and reports the failure when the credentials are rejected', () => {
    component.loginForm.setValue({ username: 'admin', password: 'wrong' });
    component.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush('nope', { status: 401, statusText: 'Unauthorized' });

    expect(component.errorMessage).toBe('LOGIN.INVALID');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
