import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';

import { AdminMe, AdminService } from './admin.service';

/**
 * Who is signed in, and what the server says they may do.
 *
 * Asked once and remembered: the shell asks for every tab, and a request per tab would tell the server
 * the same thing six times. It is not a permission: a forged copy in the browser buys nothing, because
 * every route checks again on the server.
 */
@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private admin = inject(AdminService);
  private cached: Observable<AdminMe> | null = null;
  private current: AdminMe | null = null;

  /** The answer, asked once. */
  me(): Observable<AdminMe> {
    if (!this.cached) {
      this.cached = this.admin.getMe().pipe(
        tap((answer) => { this.current = answer; }),
        shareReplay(1)
      );
    }
    return this.cached;
  }

  /** What the last answer said, without asking again. */
  peek(): AdminMe | null {
    return this.current;
  }

  can(capability: string): boolean {
    const answer = this.current;
    if (!answer || !answer.capabilities) {
      return false;
    }
    return answer.capabilities.indexOf(capability) !== -1;
  }

  canEnterAdmin(): boolean {
    return !!(this.current && this.current.can_enter_admin);
  }

  isSignedIn(): boolean {
    return this.current !== null;
  }

  /** After signing in or out, the old answer is not evidence of anything. */
  forget(): void {
    this.cached = null;
    this.current = null;
  }
}
