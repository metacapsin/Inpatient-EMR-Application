# Implementation Verification — 2026-11-13

Read-only check of every module against live code, the test suites and the audit inventory. No application code was changed. Baseline for the two proposals that follow (`medication-safety/00-proposal.md`, `nursing-documentation/00-proposal.md`).

## Build and test baseline

| Check | Result | Note |
|---|---|---|
| `npx tsc --noEmit` (frontend) | clean | |
| `npm test` (frontend, vitest) | 27/27 | |
| `npm test` (backend, 8 files) | **57 pass / 8 fail** | Was 65/65 at progress-log entry 10 (2026-11-12 16:32) |
| Migrations | 001–024 applied on the embedded dev DB (5544) | DB had to be started with `node scripts/embedded-db.js` |
| Working tree | 163 uncommitted files (119 M, 9 D, 35 ??) | Nothing from entries 1–10 is committed |

### Why 8 backend tests fail

`backend/src/middleware/auth.js` gained `requireClinicalRole()` (SEC-17: admin no longer passes clinical gates) at 10:55 today, and it was applied in `medReconciliation.js`, `dischargeReadiness.js`, `medication.js`, `clinicalNotes.js`, `labs.js`, `clinicalOps.js` between 10:55 and 10:59. The test file (last edited 16:04 yesterday) still drives those gates with the admin token, so the discharge-gate helper, dispense, e-Rx sign, med-rec complete and the ADT recipient read (nurse now 403) fail. The SMART test's "fetch failed" is the `/oauth/authorize` redirect to the unreachable test `redirect_uri`. This is the RBAC module mid-flight, not recorded in `progress-log.md` and not covered by a proposal entry. It should be finished (tests switched to physician/nurse tokens, read-side matrix, frontend guards) or reverted before any clinical module work starts, otherwise every later suite run is red for the wrong reason.

Failing tests: #6 ADT flow, #9 medication/CDI, #11 dashboard, #21 bed management, #30 e-Rx, #32 ADT notifications, #33 CDS, #34 Patient Access.

## Module-by-module verification

Status key: ✅ verified working (route + persistence + test) · ⚠️ works with a documented gap · ❌ not implemented / dead path.

### Platform

| Module | Status | Evidence / gap |
|---|---|---|
| Tenant setup, platform admin | ✅ | `platformAdmin.js`, `tenantProfile.js`; tests 818/909/950/1376 |
| Authentication + session | ✅ | lockout, NIST policy, TOTP, token_version, httpOnly refresh, idle timeout; `authHardening.test.js` 8/8 |
| Audit logging | ✅ | `audit_events` (023), middleware, admin API, Settings → Audit Trail; `audit.test.js` 7/7 |
| RBAC | ⚠️ in progress | `requireClinicalRole` applied; no read-side matrix, no new roles, no frontend guards, suite red |
| CI | ⚠️ | `.github/workflows/ci.yml` present; not yet executed on GitHub (nothing pushed) |
| AI assistant | ⚠️ | server-side proxy + ledger; Gemini key still revoked → 502 |

### Patient and ADT

| Module | Status | Evidence / gap |
|---|---|---|
| Registration, search, details | ✅ | 26 chart tabs, PCP fields, mobile drawer fix; tests 1247/1442 |
| Admission / transfer / discharge (ADT) | ✅ | two-phase discharge, 4 server gates, A01/A02/A03; tests 107/1091/1762 |
| Bed management + EVS | ✅ | holds, dirty-on-discharge, EVS state machine; test 1063 |
| ADT care notifications | ✅ | recipients, stub/webhook/MLLP/email, log, retry; test 1987 (now red only via RBAC) |
| Consent | ⚠️ | encounter required; no registration-time consent |

### Clinical documentation

| Module | Status | Evidence / gap |
|---|---|---|
| Physician notes / H&P | ✅ | draft→sign→addendum, CMS 24h flag; test 1651 |
| Discharge summary | ✅ | structured, signed, immutable, meds snapshot; test 1762 |
| Problem list / ICD-10 | ✅ | catalog, CRUD, status machine; test 1546 (catalog seeding Linux issue SAF-13 open) |
| Nursing flowsheets | ⚠️ | versioned, but signer/timestamp client-supplied (SAF-05), `shiftInfo` dropped (BUG-11) |
| Nursing notes / SBAR handoff | ❌ | Clinical Workspace tabs call `/api/inpatient/clinical/{nursing-notes,handover}` — no router, 404 |
| Nursing assessments (Braden/Morse/GCS/pain) | ❌ | `RiskAssessments.tsx` posts to `/api/RiskAssessment/*` — no router (SAF-09) |
| Vitals | ⚠️ | `health_metrics` CRUD; no encounter link, no thresholds; Clinical Workspace vitals tab calls a dead path |
| Care plans, I/O, code events, HAI | ✅ | backend-wired; mocks now opt-in |

### Medication

| Module | Status | Evidence / gap |
|---|---|---|
| CPOE medication orders | ⚠️ | CDS + RxNorm on the CPOE path only; discontinue flips the ledger row, not `medications.is_active` (SAF-03) |
| Legacy medication / PRN-STAT endpoints | ⚠️ | `POST /api/patients/:id/medications`, `POST /api/prn-stat` bypass CDS and RxNorm (SAF-04) |
| MAR | ❌ as a product feature | `mar_entries` exists; no schedule generation, `given_by` is request text, free-text status, no dedupe (SAF-02). The Give button is unreachable on a fresh tenant because nothing creates due rows |
| Medication reconciliation | ✅ | home/admission/transfer/discharge; test 1711 |
| e-Prescribing (Phase A) | ✅ | lifecycle + pharmacies + EPCS block; test 1836; transmit-error status lost in rollback (SAF-18) |
| CDS (DDI / drug-allergy) | ✅ | engine, override, suppression, ledger; test 2056 + unit; `blocked` outcome never persisted (SAF-17) |
| Pharmacy verification / inventory | ❌ | not started |

### Diagnostics and results

| Module | Status | Evidence / gap |
|---|---|---|
| Lab orders + results | ✅ | collect, flags, critical, ack, correction, ledger; test 1910 |
| Radiology | ⚠️ | order/result/critical backend; critical notifies nobody |
| Critical-result notification | ⚠️ | broadcast to all physicians/nurses; no read-back, no escalation (SAF-06) |

### Revenue and interoperability

| Module | Status | Evidence / gap |
|---|---|---|
| Eligibility (Stedi 270/271) | ✅ | test 1490; PHI-free logging |
| Denials, CDI | ✅ backend | mocks opt-in |
| Charge capture, coding, claims, statements, Stripe tenant billing | ❌ | not started; discharge Charges/Billing tabs are "not available" panels |
| FHIR R4 + SMART | ⚠️ | 8 resources, PKCE; US Core/paging/`$export` missing; invite-takeover SEC-06 open |
| C-CDA, Direct, LIS/PACS HL7 | ❌ | not started |

### Frontend-only (not demo-able)

Dietary, Prior authorization, Quality measures, Allied-health notes, Invoices tab, triage/daily-log/health-alert pages — all behind `VITE_*` opt-in flags or `VITE_FACESHEET_PREVIEW_TABS`.

## Conclusion

Everything recorded in `progress-log.md` entries 1–10 is present and verified. The one discrepancy is an **unlogged, half-done RBAC change** that currently breaks 8 integration tests. The two largest industry-standard inpatient capabilities that the application presents in the UI but does not actually implement are the **electronic MAR** (medication administration) and **nursing documentation** (shift notes, SBAR handoff, risk assessments). Proposals for both follow.
