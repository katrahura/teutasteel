/**
 * Single place that touches browser storage, so server-side rendering
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
