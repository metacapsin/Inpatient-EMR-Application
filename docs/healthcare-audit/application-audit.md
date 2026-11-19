# Application Audit (Phase 1)

Audit date: 2026-11-12, commit `ae3173f`. Method: every claim below was verified against live code (`backend/src/routes/*.js`, `backend/src/db/migrations/*.sql`, `frontend/src/**`), the test suite, and a browser walkthrough of the running app on the seeded demo tenant. The two older reports in the repo root (`MODULE_COMPLETION_REPORT.txt`, `PHASE1_DEMO_READY_MODULES.txt`) predate migrations 012-021 and are superseded.

Classification key: **Completed and Verified** (backend + frontend wired, persists, tested), **Partially Completed**, **UI Only**, **Backend Only**, **Not Started**, **Needs Improvement** (exists end-to-end but with defects that block real use), **Blocked**.

## Baseline

| Check | Result |
|---|---|
| Frontend `tsc` strict | clean |
| Frontend `vitest` | 27/27 (pure modules only) |
| Backend integration + unit | 46/47; `patient records` fails at `tests/api.test.js:570` (allergy `Status[0].Active` shape changed by migration 021 / `records.js` output) |
| CI | none |
| Dev DB | embedded Postgres was not running; migrations 019-021 were unapplied until this audit ran them |

## 1. Application architecture: Needs Improvement

Sound Express 5 + Postgres core with three separated JWT spaces, transactional writes, zod everywhere, strong tenant isolation. Undermined by: no audit log, browser-side AI with a leaked key, 13 mock flags defaulting to mock, no CI, dead `api/` tree, and `localStorage` token/PHI storage. Details in `technical-architecture.md`.

## 2. Frontend structure: Needs Improvement

~560 components, consistent design system (Tailwind + lucide, brown "Codavia" theme), lazy routes, error boundary. Problems: (a) silent mock fallbacks on care plan, I/O, code events, HAI, radiology (4.5-5s timeout then fabricated data, session pinned to mock); (b) CDI/denials/staffing UIs default to mock stores though their backends are complete; (c) ~30 dead endpoints in `services/api.ts` and `healthMonitoringService.ts`; (d) no shared patient cache; (e) six facesheet modules hidden from navigation; (f) orphaned files (`RiskAssessments.tsx`, `PatientSteps.tsx`, `LabAIHighlightsSidebar.tsx`, `NextVisitPrepCard.tsx`, `AIChatAssistant/*`, six `pages/reports/*` stubs, `SignupPage.tsx` unrouted).

## 3. Backend structure: Completed and Verified (with gaps)

33 routers, 307 handlers, 184 zod `parse()` sites, no SQL interpolation of user input, `withTx` + `FOR UPDATE` on every multi-step write. Gaps: read-side RBAC absent (116/127 GETs auth-only); module gate misses `/api/orders`, `/api/inpatient/*`, `/dashboard`, med-rec, discharge-readiness, eligibility routes; `admin` bypasses all clinical gates including signing and dispensing.

## 4. Database architecture: Partially Completed

21 migrations, every table tenant-scoped with cascade. Correct partial unique indexes for one active encounter per patient, one active encounter per bed, one hold per bed, one open EVS job per bed, one active problem per code. Gaps: no audit table; `patient_id`/`encounter_id` as plain TEXT without FK on `care_plans`, `io_records`, `nursing_flowsheets`, `hai_events`, `discharge_medications`, `mar_entries.medication_id`, `prescriptions.pharmacy_id`; `encounters.attending_physician_id` unvalidated text; `nursing_flowsheets.chart_status` and `mar_entries.status` without CHECK; files stored as BYTEA/data URLs; no departments table; ICD-10 catalog empty out of the box (seeder downloads via `powershell.exe`).

## 5. Authentication: Partially Completed

Done: bcrypt(10), timing-safe login, 15m access + 7d rotating refresh hashed in DB, replay rejected, `typ` claim per space, invite flow with real email, per-request tenant suspension check, rate-limited login.
Missing: MFA, account lockout, password complexity/history/expiry, idle/absolute session timeout, access-token revocation on logout (valid up to 15 min), per-request `is_active`/role re-check (deactivation lags 15 min), refresh-token reuse detection, break-glass. **Forgot-password never sends email in production** (`auth.js:131-150`). **Open self-service tenant registration** at `POST /auth/register`. Login service logs the plaintext password to the browser console (`frontend/src/services/auth.service.ts:70`).

## 6. Authorization and RBAC: Partially Completed

Six flat roles (`admin, physician, nurse, pharmacist, billing, staff`). 156/180 mutations role-gated, including the right ones (sign notes, prescribe, dispense, delete patient, user CRUD, facility CRUD). Gaps: 91% of reads open to any role (charts, notes, labs, prescriptions, documents, HL7 payloads); `GET /api/CDI/query/inbox/:physicianId` and `GET /api/adt-notifications` ungated; nurses can place medication orders without co-sign; any user can self-assert NPI/DEA via `PUT /auth/profile`; no unit/ward scoping; no lab tech, radiologist, housekeeper, receptionist, case manager roles; frontend routes have no role guard at all.

## 7. Patient registration: Partially Completed

Done and tested: ~45 fields, 2 insurances with guarantor, 2 emergency contacts, PCP + notification recipient, race-safe per-tenant MRN, advisory duplicate check (name+DOB), inline 270/271, photo, soft delete guarded by active encounter, strong client validation with a11y error handling.
Missing: gender identity / sex at birth / sexual orientation, coded race/ethnicity (labels only, single value), interpreter flag, communication preferences, next-of-kin/guardian role, unknown-patient path, merge, deceased flag, address validation, >2 coverages/contacts, consent at registration (consents require an encounter). Backend requires only first + last name. Minor list defects: `19-35` age filter silently resets, `today`/`thismonth` recency ignored, name-header sort maps to created date.

## 8. Patient details (facesheet): Partially Completed

26 routed chart tabs. Verified in browser (desktop 1440px, tablet 768px, mobile 375px):

| Tab | Data | Result |
|---|---|---|
| Demographics, ADT, History, Diagnoses, Medications, Prescriptions, Allergies, Immunizations, Nursing Flowsheet, Orders, Labs, Lab Orders, Documents, Consents, Notes, Visitors & Contacts, Vitals, Location | real | render, no console errors at desktop |
| Radiology, Care Plan, Infection Control | real backend, mock fallback on | render; 404 noise in console |
| **Dietary** | dummy | **shows a different patient ("Rajesh Kumar Sharma, MRN 2024-8871") inside Margaret Holloway's chart** |
| Prior Auth, Invoices | mock | render fabricated data; Invoices prints "(mock invoice list)" |
| Preventive Screening | dead endpoint | always empty with error toast |
| Location | real | red validation error shown before any user input |
| Diagnoses vs History | real | problem list empty while History shows diabetes/hypertension: two unlinked stores |

Layout: desktop and tablet have no horizontal overflow. **Mobile (375px) clips the first ~60px of every chart tab**: the facesheet drawer (`FacesheetSidebar.tsx:23`, 260px wide, `ltr:-left-[260px]`) is overridden by the global theme rule `.horizontal .sidebar { left:-200px }` (`tailwind.css:180`) written for the 200px main sidebar, so 60px of the drawer stays on screen at z-50. The main dashboard is unaffected.

Other UI defects: raw modals without `role="dialog"`/focus trap in Documents, Medications, History; unlabeled search inputs on most tabs; `min-h-screen` loading state inside the module container (Demographic); toast-only error states indistinguishable from "no records"; header lacks allergy, code-status and isolation banners; six modules hidden from nav; 10 dead AI "explain" buttons. Full list and the proposed fix in `issues-and-fixes.md` section UI.

## 9. Patient admission: Partially Completed

Transactional admit with bed lock, hold fulfilment, A01 notification; tested. Only 3 admission types (`emergency, elective, urgent`); source/diagnosis/attending are free text (attending has no FK); no admitting physician, care team, visit number, observation status, readmission detection; no admission prompts for allergies, med rec, vitals, risk screens, consent, H&P; quick-admit modal sends bed only.

## 10. Bed management: Completed and Verified

Wards → rooms → beds, six bed statuses, DB-level double-assignment prevention, row locks, timed holds with cron expiry, EVS four-state turnaround, transfer requests, isolation + mixed-sex advisories, live bed board, real UI, extensive test. Defects: `rooms.service.ts:373-502` shadow placement path writes bed assignments to `localStorage` and never calls ADT (facesheet Location tab); held beds unpickable in admit dropdown (`emrBeds.service.ts:109-120` checks `held`, backend uses `hold`); admin `available` override skips EVS inspection; no departments or level-of-care.

## 11. Physician management: Partially Completed

Admin user CRUD with role, NPI (Luhn), DEA; staff profiles with credentials enum. No license number/state/expiry, no privileging, no NPPES verification, no physician dashboard or worklist (unsigned notes, overdue H&P, pending co-sign), no care-team/attending assignment with FK.

## 12. Nursing management: Partially Completed

Done: versioned nursing flowsheet (10 body systems) with sign lock and amendment reason; live staffing assignment boards, ratios, float pool, shift overlap guard (backend). Defects: flowsheet signer identity and timestamp are client-supplied (`inpatientDocs.js:307-311`); `amended` chart can be reverted to draft; `shiftInfo` dropped; UI marks chart signed before the server confirms. Missing: nursing notes (routes declared in UI only), admission nursing assessment, fall/Braden/GCS/pain persistence (UI saves to dead endpoints and swallows errors), nursing dashboard, order acknowledgement; staffing UI defaults to fixtures.

## 13. Clinical documentation: Partially Completed

Done and tested: physician notes (H&P, progress, consult, discharge summary) with draft→sign lock, addenda, CMS 24h H&P flag; ICD-10-CM problem list with status machine; discharge summary with required sections and ICD-10 check. Missing: nursing notes, SBAR handover, procedure notes, templates, co-signature, note "entered in error", retained prior versions (only checksums kept), overdue-documentation worklist, POA/principal diagnosis, SNOMED CT, late entry after discharge (blocked).

## 14. Medication management: Partially Completed

Three write paths: CPOE (`orders.js`, CDS-checked, ledger row), legacy direct endpoints (`medication.js:33,124`, no CDS, no RxNorm field), med-rec completion (CDS advisory, errors swallowed). Medication order has no unit, indication, start/stop, high-alert, controlled schedule, weight-based dosing, infusion rate, hold/resume, or discontinue reason; discontinuing a ledger order leaves `medications.is_active` true. Med rec is complete end-to-end with a hard discharge gate but no prescriber attestation and uncoded lines. e-Rx Phase A (draft→sign→transmit stub→dispense, pharmacy directory, EPCS hard-stop) is solid. No pharmacy verification, inventory, or formulary. CDS: real 2-rule-type engine over a 10-row teaching seed; `blocked` outcome never persisted; RxNav stub (14 drugs) in every environment.

## 15. Medication Administration Record: Needs Improvement

`mar_entries` + one `POST /api/mar` that updates a `due` row or inserts a new one. Nothing generates due times from frequency (only `seed.js` creates `due` rows), so on a real tenant the MAR grid is empty and the "Give" button never appears. No held/refused/not-given statuses or reasons, no BCMA, no witness, no late/missed detection, no void/amend, duplicate administrations possible, `given_by` is client-supplied free text, `GET /api/mar/:patientId` ungated.

## 16. Laboratory management: Partially Completed (core Completed and Verified)

Order → collect (accession, specimen) → in progress → resulted; structured results with LOINC, units, reference ranges, abnormal and critical flags from a hardcoded panic table; corrections with audit comment; acknowledgement; critical worklist; CPOE ledger closed on result; real UI; strong test. Missing: test catalog/panels, LIS HL7 ORM/ORU, microbiology/pathology/blood bank, add-ons, lab-tech role, per-analyte ranges, cancellation reason. Order completion relies on test-name string matching; duplicate legacy `lab_documents` store still shown on the Labs tab.

## 17. Imaging and diagnostics: Needs Improvement

Real backend (order, acknowledge, result with amendment reason, cancel, critical flag, DICOM link) and full UI, but client defaults to mock fallback, result never closes the CPOE ledger row, critical findings generate no notification, pregnancy/contrast safety reduced to free text, no radiologist role, no PACS/modality worklist.

## 18. Clinical orders (CPOE): Partially Completed

Unified ledger over medication, PRN/STAT, lab, radiology with CDS gate and encounter timeline; order dashboard real. Missing: dietary/therapy/procedure/consult/nursing order types (UI declares them, backend cannot serve them), verbal/telephone orders with read-back and co-sign, order sets, hold/renew/modify, discontinue reason, nursing acknowledgement (endpoint called by UI does not exist), medication priority hardcoded `routine`, dashboard filters applied in JS after a 2000-row cap, no role gate on the dashboard list.

## 19. Billing and insurance: Partially Completed (revenue cycle Not Started)

Real: insurance capture, Stedi 270/271 with history, denial worklist + analytics, CDI query lifecycle. Mock/absent: prior authorization (UI only, no HTTP calls), charge capture, chargemaster, CPT/HCPCS/ICD-10-PCS/DRG, 837I, 835, payments, statements, patient invoices; the discharge workspace fabricates $12,260 of charges and a random payer claim id in the browser; CDI/denial UIs default to mock stores. `billing` role cannot edit insurance. Stripe tenant billing is a one-line stub and patient-side checkout targets nonexistent endpoints with a default bypass.

## 20. Discharge management: Partially Completed

Two-phase discharge with four server gates (signed summary, discharge med rec, blocking checklist tasks, encounter status), signed structured summary, discharge meds handoff, bed → dirty + EVS, A03. Missing: discharge order / physician approval (any clinical role can initiate and confirm), UB-04 disposition codes, AMA and deceased workflows (labels only), pending-results and consent gates, final billing, undo. Client gate list diverges from the server (blocks on mock charges/prior auth/eligibility, omits med rec).

## 21. Notifications: Partially Completed

Real in-app table and bell, but only two producers (critical labs, ADT), fetched once on mount with no polling/push. Critical-lab fan-out goes to every physician and nurse in the tenant with name + MRN + value. Outbound ADT: real HL7 v2.5 A01/A02/A03 builder, MLLP (with ACK), HTTPS webhook, email transports, delivery log, retry; `direct` throws; no admin UI for the recipient directory (service functions have zero consumers); `http://` webhooks accepted.

## 22. Reporting and dashboards: Partially Completed

One real endpoint (`/dashboard/ipd`: census KPIs, bed board, criticals, transfers) wired to the dashboard. No role-specific dashboards, no census/LOS/readmission/occupancy reports, no export; five `pages/reports/*` stubs unrouted. Quality measures: UI only, no backend (lives only in the dead `api/` tree). Infection dashboard: real `hai_events` backend behind a mock-default client. Dashboard shows "Prior auth expiring" from the prior-auth mock store.

## 23. Audit logging: Not Started

The only audit table is `fhir_access_log` (patient API only, write-only, no reader, insert fails silently on 401 because `tenant_id` is NOT NULL). No staff PHI-access log, no privileged-action log (tenant deletion cascades an entire hospital with no record), no request logger. Feature-local histories (note addenda, flowsheet versions, prescription status history, ADT log, lab correction comments) are not a security audit trail. Positive: no PHI printed in server logs except the Stedi 270 payload (`lib/stedi.js:70`, patient names unredacted) and HL7 in the stub transport.

## 24. Security: Needs Improvement

Strong: helmet, strict CORS, parameterised SQL, zod, no default secrets, timing-safe auth, tenant isolation verified mechanically. Critical/high: hardcoded git-tracked Gemini key with browser-side PHI egress; no audit log; open tenant registration; read RBAC absent; portal invite can be redirected by any clinical user to an arbitrary email (account takeover); no MFA/lockout/timeout; tokens and PHI in `localStorage`; no DB TLS or encryption at rest; plaintext webhook secrets; SMTP cert verification disabled; cleartext HL7 transports permitted. Full ranked list in `issues-and-fixes.md`.

## 25. Interoperability: Partially Completed

FHIR R4 patient access with 8 resources, CapabilityStatement, SMART App Launch (PKCE S256, rotating refresh, DB-checked revocation, real consent screen), access log, tested. Gaps: no US Core profiles, no paging (`total` reports the truncated page), no `$export`, discovery document at wrong path with relative URLs, `aud` ignored, 13 of 22 USCDI v3 classes absent (procedures, care team, goals, provenance, SDOH, smoking, demographics extensions). HL7 v2 outbound ADT only (no inbound, no ORU/ORM/DFT, no TLS). C-CDA and Direct not implemented. Appointments: Completed and Verified for ambulatory scope (conflict detection, provider calendars) but not linked to encounters, no reminders, no timezone.

## Cross-cutting conclusions

1. The ADT/bed/EVS/eligibility/labs/notes/problem-list/FHIR core is genuinely production-shaped and tested. The project is further along than the 2026-10-30 report states.
2. The frontend's mock-first history has left a layer of fabricated data on live clinical and financial screens with no visual indicator. This is the single largest source of patient-safety and revenue-integrity risk and is cheap to fix (flags, fallback removal, indicator banners).
3. Signature integrity (MAR `given_by`, flowsheet `signedBy/signedAt`) and the absence of an audit log mean the system cannot currently produce a defensible legal record.
4. Nothing in the audit constitutes a HIPAA compliance determination. See `healthcare-gap-analysis.md` for items requiring qualified compliance, clinical and legal review.
