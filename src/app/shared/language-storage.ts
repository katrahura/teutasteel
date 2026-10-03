export type SupportedLanguage = 'al' | 'en';

const LANGUAGE_KEY = 'language';

/**
 * Remembers the visitor's language across page loads. Without this every full
 * reload reset the site to Albanian (the Angular default), even for someone who
 * had just switched to English.
 *
 * Uses browser storage defensively so prerendering cannot throw.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getStoredLanguage(): SupportedLanguage | null {
  const value = storage()?.getItem(LANGUAGE_KEY);
  return value === 'al' || value === 'en' ? value : null;
}

export function setStoredLanguage(language: string): void {
  storage()?.setItem(LANGUAGE_KEY, language);
}
