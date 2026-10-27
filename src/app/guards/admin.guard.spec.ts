import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { adminGuard } from './admin.guard';
import { AdminSessionService } from '../services/admin-session.service';

/**
 * The guard has three outcomes and they must stay three.
 *
 * A test that only checked "allowed or not" would pass while the panel sent a signed-in editor to the
 * login page, which is the shape of a redirect loop.
 */
describe('adminGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;

  function run(session: any, token: string | null): Promise<boolean | UrlTree> {
    if (token === null) {
      localStorage.removeItem('token');
    } else {
      localStorage.setItem('token', token);
    }
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AdminSessionService, useValue: session }],
    });
    return TestBed.runInInjectionContext(() =>
      firstValueFrom(adminGuard(route, state('/admin/products')) as Observable<boolean | UrlTree>)
    ) as Promise<boolean | UrlTree>;
  }

  afterEach(() => localStorage.removeItem('token'));

  it('sends a visitor with no token to sign in, and remembers where they were going', async () => {
    const result = await run({ me: () => of({ can_enter_admin: true }), forget: () => undefined }, null);
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toContain('/login');
    expect((result as UrlTree).toString()).toContain('returnUrl');
  });

  it('lets an editor through when the server says they may enter', async () => {
    const result = await run(
      { me: () => of({ can_enter_admin: true, capabilities: ['products.read'] }), forget: () => undefined },
      'a-token'
    );
    expect(result).toBeTrue();
  });

  it('sends a signed-in account without capabilities to the forbidden page, not to the login page', async () => {
    const result = await run(
      { me: () => of({ can_enter_admin: false, capabilities: [] }), forget: () => undefined },
      'a-token'
    );
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toContain('forbidden');
    expect((result as UrlTree).toString()).not.toContain('login');
  });

  it('treats an expired session as "sign in again" and forgets the stale answer', async () => {
    let forgotten = false;
    const result = await run(
      {
        me: () => throwError(() => ({ status: 401 })),
        forget: () => { forgotten = true; },
      },
      'expired'
    );
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toContain('/login');
    expect(forgotten).toBeTrue();
  });

  it('does not blame the session when the server cannot be reached', async () => {
    const result = await run(
      { me: () => throwError(() => ({ status: 0 })), forget: () => undefined },
      'a-token'
    );
    expect(result).toBeTrue();
  });
});
