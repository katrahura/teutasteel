/**
 * Single place that touches the stored JWT, so server-side rendering
 * (prerender: true) can never throw "localStorage is not defined".
 */
const TOKEN_KEY = 'token';

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return browserStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string): void {
  browserStorage()?.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  browserStorage()?.removeItem(TOKEN_KEY);
}

/**
 * Reads the user id out of the stored JWT so a page can ask the API for the
 * signed-in profile.
 *
 * The token is signed, not encrypted, so the payload is readable here; it is
 * only used to choose which profile to request — the API still authorises the
 * request on its own.
 */
export function getTokenUserId(): number | null {
  const token = getToken();
  const payloadPart = token?.split('.')[1];
  if (!payloadPart) {
    return null;
  }
  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { id?: unknown };
    return typeof payload.id === 'number' ? payload.id : null;
  } catch {
    return null;
  }
}
