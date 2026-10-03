import { TranslateService } from '@ngx-translate/core';
import { translateCategoryTitle } from './translate-category-title';

/**
 * A minimal stand-in for TranslateService: the helper reads the loaded tables
 * directly, which is what these tests pin down.
 */
function translateStub(
  currentLang: string,
  tables: Record<string, unknown>
): TranslateService {
  return {
    currentLang,
    getDefaultLang: () => 'al',
    translations: tables,
  } as unknown as TranslateService;
}

describe('translateCategoryTitle', () => {
  const tables = {
    al: { CATEGORY: { DOOR_SHEETS: 'Pllaka dere' } },
    en: {},
  };

  it('uses the CATEGORY entry of the active language', () => {
    expect(
      translateCategoryTitle(translateStub('al', tables), { title: 'Door Sheets' })
    ).toBe('Pllaka dere');
  });

  it('does not fall back to another language when the active one has no entry', () => {
    // Regression: instant() falls back to the default language, so English used
    // to display the Albanian string from al.json.
    expect(
      translateCategoryTitle(translateStub('en', tables), { title: 'Door Sheets' })
    ).toBe('Door Sheets');
  });

  it('falls back to the stored title for a category with no entry at all', () => {
    // Regression: the products page used to render "CATEGORY.BRAND_NEW".
    expect(
      translateCategoryTitle(translateStub('al', tables), { title: 'Brand New' })
    ).toBe('Brand New');
  });

  it('handles empty input', () => {
    const translate = translateStub('al', tables);
    expect(translateCategoryTitle(translate, null)).toBe('');
    expect(translateCategoryTitle(translate, {})).toBe('');
  });
});
