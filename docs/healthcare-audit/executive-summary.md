# Executive Summary

Inpatient EMR Application, audited 2026-11-12 at commit `ae3173f`. Read-only audit with code-level verification, a full backend/frontend test run, and a browser walkthrough of the patient chart at desktop, tablet and mobile widths. No application code was changed.

## Headline

The application is further along than its own status reports say. The admission/bed/housekeeping core, insurance eligibility, laboratory results, physician notes, ICD-10 problem list, medication reconciliation, e-prescribing scaffold and a FHIR/SMART patient-access API are real, persisted and covered by a 2,300-line integration suite. Weighted against the full US inpatient requirement set, verified completion is about **43%**.

What stands between this codebase and real patients is not missing screens. It is five cross-cutting problems:

1. **A leaked credential and uncontrolled PHI egress.** A Google Gemini API key is hardcoded and git-tracked, and the Medications tab sends prescription data straight from the browser to Google with no BAA. Rotate and remove first.
2. **No audit trail.** Nothing records which staff member read or changed which chart. The only log covers the patient-facing API and silently drops failed requests. This fails HIPAA Security Rule audit controls outright.
3. **Fabricated data on live screens.** Thirteen mock flags default to "on". Care plans, I/O, code-blue timelines, infection events and imaging orders silently switch to invented data after a 5-second timeout. The discharge workspace shows $12,260 of fake charges and generates a random payer claim number. The Dietary tab displays a different patient's name inside the chart.
4. **Signatures and the MAR are not trustworthy.** MAR `given_by` and nursing flowsheet `signedBy`/`signedAt` are taken from the request body. The MAR has no schedule generator, so on any real tenant it is empty. Two medication write paths bypass drug-interaction checking entirely.
5. **Read access is not role-controlled.** 116 of 127 read endpoints are open to any logged-in role; a billing clerk can read every note, lab and document in the hospital.

## Scorecard

| Area | Status | Score |
|---|---|---|
| Bed management, EVS, transfers | Completed and Verified | 85% |
| Eligibility (270/271) | Completed and Verified | 85% |
| Allergies, appointments, code events, med rec, physician notes | Completed and Verified | 70-85% |
| Patient registration, search, details | Partial | 60-80% |
| Admission, discharge, ADT notifications | Partial | 55-65% |
| Labs, problem list, CPOE, consent | Partial | 50-65% |
| Authentication, RBAC, security | Partial / Needs Improvement | 45-50% |
| FHIR / SMART interop | Partial | 50-60% |
| Nursing documentation, vitals, imaging, CDS | Partial / Needs Improvement | 40-60% |
| Medication orders, MAR, results notification | Needs Improvement | 15-40% |
| Audit logging, nursing notes, assessments, dashboards, pharmacy verification, procedures | Not Started | 0-10% |
| Charge capture, coding, claims, statements, C-CDA, Direct, quality backend | Not Started | 0% |

Full table: `module-inventory.md`.

## Regulatory position

No compliance claim can be made. Against HIPAA Security Rule: audit controls, automatic logoff, emergency access, MFA-grade authentication, and transmission/at-rest encryption are unmet. Against CMS Conditions of Participation: 24-hour H&P is flagged but not tracked, verbal orders and pharmacist review are absent, discharge disposition is free text. ONC certification would fail on US Core profiles, paging, Bulk Data and 13 USCDI classes. Items requiring qualified privacy, clinical and legal review are listed in `healthcare-gap-analysis.md`.

## Immediate actions (Phase 0, days)

1. Rotate the Gemini key, delete the browser call, purge git history (SEC-01).
2. Remove the console.log of login passwords and the patient-name log line in the Stedi client (SEC-10, SEC-11).
3. Set every `VITE_*_MOCK` flag to false, remove silent fallbacks, hide Dietary/Invoices/Prior Auth/Preventive tabs, delete fabricated charges and the fake claim submission (SAF-01, SAF-07, SAF-10).
4. Close the open tenant self-registration endpoint (SEC-03).
5. Fix the one failing backend test and add CI (BUG-01).

## Phase 1 priorities (weeks)

Audit log → read-side RBAC and MFA → Patient Details UI fixes (including the mobile clipping bug) → registration USCDI fields → admission model and assessments → nursing notes and server-side signatures → single medication write path with a real MAR → targeted critical-result routing with read-back → discharge order, AMA and deceased workflows → security hardening (TLS, token storage, secrets). Detail and sequencing: `phase-1-roadmap.md`; ownership: `developer-task-distribution.md`.

## Documents in this folder

| File | Content |
|---|---|
| `application-audit.md` | Phase 1 module-by-module findings with evidence |
| `module-inventory.md` | 70-row inventory, status lists, weighted completion |
| `healthcare-gap-analysis.md` | HIPAA, HITECH, CMS CoP, HL7, FHIR, USCDI, code sets, NIST, WCAG |
| `inpatient-workflow.md` | Setup → registration → admission → stay → discharge, as built vs required |
| `issues-and-fixes.md` | 90+ issues with IDs, severity, file:line, proposed fix; Patient Details UI findings |
| `technical-architecture.md` | Stack, pipeline, data model, mock-flag inventory, build/test baseline |
| `phase-1-roadmap.md` | Phase 0/1/2/3 plan |
| `developer-task-distribution.md` | Six workstreams with scope, dependencies, DoD |
| `testing-strategy.md` | Current coverage, target pyramid, per-module requirements |

## Process

Every change above requires a module change proposal and explicit approval before any file is edited. The recommended first proposal is the Phase 0 security/mock-removal bundle, split into its constituent modules (AI assistant, Auth, Frontend platform, Discharge billing tab, CI).
