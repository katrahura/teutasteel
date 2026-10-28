import { getStoredLanguage } from './language-storage';
export function confirmUnsaved(dirty: boolean): boolean {
  if (!dirty || typeof window === 'undefined') return true;
  return window.confirm(getStoredLanguage() === 'en'
    ? 'Discard your unsaved changes?'
    : 'Të hidhen poshtë ndryshimet e paruajtura?');
}
