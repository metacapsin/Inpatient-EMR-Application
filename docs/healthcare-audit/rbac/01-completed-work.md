# RBAC: Completed Work

Date: 2026-11-13. Phase 1, module 3. Approved scope implemented in full; no external blocker.

## Summary for stakeholders

Two gaps closed. First, read-side gating: clinical notes, labs, medications, problems, allergies/history/documents, the nursing flowsheet, the CDI (coding/denials) inbox, and the ADT notification log could previously be read by any authenticated staff role regardless of job function — a billing clerk could read clinical notes, a nurse could read the CDI inbox. Each of those `GET` routes now requires the roles that actually need that data for their job (e.g. clinical notes: physician/nurse/staff; CDI inbox: billing/physician; ADT log: admin/staff). Second, action-side gating: an **admin** account — a system-administration role, not a clinical license — could previously sign a clinical note, acknowledge a critical lab result, sign or transmit a prescription, dispense via the MAR, complete medication reconciliation, sign a discharge summary, or flag a critical radiology finding. All seven of those clinical-attestation actions now require an actual clinical role (physician/nurse/pharmacist depending on the action); an admin gets a clear 403 explaining why. On top of that, the self-service profile endpoint could previously be used by any staff member to set their own NPI/DEA number — now only an administrator can set those fields, via the user-management screen. Two new frontend pieces: a `RoleGuard` component that hides a route (CDI Worklist) and two nav links (CDI Worklist, Care notifications) from roles that can't use them, matching what the backend now enforces.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Clinical notes reads | SEC-04 | `GET` note-list/note-detail routes in `clinicalNotes.js` now require physician/nurse/staff (was: any authenticated role) |
| 2 | Labs reads | SEC-04 | 3 `GET` routes in `labs.js` (orders, results, critical worklist) now require physician/nurse/pharmacist/staff |
| 3 | Medication reads | SEC-04 | 7 `GET` routes in `medication.js` (list, MAR, prescriptions, etc.) now require physician/nurse/pharmacist |
| 4 | Problems / patient data / records reads | SEC-04 | Reused the existing `clinicalWriters`/`clinical` role sets on the `GET` routes in `problems.js`, `patientData.js`, `records.js`; reference-data endpoints (`icd10/search`, history-category list) deliberately left open — not patient PHI |
| 5 | Inpatient docs reads | SEC-04 | 7 `GET` routes gated physician/nurse/staff; `nanda/search` (reference data) left open |
| 6 | Orders reads | SEC-04 | 3 `GET` routes in `orders.js` gated physician/nurse/pharmacist |
| 7 | CDI inbox | SEC-05 | `GET /api/CDI/query/inbox/:id` now requires billing/physician (was: any role) |
| 8 | ADT notification log | SEC-05 | 2 `GET` routes in `adtNotifications.js` now require admin/staff |
| 9 | Self-asserted NPI/DEA | SEC-16 | `PUT /auth/profile` schema no longer accepts `npi`/`deaNumber` — a staff member can no longer set their own license numbers. Only `PUT /auth/users/:id` (admin-only) can set them |
| 10 | Admin bypassing clinical sign-off | SEC-17 | New `requireClinicalRole(...roles)` middleware (`middleware/auth.js`) returns a 403 with an explanit message instead of the generic one. Applied to: clinical-note signing (physician), critical-lab acknowledgement (physician/nurse), prescription sign + transmit (physician), MAR dispense (pharmacist), medication-reconciliation completion (physician/nurse/pharmacist), discharge-summary signing (physician), critical-radiology-finding flagging (physician/nurse) |
| 11 | Frontend route guard | SEC-04/05 | New `frontend/src/components/auth/RoleGuard.tsx`; wraps the CDI Worklist route (`router/routes.tsx`) with `roles={['billing','physician']}`. An `admin` session is treated as allowed everywhere in the UI (navigation/visibility only — the backend changes above are what actually block the clinical actions) |
| 12 | Frontend nav filtering | SEC-04/05 | `MainNavLink`/`SettingsNavItem` gained an optional `roles` field; CDI Worklist nav link and the Settings → Care notifications link are hidden from roles that can't use them (`MainNavMenu.tsx`, `SettingsSidebar.tsx`) |
| 13 | Tests | — | New `backend/tests/rbac.test.js`, 15 tests covering SEC-04/05/16/17 (both the allow and the deny side of each gate). Full backend suite: **79/80** (see Verification) |

## A real pre-existing bug found and fixed while implementing this

`PUT /auth/users/:id` (admin-edit-user) used `userBody.partial().extend({...})` for validation. `userBody`'s `role` field has `.default('nurse')` and `firstName`/`lastName` have `.default('')`. Zod's `.partial()` makes a field optional, but a `.default()` on that field **still substitutes the default whenever the key is omitted from the request body** — `.partial()` does not disable `.default()`. Practically: an admin editing *only* `isActive` or *only* `npi` on a user was silently resetting that user's `role` to `'nurse'` and blanking their first/last name on every single partial edit. This was already live before any RBAC work started; it surfaced now because SEC-16 testing exercises `PUT /auth/users/:id` directly for the first time. Fixed with a dedicated `updateUserBody` schema with no defaults, so an omitted field is left untouched rather than reset.

## Verification

Full backend suite **79/80** (`npm test`) — the one failure is the pre-existing "Patient Access #64" test, which needs the frontend dev server reachable for its redirect-follow fetch and is unrelated to RBAC (confirmed failing the same way before this module started). Backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server (`admin@example.com`): `GET /api/adt-notifications` returns 200 for admin (allowed), `POST /api/inpatient/clinical/notes/sign/:id` returns 403 for admin (blocked, as intended) even on a non-existent note id — confirming the role check runs before the handler, not after. Dashboard loads cleanly post-change with no new console errors.

## Files

Backend changed: `src/middleware/auth.js` (new `requireClinicalRole`), `src/routes/clinicalNotes.js`, `src/routes/labs.js`, `src/routes/medication.js`, `src/routes/problems.js`, `src/routes/patientData.js`, `src/routes/records.js`, `src/routes/inpatientDocs.js`, `src/routes/orders.js`, `src/routes/revenue.js`, `src/routes/adtNotifications.js`, `src/routes/clinicalOps.js`, `src/routes/dischargeReadiness.js`, `src/routes/medReconciliation.js`, `src/routes/auth.js` (SEC-16 schema + the partial/default bug fix), `tests/rbac.test.js` (new), `tests/api.test.js` (test-data fixes to match the new gates), `package.json` (test script).

Frontend new: `src/components/auth/RoleGuard.tsx`. Frontend changed: `src/router/routes.tsx`, `src/components/Layouts/mainNavConfig.ts`, `src/components/Layouts/MainNavMenu.tsx`, `src/modules/settings/config/settingsNav.config.ts`, `src/modules/settings/components/SettingsSidebar.tsx`.
