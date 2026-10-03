import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { UserDashboardComponent } from './user-dashboard.component';
import { provideTestConfig } from '../../testing/test-providers';
import { clearToken, setToken } from '../../services/token-storage';
import { environment } from '../../../environments/environment';

/** Builds an unsigned JWT; the payload is all the component reads. */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('UserDashboardComponent', () => {
  let component: UserDashboardComponent;
  let fixture: ComponentFixture<UserDashboardComponent>;

  beforeEach(async () => {
    clearToken();
    await TestBed.configureTestingModule({
      imports: [UserDashboardComponent],
      providers: [provideTestConfig()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => clearToken());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks the API for the profile named in the token', () => {
    setToken(fakeJwt({ id: 7, exp: 9999999999 }));
    const httpMock = TestBed.inject(HttpTestingController);

    const localFixture = TestBed.createComponent(UserDashboardComponent);
    localFixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/user/7`)
      .flush({ id: 7, username: 'endrit', email: 'endrit@teutasteel.com' });

    expect(localFixture.componentInstance.user?.username).toBe('endrit');
    expect(localFixture.componentInstance.failed).toBeFalse();
  });

  it('reports a failure when there is no usable token', () => {
    expect(component.user).toBeNull();
    expect(component.failed).toBeTrue();
  });

  it('reports a failure when the API rejects the request', () => {
    setToken(fakeJwt({ id: 9, exp: 9999999999 }));
    const httpMock = TestBed.inject(HttpTestingController);

    const localFixture = TestBed.createComponent(UserDashboardComponent);
    localFixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/user/9`)
      .flush('nope', { status: 401, statusText: 'Unauthorized' });

    expect(localFixture.componentInstance.failed).toBeTrue();
    expect(localFixture.componentInstance.user).toBeNull();
  });
});
