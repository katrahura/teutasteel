import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { provideTestConfig } from './testing/test-providers';
import { clearToken, getToken, setToken } from './services/token-storage';

describe('AppComponent', () => {
  beforeEach(async () => {
    clearToken();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideTestConfig()],
    }).compileComponents();
  });

  afterEach(() => clearToken());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose the application title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toEqual('teutasteel-website');
  });

  it('should render the navigation shell and the router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // One header, not two. This used to assert app-mobile-nav, a second bar that repeated the brand,
    // the language switch and a search box on every phone screen; the links live in this header now,
    // so the check follows them here rather than being deleted.
    expect(compiled.querySelector('header.nav nav.links')).toBeTruthy();
    expect(compiled.querySelectorAll('header.nav nav.links a').length).toBe(5);
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('offers the login control when signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoggedIn).toBeFalse();
    expect((fixture.nativeElement.querySelector('#nav-login') as HTMLElement).hidden).toBeFalse();
    expect((fixture.nativeElement.querySelector('#nav-logout') as HTMLElement).hidden).toBeTrue();
  });

  it('offers the logout control when a token is stored', () => {
    // Regression: the bar always offered "Login", so a signed-in administrator had
    // no way to sign out from the navigation.
    setToken('jwt-123');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoggedIn).toBeTrue();
    expect((fixture.nativeElement.querySelector('#nav-login') as HTMLElement).hidden).toBeTrue();
    expect((fixture.nativeElement.querySelector('#nav-logout') as HTMLElement).hidden).toBeFalse();
  });

  it('clears the token and returns to the login page on logout', () => {
    setToken('jwt-123');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const navigate = spyOn(TestBed.inject(Router), 'navigate');

    fixture.componentInstance.logout();

    expect(getToken()).toBeNull();
    expect(fixture.componentInstance.isLoggedIn).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
