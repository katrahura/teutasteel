import { getStoredLanguage, setStoredLanguage } from './language-storage';

describe('language storage', () => {
  afterEach(() => localStorage.removeItem('language'));

  it('has nothing stored on a first visit', () => {
    expect(getStoredLanguage()).toBeNull();
  });

  it('remembers a supported language', () => {
    setStoredLanguage('en');
    expect(getStoredLanguage()).toBe('en');

    setStoredLanguage('al');
    expect(getStoredLanguage()).toBe('al');
  });

  it('ignores an unsupported value', () => {
    localStorage.setItem('language', 'de');
    expect(getStoredLanguage()).toBeNull();
  });
});
