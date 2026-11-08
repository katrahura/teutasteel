# Translation audit — 8 November 2026

Scope: the Angular translation tables (`src/assets/i18n/al.json`, `en.json`), template/component
strings, and the live catalogue content returned by the public API.

## Summary

The interface translations are structurally complete. The catalogue content is not: **936 of 1,346
products have no English description**, and 238 more repeat the Albanian text (most of those are just
a product code such as `R1` or `08252`). This is missing source content, not a broken translation
lookup.

## What was checked

- Key parity for every nested key in both JSON files.
- Empty values.
- Interpolation placeholders (`{{…}}`, `%s`, `{name}`) and HTML tag balance.
- Keys used literally in templates/components that are absent from the tables.
- Duplicate JSON keys.
- Hard-coded user-facing text in templates and components.
- Live category titles in Albanian and English (43 categories).
- Live product translation rows (1,346 reachable products).

## Fixed in this pass

| Issue | Fix |
|---|---|
| `ADMIN.CATEGORY_CREATE` was used by the create-category button but defined in neither language | Added “Krijo kategori” / “Create category”; the button no longer renders a raw key |
| Product editor required-category message was hard-coded English | Uses `ADMIN.CHOOSE_CATEGORY` |
| Product-editor save fallback was hard-coded English | Uses `PRODUCTS.SAVE_FAILED` |
| Three create-product alerts were hard-coded English | Uses `MISC.CHOOSE_A_CATEGORY_FIRST`, `MISC.ADD_DIMENSION_FIRST`, `MISC.ADD_TRANSLATION_FIRST` (new keys) |
| Albanian unsaved-work text said “të paruajtura” | Corrected to “të pa ruajtura” in the string table and the confirm prompt |
| English category table missed 37 fallback keys present in Albanian | Added English values, including door, mesh, handrail and decorative-iron labels |
| No automated guard against this class of defect | Added `npm run check:i18n`, which fails on missing keys, empty values, placeholder mismatch, or a key used but not translated |

`npm run check:i18n` passes: **868 keys in both languages**, no empty values or placeholder mismatches.

## Catalogue content — the real gap

| Measure | Count |
|---|---:|
| Reachable products | 1,346 |
| No translation rows at all | 2 (`4212`, `4214`) |
| English description empty | 934 |
| English description identical to the Albanian | 238 |
| Products with a distinct non-empty English description | **172** |

Most of the 238 “identical” cases are code-only descriptions (`R1`, `08252`, `10x100cm`), so they are
not wrong translations; they are missing product copy in both languages. The 934 empty rows are the
same problem at scale.

Category titles are covered: 41 categories are stored in English and mapped to Albanian; categories
111 and 112 store Albanian titles with `title_en` values, so both languages render correctly.

## Intentional identical labels

These are correct as they are: `Media`, `Kilogram`, `Slug`, `Tel`, the `Unsigned` Cloudinary option,
and product codes such as `TEST1234`. Proper names (`Teuta Steel`, `WhatsApp`, `CNC`, `SHELVES` etc.)
are not translated.

## Not a translation defect, but relevant

- English has no separate URL; the language switch is stored in `localStorage`. Search engines see the
  Albanian default. This is the language-URL/`hreflang` project in the release plan, not a string fix.
- Product/category page titles remain the generic “Produkte” title, so product names do not appear in
  search snippets. This needs clean product URLs and server rendering.
- The Albanian and English pages share the same database content; editing a product in one language
  does not create a translation for the other.

## Release impact

- Interface: **ready** from a translation perspective; parity check is green.
- Catalogue text: **not complete**. Decide in the production data gate whether to launch with empty
  product descriptions (the layout already handles them) and finish the 936 items afterwards.
- To fix product text properly, the owner needs to supply/write English descriptions, or approve a
  reviewed translation pass; do not machine-generate 900 pages without review.

## Commands

```powershell
npm run check:i18n
npx ng test --watch=false --browsers=ChromeHeadless   # 275 passed
npx ng build                                          # 27 routes
```
