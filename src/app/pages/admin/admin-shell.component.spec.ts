import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AdminShellComponent } from './admin-shell.component';
import { provideTestConfig } from '../../testing/test-providers';

/**
 * The panel's navigation is the server's list of capabilities, rendered.
 *
 * A tab shown to somebody who cannot use it teaches them to stop reading the tabs; a tab hidden
 * from somebody who can is a feature that does not exist for them. Both are checked here, per role.
 */
describe('AdminShellComponent', () => {
  function render(capabilities: string[]): { fixture: any; button: HTMLButtonElement } {
    TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [provideTestConfig()],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.endsWith('/admin/me')).flush({
      id: 1,
      username: 'ana',
      email: 'ana@example.test',
      role: capabilities.indexOf('users.manage') !== -1 ? 'admin' : 'editor',
      capabilities,
      can_enter_admin: capabilities.length > 0,
    });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;
    return { fixture, button };
  }

  function tabs(fixture: any): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.admin-tabs a'))
      .map((link) => (link as HTMLAnchorElement).getAttribute('href') || '');
  }

  it('shows an administrator every section', () => {
    const { fixture } = render([
      'products.read', 'products.write', 'products.delete', 'prices.write', 'prices.bulk',
      'imports.write', 'categories.read', 'categories.write', 'categories.delete', 'media.upload',
      'activity.read', 'settings.read', 'settings.write', 'users.manage',
    ]);
    const links = tabs(fixture);
    expect(links.length).toBe(6);
    expect(links).toContain('/admin/users');
    expect(links).toContain('/admin/settings');
    expect(links).toContain('/admin/overview');
  });

  it('shows an editor the catalogue, media and read-only settings - and no accounts tab', () => {
    const { fixture } = render([
      'products.read', 'products.write', 'prices.write', 'prices.bulk', 'imports.write',
      'categories.read', 'media.upload', 'activity.read', 'settings.read',
    ]);
    const links = tabs(fixture);
    expect(links).toContain('/admin/products');
    expect(links).toContain('/admin/categories');
    expect(links).toContain('/admin/media');
    expect(links).toContain('/admin/settings');
    expect(links).not.toContain('/admin/users');
  });

  it('shows an ordinary account no section at all', () => {
    const { fixture } = render([]);
    expect(tabs(fixture).length).toBe(0);
  });

  it('renders one navigation, so it cannot be shown twice', () => {
    const { fixture } = render(['products.read']);
    expect(fixture.nativeElement.querySelectorAll('.admin-tabs').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.menu-toggle').length).toBe(1);
    // The failure this replaces: at desktop width the drawer stayed visible beside the strip. The
    // strip must be a real, displayed navigation at this width, not a hidden one that never hides.
    const panel = fixture.nativeElement.querySelector('.admin-tabs') as HTMLElement;
    expect(getComputedStyle(panel).display).not.toBe('none');
    // And the phone button is the only thing the media query shows below 520px.
    expect(getComputedStyle(fixture.nativeElement.querySelector('.menu-toggle')).display).toBe('none');
  });

  it('opens the phone panel, closes it with Escape, and returns focus to the button', fakeAsync(() => {
    const { fixture, button } = render(['products.read']);
    const panel = fixture.nativeElement.querySelector('.admin-tabs') as HTMLElement;

    button.click();
    tick();
    fixture.detectChanges();
    expect(panel.classList.contains('open')).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    // At Karma's desktop width the button is `display: none`, and a hidden element cannot take
    // focus - so the intention is checked rather than the browser's refusal.
    const focus = spyOn(button, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panel.classList.contains('open')).toBeFalse();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(focus).toHaveBeenCalled();
  }));

  it('closes the phone panel when a tab is chosen', fakeAsync(() => {
    const { fixture, button } = render(['products.read']);
    const panel = fixture.nativeElement.querySelector('.admin-tabs') as HTMLElement;
    // The test router has no admin routes; the click is what this checks, not the navigation.
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));

    button.click();
    tick();
    fixture.detectChanges();
    expect(panel.classList.contains('open')).toBeTrue();

    (panel.querySelector('a') as HTMLAnchorElement).click();
    fixture.detectChanges();
    expect(panel.classList.contains('open')).toBeFalse();
  }));
});
