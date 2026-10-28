import { CanDeactivateFn } from '@angular/router';
export interface UnsavedWork { canLeave?: () => boolean; }
export const unsavedChangesGuard: CanDeactivateFn<UnsavedWork> = component => component.canLeave?.() ?? true;
