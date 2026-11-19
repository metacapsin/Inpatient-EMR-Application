# Problem List / Clinical Docs: Completed Work

Date: 2026-11-13. Phase 1, module 8. Full scope approved and implemented — POA/principal diagnosis on the problem list, clinical-note co-sign, retained note versions, note-creation status code fix, late-entry documentation, overdue-H&P worklist, and a cross-platform ICD-10 zip importer. No external blocker.

## Summary for stakeholders

Problem-list entries had no way to record whether a condition was present at admission (POA) or which diagnosis was the principal one for the encounter — both are standard UB-04/billing concepts. Clinical notes had three gaps: creating a note returned the wrong HTTP status code for a resource creation (200 instead of 201); the "version history" on an edited note only stored a checksum, so a prior draft's actual wording could never be recovered, only proven to have changed; and a note touched after a patient's encounter was discharged was unconditionally blocked, even though finishing documentation shortly after discharge ("late entry") is normal clinical practice — it's now allowed and explicitly flagged, not silently treated as ordinary. Two real gaps are closed: a nurse can now sign a progress note she authored herself, but that signature requires a physician co-signature before the record is complete (a nurse's own signature isn't sufficient legal authentication on its own); and a new worklist surfaces every active encounter that's gone more than 24 hours without a signed History & Physical, so it's never found only by someone discovering it's missing. The ICD-10 seed script's zip download step previously shelled out to `powershell.exe`, which only ever worked on Windows — it now uses a small pure-JS zip reader that works identically on Linux, Mac, and Windows.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | POA indicator | Bucket C | `problems.poa` — real UB-04/CMS Present-On-Admission code set (`Y`/`N`/`U`/`W`/`1`), not a bare boolean. Requires `encounterId` (POA is encounter-scoped) |
| 2 | Principal diagnosis | Bucket C | `problems.is_principal` with a partial unique index enforcing at most one principal diagnosis per encounter; attempting a second returns 409, on both create and update |
| 3 | Note creation status code | BUG-16a | `POST /notes/create` now returns `201 Created`, not `200` |
| 4 | Retained note versions | Bucket C | Each `versionHistory` entry now stores the real `content`/`richText`/`title` snapshot at that point, not just a checksum — a prior draft's actual wording is recoverable, not just provably-changed |
| 5 | Late-entry documentation | BUG-16b | A discharged encounter no longer blocks note create/update/sign/addendum; the note response carries `isLateEntry: true` instead of refusing the request |
| 6 | Clinical-note co-sign | Bucket C | A nurse may sign (not just author) a `progress` note she wrote herself; doing so sets `requiresCosign: true`. New `POST /notes/cosign/:id`, physician-only, validates the note is signed, co-sign is actually required, and it isn't already co-signed. A physician's own signature never requires co-sign |
| 7 | Overdue H&P worklist | Bucket C | New `GET /hp-worklist` — active (non-discharged) encounters admitted >24h ago with no signed `hp` note, ordered oldest-first, each row carrying `hoursOverdue` |
| 8 | Cross-platform ICD-10 unzip | SAF-13 | New `lib/unzip.js` — pure-JS zip reader (central directory + local headers, stored/deflate via `zlib.inflateRawSync`) replaces the Windows-only `powershell.exe` call in `seedIcd10.js`'s `downloadFy2026()` |
| 9 | Tests | — | New `backend/tests/clinicalDocs.test.js` (3 tests, including a hand-built in-memory zip round-trip); `tests/api.test.js` and `tests/rbac.test.js` updated for the 201 status code; full backend suite: **119/119** |

## Files

Backend new: `src/lib/unzip.js`, `src/db/migrations/028_clinical_docs.sql`, `tests/clinicalDocs.test.js`.
Backend changed: `src/routes/problems.js`, `src/routes/clinicalNotes.js`, `src/db/seedIcd10.js`, `tests/api.test.js`, `tests/rbac.test.js`, `package.json` (test script).

Frontend changed: `src/services/problemsApi.ts` (`poa`/`isPrincipal` on `PatientProblem`/`CreateProblemPayload`/`UpdateProblemPayload`), `src/features/clinical-workflows/types.ts` (`NoteVersion`, `isLateEntry`/`requiresCosign`/`cosignedBy`/`cosignedByName`/`cosignedAt` on `PhysicianNote`, new `HpWorklistRow`), `src/features/clinical-workflows/api/clinicalApi.ts` (`cosignPhysicianNote`, `fetchHpWorklist`), `src/pages/patient/problemListHelpers.test.ts` (fixture fix for the new required field).

Not done in this module (flagged, not silently built): the Diagnoses.tsx problem-list page has no encounter-selection UI, so POA/principal fields aren't exposed there yet — the API fully supports them once an encounter-scoped caller sends `encounterId`. No UI exists yet for clinical-note signing/co-signing or the overdue-H&P worklist (confirmed via codebase search — `clinicalApi.ts` previously had no consumers of `signPhysicianNote` beyond the function itself); this module wires the backend and typed API client only.

## Verification

Full backend suite **119/119** (`npm test`). Backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server: added an ICD-10 problem (I10) through the real Diagnoses UI end-to-end (search → select → save), confirmed the network tab shows `201 Created` on `POST /problems`; a hand-built script against the live server found a real overdue encounter on `GET /hp-worklist` (`hoursOverdue: 454`), created a progress note as the nurse user, nurse self-signed it (`requiresCosign: true` in the response), and the physician user co-signed it (`cosignedBy` populated) — all against real seeded dev data, not just the test suite.
