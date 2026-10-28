# Admin repairs — verification and handoff

Completed locally on 28 October 2026 following HARNESS-INDEPENDENT-ADMIN-REVIEW.md.

## Confirmed defects repaired

- **R1: lost price/variant updates.** Product versions now participate in SQLAlchemy optimistic concurrency checks. Changes to dimensions, translations and product images invalidate the parent product version from one shared before-flush hook, including bulk prices, single-price endpoints, reversals and thickness imports. Product saves flush atomically. A second writer receives a conflict instead of silently restoring old values. The legacy dimension-price endpoint also requires staff.
- **R2: stale bulk previews.** Preview signatures include actor, exact variant measurements and product versions, prices, currency, unit, selection and operation. A concurrent write between validation and commit is rejected by the version-checked flush. A retry is bound to its request fingerprint and account; matching retries replay the original result, while changed payloads/accounts receive conflicts. Database uniqueness races roll back and replay only a matching committed result. Preview responses no longer silently truncate the reviewed variant list at 500.
- **R3: image persistence.** Upload completion updates the editable URL fields that the save payload actually uses. Product, category and media upload flows share an abortable uploader, cancellation buttons, generation checks and file-type/size checks. Cancelled or obsolete responses cannot overwrite an image or clear a newer upload state. The stored image is retained until a successful assignment/save.
- **R4: unsaved changes.** Parent Close, Escape, Create, product selection and route navigation check the active editor before discarding it. Accepted child close events do not trigger a second prompt. New-product mode resets the reused editor correctly. Content/settings/category/media pages also guard unsaved work and browser unload. Service-content saved indicators clear when editing resumes.
- **R5: import preview binding.** Import apply requires a signature for the exact reviewed CSV and target versions. Changed files or records are rejected. Retrying a successful apply does not import twice. UTF-8 BOM is supported; missing/duplicate headers, mismatched columns, invalid data types, replacement/NUL characters, oversized input and non-finite measurements are rejected. Valid rows retain the existing documented partial-apply policy.

## Related corrections

- Account changes/logout invalidate cached capabilities; cached identity is tied to the current token.
- Authenticated product loads/saves return the current category so the editor selects it correctly.
- Category thumbnails request a bounded optimized Cloudinary rendition while preserving original references.
- Settings messaging now states that browser-fetched business values do not automatically replace static metadata during an ordinary rebuild. A deliberate metadata update is needed for that static content.
- Admin AL/EN controls now update the translation service and remembered language.
- Conflict/validation notices occupy their own space above the form instead of squeezing it into a second column.

## Verification

- Full backend suite: **276 passed**, using temporary SQLite test databases. Existing deprecation warnings remain.
- Full frontend suite: **263 passed**. The final run includes eleven new regression checks; Chrome's shutdown warning occurred after all tests passed and the command exited successfully.
- Final production build: **passed**, **26 prerendered routes**. Existing non-blocking stylesheet/localize/Bootstrap selector warnings remain; no budget increased.
- A real two-tab test against a disposable local API: tab B saved a new product code; tab A's older save showed the conflict, retained its attempted code and did not replace tab B's saved record.
- Database-level overlapping sessions and a write injected between preview validation and commit are covered by regression tests. This goes beyond sequential stale-save tests.
- Product editor showed the correct current category in the browser.
- Parent Close showed the unsaved-change confirmation. Keeping the draft on a declined discard is verified in automated regressions; browser confirmation handling was not used as evidence of a declined choice.
- Admin language switching visibly translated the interface to English. At 320px, Tab reached the admin menu, Enter opened it and moved focus to Overview, and Escape closed it and restored focus with a visible outline. No page-wide overflow in that checked view.
- At 390px, a 2mm multi-variant product ×2 and a 2mm single-variant product ×3 reached one enquiry with the correct exact lines and a EUR 52 subtotal. The temporary enquiry was cleared afterward; no WhatsApp message was sent.
- Upload-save payloads, cancelled XHR, late upload responses, failed-save value retention, dirty navigation, import binding and account switching are covered by regression tests. A real external Cloudinary upload/cancellation was not staged because the disposable API has no upload preset. Account-level Cloudinary settings were not changed.

## Evidence

The chat outputs folder contains admin-fixes-backend-final.log, admin-fixes-frontend-final.log, admin-fixes-build-final.log, admin-fixed-mobile.png, admin-fixed-conflict.png and admin-fixes-enquiry.png. The earlier conflict screenshot predates the small layout correction; the corrected layout source is included in the final build.

## Rollout and continuation

- Application changes remain uncommitted in the existing frontend/backend checkouts, preserving Harness's earlier commits. Nothing was pushed or deployed. Real application data and production configuration were not changed.
- No new migration is required by these repairs. Harness's existing migrations for product versions, units, category labels and bulk applications are still prerequisites on a target database; this work did not apply them to a shared/production database.
- Release the backend and frontend together in a coordinated window. The new backend intentionally refuses an old frontend's unbound import apply; an old import form must be refreshed onto the new frontend before use. Preview signatures from an older backend are no longer valid and must be regenerated.
- Persist and protect the existing application secret as before. No new external service or credential is required.
- Original Harness limitations about static metadata, external upload configuration and physical-device testing remain relevant. This repair does not claim that every feature in phases 0–8 has been manually certified.
