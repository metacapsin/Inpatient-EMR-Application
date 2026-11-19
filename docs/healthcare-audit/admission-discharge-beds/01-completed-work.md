# Admission / Discharge / Beds: Completed Work

Date: 2026-11-13. Phase 1, module 7. Full scope approved and implemented — 7 bug fixes (Bucket A), a physician-only discharge-confirm gate (Bucket B), and three new workflows: admission checklist, AMA discharge, and deceased/death record (Bucket C). No external blocker.

## Summary for stakeholders

A held bed could silently disappear from a "no beds available" check due to a backend/frontend enum mismatch (`hold` vs `held`); an admin could mark a bed "available" and skip its housekeeping inspection with no record of why; an attending physician on an admission was free text, not validated against real staff; a bed could be put on hold while still dirty, creating a hold nobody could ever actually use; the HL7 feed sent to PCPs/HIEs misused a field for diagnosis instead of using a real DG1 segment, could exceed the spec's message-ID length, and mangled any name or diagnosis containing a pipe/caret/ampersand instead of escaping it properly; editing a discharge summary could never actually clear a field once set; and the bed-board's total-bed count was silently wrong whenever a status filter was applied. All seven are fixed.

Separately: finalizing a discharge is now a physician decision — a nurse or admin can start the paperwork, but only a physician can actually confirm the patient is leaving. And three real gaps are closed: an admission checklist now shows, from real data (not a self-reported checkbox), whether allergies were reviewed, medication reconciliation is done, vitals are recorded, consent is on file, and the H&P is documented. "Left against medical advice" and "Expired" are no longer dropdown labels with nothing behind them — each now requires a structured, physician-recorded attestation (reason/witness/signature for AMA; time of death and pronouncing physician for a death) before the discharge can be finalized, using the public CMS UB-04 disposition code set instead of free text.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Held-bed filter bug | SAF-14 | `filterAvailableBeds` now recognizes `'hold'` (the real backend status) alongside the pre-existing `'held'` typo |
| 2 | EVS inspection bypass | SAF-20 | Forcing a bed to `available` while its housekeeping job is still open now requires `overrideReason`, logged via `recordAuditEvent` |
| 3 | Attending physician validation | SAF-21 | `attendingPhysicianId` on admission must resolve to an active physician in the tenant (404 otherwise) |
| 4 | Dirty-bed hold | SAF-22 | Only an `available` bed can be reserved — reserving a `dirty` one used to succeed but could never actually be consumed (the EVS-queue check always blocked the eventual admission) |
| 5 | HL7 correctness | SAF-24 | New DG1 segment for diagnosis (PV1-10 no longer misused for it); MSH-10 control ID is now a 20-char hash instead of a truncated-UUID scheme that both violated the spec and risked collisions; real HL7 escape sequences (`\F\ \S\ \T\ \R\ \E\`) instead of replacing delimiter characters with a space |
| 6 | Discharge summary null-vs-omitted | BUG-12 | An explicit `null` now actually clears a field; an omitted field is left alone — the previous `COALESCE`-based upsert couldn't tell the two apart |
| 7 | Bed board total count | BUG-14 | `summary.totalBeds` reflects the whole facility, not the `bedStatus`-filtered subset |
| 8 | Discharge confirm is physician-only | SAF-12 | `POST /api/discharges/confirm` (and `phase: 'confirm'`) now requires `role === 'physician'` — nurse/staff/admin can still `initiate` |
| 9 | Admission checklist | Bucket C | New `GET /api/admissions/:encounterId/checklist`, computed from real data (allergies on file or explicitly reviewed-as-none, admission med-rec completed, vitals recorded since admission, signed consent on file, signed H&P note) — deliberately **not** a self-checked list, and deliberately excludes fall/Braden/pain risk screens since no real data backs them yet (Nursing documentation module). Panel added to the ADT workspace page |
| 10 | AMA discharge workflow | Bucket C | Disposition `07` (AMA) now blocks `confirm` until `POST /api/encounters/:id/ama-discharge` (reason, risks-explained, witness, patient signature attestation) is recorded — physician-only. UI panel on the discharge summary tab |
| 11 | Deceased workflow | Bucket C | Disposition `20` (Expired) now blocks `confirm` until `POST /api/encounters/:id/death-record` (time of death, pronouncing physician, optional cause) is recorded — physician-only, pronouncing physician validated against real staff. Sets `patients.deceased`/`deceased_at`. UI panel on the discharge summary tab |
| 12 | UB-04 disposition codes | Bucket C | New `lib/dispositionCodes.js` (public CMS code set, no licensing concern unlike CPT) replaces the old free-text disposition dropdown; `encounters.disposition` (previously almost always null in practice — the UI never actually sent it) now falls back to the signed discharge summary's disposition at `initiate` time, so HL7 PV1-36 and the AMA/deceased gates actually see real data |
| 13 | Tests | — | New `backend/tests/admissionDischarge.test.js` (10 tests) covering every item above; full backend suite: **116/116** |

## Files

Backend new: `src/lib/dispositionCodes.js`, `src/lib/criticalNotify.js` *(reused from the prior module)*, `src/routes/admissionChecklist.js`, `src/db/migrations/027_admission_discharge.sql`, `tests/admissionDischarge.test.js`.
Backend changed: `src/routes/adt.js`, `src/routes/facility.js`, `src/routes/bedReservations.js`, `src/routes/dischargeReadiness.js`, `src/lib/hl7Adt.js`, `src/lib/dischargeGates.js`, `src/app.js`, `tests/api.test.js` (disposition values + admin→physician confirm tokens updated across several existing tests).

Frontend new: `src/components/adt/AdmissionChecklistPanel.tsx`, `src/components/ipd/discharge/AmaDeathRecordPanel.tsx`. Frontend changed: `src/services/emrBeds.service.ts`, `src/services/dischargeReadiness.service.ts`, `src/components/ipd/discharge/DischargeSummaryTab.tsx`, `src/modules/facesheet/adt/AdtModulePage.tsx`.

## Verification

Full backend suite **116/116** (`npm test`; one transient connection flake on a re-run reproduced clean in isolation and on a subsequent full clean run — not a real regression). Backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server: `GET /api/physicians` returns the seeded physician; confirming a discharge as admin returns 403 even before the "encounter not found" check (confirms the role gate runs first, matching the rest of the app's SEC-17-style gates); the Admission Checklist panel on a real admitted patient's ADT page shows "4/5 complete" with accurate per-item state (allergies reviewed — 2 on file; med-rec outstanding; vitals recorded; consent on file; H&P pending) computed from that patient's actual data; the discharge summary's disposition dropdown correctly resolves a previously-saved free-text "Home" value to the new UB-04 code via the back-compat label match.
