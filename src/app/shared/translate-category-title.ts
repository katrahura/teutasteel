import { TranslateService } from '@ngx-translate/core';

/**
 * Category titles are stored in the database in one language; `CATEGORY.*`
 * entries in a translation file map them for that language.
 *
 * The lookup reads the loaded table for the *current* language directly instead
 * of `instant()`, because `instant()` falls back to the default language: with
 * English selected it returned the Albanian entry from `al.json` (the default
 * language) rather than the stored English title.
 *
 * Falling back to the stored title also keeps a brand new category readable
 * instead of showing the raw "CATEGORY.SOME_NEW_CATEGORY" key.
 */
export function translateCategoryTitle(
  translate: TranslateService,
  category: { title?: string; title_en?: string | null } | null | undefined
): string {
  const title = category?.title ?? '';
  if (!title) {
    return '';
  }

  const language = translate.currentLang || translate.getDefaultLang();

  // A label the owner wrote for this language in the panel wins over the static mapping. English
  // only for now: the stored title is the Albanian one, and `title_en` is the override.
  if (language === 'en' && category?.title_en && category.title_en.trim()) {
    return category.title_en.trim();
  }

  const tables = translate.translations as
    | Record<string, { CATEGORY?: Record<string, unknown> }>
    | undefined;
  const mapped = tables?.[language]?.CATEGORY?.[title.toUpperCase().replace(/ /g, '_')];

  return typeof mapped === 'string' && mapped.length > 0 ? mapped : title;
}
