# Module Inventory (Phase 6)

Audit date: 2026-11-12. Completion is scored on verified functionality against the requirement checklist for a US inpatient hospital, not on screen count. Score = verified requirements / required capabilities for the module (rounded to 5%). A module cannot exceed 60% without a backend that persists data, and cannot be "Completed and Verified" without an integration test.

## Master inventory

| # | Module | Status | Verified functionality (code evidence) | Missing requirements | Score | Priority |
|---|---|---|---|---|---|---|
| 1 | Tenant / hospital setup | Completed and Verified | Platform admin, tenant lifecycle, modules, profile with NPI/EIN (`platformAdmin.js`, `tenantProfile.js`, tests :818,:909,:950,:1376) | Departments table, multi-facility, logo, notification prefs | 80% | P2 |
| 2 | Staff / user management | Partially Completed | Admin CRUD, 6 roles, NPI/DEA, staff profiles, invite email (`auth.js:293-362`, `staffing.js:64-86`) | License/expiry/privileging, extra roles, NPPES check, self-asserted NPI/DEA fix | 55% | P1 |
| 3 | Authentication | Partially Completed | JWT + rotation, bcrypt, invite/reset flow, tenant suspension (`auth.js`, tests :64,:73) | MFA, lockout, policy, idle timeout, logout revocation, prod forgot-password email, close open `/auth/register` | 50% | P0 |
| 4 | Authorization / RBAC | Partially Completed | `requireRole` chokepoint, 87% of mutations gated, tenant isolation (test :380) | Read-side gating, two ungated PHI routes, admin separation of duties, unit scoping, frontend role guards | 45% | P0 |
| 5 | Audit logging | Not Started | `fhir_access_log` for patient API only (`020:55`) | Staff PHI access log, privileged-action log, reader UI, retention, tamper evidence | 5% | P0 |
| 6 | Security hardening | Needs Improvement | helmet, CORS, rate limit, parameterised SQL, zod | Gemini key rotation + server proxy, DB TLS, at-rest encryption, secret storage, localStorage tokens, cleartext HL7 | 45% | P0 |
| 7 | Patient registration | Partially Completed | Full form, MRN counter, dup check, insurance x2, contacts x2, PCP, eligibility, photo (`patients.js:500-564`, tests :1247,:1442) | USCDI demographics, coded race/ethnicity, interpreter, NOK role, unknown patient, merge, deceased, address validation, backend required fields | 65% | P1 |
| 8 | Patient search / list | Completed and Verified | Paginated server search, filters, sort whitelist (`patients.js:202-254`) | Age filter `19-35`, recency filters, name sort, DOB/MRN-exact modes | 80% | P2 |
| 9 | Patient details / facesheet | Partially Completed | 26 tabs routed, ~18 on real data | Mobile clipping, Dietary wrong-patient, mock tabs, dead Preventive tab, modal a11y, hidden modules, header banners | 60% | P1 |
| 10 | Patient documents | Backend Only | Upload/list/download/delete + test (`records.js:41-101`) | Upload UI, mime allowlist, AV, object storage, versioning, soft delete, role gate on download | 35% | P1 |
| 11 | Patient history | Needs Improvement | GET routes + read-only tab | Create/delete UI, coding, family history structure | 35% | P2 |
| 12 | Allergies | Completed and Verified | Full CRUD, FHIR fields, RxNorm/class for CDS, a11y modal (`records.js:178-223`, `021`) | NKA assertion, SNOMED reactions, enum enforced server-side; **failing test at :570** | 85% | P2 |
| 13 | Immunizations | Partially Completed | Table + GET/create/delete | UI write path, CVX/lot/manufacturer/VIS, IIS reporting | 35% | P3 |
| 14 | Consent management | Partially Completed | 8 types, signature/witness/capacity, revoke, completeness, rights requests (`consent.js`) | Registration-time consent (encounter required), PDF, expiry sweep, gate wiring | 60% | P1 |
| 15 | Patient admission (ADT) | Partially Completed | Transactional admit, hold fulfilment, A01, tests :107,:818 | Admission types/source codes, admitting MD + care team FK, visit number, observation, readmission, admission prompts | 55% | P1 |
| 16 | Bed management + EVS | Completed and Verified | DB-level conflict prevention, holds, EVS state machine, transfer queue, placement checks, bed board (test :1063) | Shadow localStorage placement path, `hold` vs `held`, departments, level of care | 85% | P1 (fix defects) |
| 17 | Transfers | Partially Completed | Intra-facility transfer, audit row, A02, request queue | Level of care, transfer med rec hook, A06/A07 | 60% | P2 |
| 18 | Initial assessments | Not Started | H&P note type only | Nursing admission assessment, fall/Braden/pain persistence, admission checklist | 10% | P1 |
| 19 | Physician notes / H&P | Completed and Verified | Draft→sign→addendum, role gates, CMS 24h flag (test :1651) | Co-sign, templates, retained versions, overdue worklist, entered-in-error | 70% | P1 |
| 20 | Nursing notes / handoff | Not Started | — (UI calls dead routes) | Table, routes, SBAR | 0% | P1 |
| 21 | Nursing flowsheets | Needs Improvement | Versioned flowsheet, sign lock, history (test :290) | Server-side signature, amended lock, `shiftInfo`, client sign-before-server | 60% | P1 |
| 22 | Nursing assessments (fall/wound/pain) | UI Only | Braden/Morse/GCS/pain scoring UI | Persistence (dead `/api/RiskAssessment/*`), reassessment intervals | 15% | P1 |
| 23 | Vital signs | Partially Completed | `health_metrics` CRUD, latest, trend (test :212) | Encounter link, thresholds/EWS, pain/BMI, UCUM, RR/height enabled in form | 50% | P1 |
| 24 | Problem list / ICD-10-CM | Partially Completed | Catalog, search, CRUD, status machine (test :1546) | Catalog seeding on Linux, POA, principal dx, SNOMED, encounter diagnoses | 60% | P1 |
| 25 | Care plans | Partially Completed | NANDA search, create/update/goal status (test :236) | Licensed NANDA, review tracking, signature, mock fallback off | 50% | P2 |
| 26 | I/O tracking | Partially Completed | Add/balance/timeline (test :255) | Shift totals, numeric types, mock fallback off | 55% | P2 |
| 27 | CPOE / clinical orders | Partially Completed | 4 types, CDS gate, ledger, timeline, dashboard (test :978) | More order types, verbal/co-sign, sets, hold/renew, detail-row sync, acknowledge | 50% | P1 |
| 28 | Order dashboard | Needs Improvement | Real list/cancel | Dead acknowledge, JS filtering after cap, phantom types, role gate | 45% | P2 |
| 29 | Physician dashboard | Not Started | Shared IPD dashboard only | Provider worklist | 0% | P1 |
| 30 | Nursing dashboard | Not Started | — | Assignment worklist, due tasks | 0% | P1 |
| 31 | Medication orders | Partially Completed | CPOE path with CDS, RxNorm | Unit/indication/start-stop/high-alert/schedule, hold/taper/infusion, legacy paths removed | 40% | P0 |
| 32 | MAR | Needs Improvement | Table + single "given" write | Due-time generation, statuses/reasons, BCMA, witness, late/missed, void, server-side signer, dedupe | 15% | P0 |
| 33 | Medication reconciliation | Completed and Verified | Home meds, admission/transfer/discharge rec, discharge gate (test :1711) | Prescriber attestation, RxNorm coding, external sources | 70% | P2 |
| 34 | e-Prescribing | Partially Completed | Draft→sign→transmit stub→print/dispense, pharmacies, EPCS block (test :1836) | Surescripts/NCPDP, EPCS, PDMP, error-state persistence bug | 50% | P2 |
| 35 | Pharmacy verification | Not Started | — | Verification queue and state | 0% | P1 |
| 36 | Pharmacy inventory / formulary | Not Started | — | Stock, lot, par, formulary | 0% | P3 |
| 37 | CDS alerts | Partially Completed | DDI + drug-allergy engine, override capture, suppression, ledger (tests :2056, unit) | Dose range, duplicate therapy, renal; licensed KB; `blocked` outcome persisted; cover all write paths | 45% | P1 |
| 38 | Drug database | Partially Completed | RxNav search endpoint + typeahead | Live mode default, SCD/SBD→IN mapping, local cache | 35% | P2 |
| 39 | Laboratory | Partially Completed (core verified) | Collect/result/flags/critical/ack/correction/ledger (test :1910) | Catalog, LIS HL7, micro/path, lab-tech role, add-ons | 65% | P1 |
| 40 | Imaging / radiology | Needs Improvement | Order/ack/result/amend/cancel/critical backend + UI (test :744) | Mock fallback off, ledger closure, critical notification, safety fields, PACS | 50% | P1 |
| 41 | Results / critical notification | Needs Improvement | Lab detection, ack, worklist, dashboard tile | Targeted routing, read-back, escalation, imaging criticals, re-notify on correction, portal release hold | 40% | P0 |
| 42 | Procedures / ICD-10-PCS | Not Started | — | Code set, procedure record/note/order | 0% | P2 |
| 43 | Consultations | Partially Completed | `consult` note type | Consult order and request/response workflow | 20% | P2 |
| 44 | Code events | Completed and Verified | Activate/timeline/team/close/generate-note (test :744) | Persist generated note, mock fallback off | 75% | P2 |
| 45 | Infection control / HAI | Partially Completed | Event log, summary, isolation feeds bed placement (test :305) | NHSN vocabulary, device days/rates, mock fallback off | 50% | P2 |
| 46 | Allied health notes | UI Only | In-memory store | Everything server-side | 10% | P3 |
| 47 | Dietary | UI Only | Dummy data (wrong patient shown) | Diet order type, backend | 5% | P2 |
| 48 | Discharge management | Partially Completed | Two-phase, 4 gates, signed summary, meds handoff, EVS release (test :1762) | Discharge order/physician approval, disposition codes, AMA, deceased, pending-results gate, client gate alignment, final billing | 55% | P1 |
| 49 | ADT care notifications (HL7) | Partially Completed | A01/A02/A03, MLLP/webhook/email, log, retry (test :1987) | Recipient directory UI, Direct, DG1/IN1 segments, TLS/https-only, A08 on demographics change | 65% | P2 |
| 50 | Insurance management | Partially Completed | 2 coverages + guarantor | Tertiary, COB, benefit persistence, billing role access | 50% | P2 |
| 51 | Eligibility verification | Completed and Verified | Stedi 270/271, history, isolation (tests :1490, mapper) | PHI in log line, read gating, batch re-verification | 85% | P2 |
| 52 | Prior authorization | UI Only | Mock store only | Backend, 278, link to orders/claims | 10% | P2 |
| 53 | Charge capture / chargemaster | Not Started | — (fabricated in UI) | Everything; remove fabricated charges first | 0% | P1 |
| 54 | Coding (CPT/HCPCS/PCS/DRG) | Not Started | — | Code sets, coder workqueue, DRG | 0% | P2 |
| 55 | Claims 837I / remittance 835 | Not Started | — | Everything | 0% | P3 |
| 56 | Patient statements / payments | Not Started | — | Everything; Invoices tab is mock | 0% | P3 |
| 57 | Denial management | Needs Improvement | Worklist, create, appeal, write-off, analytics (test :313) | Frontend mock default, FK to claims, bounded analytics | 55% | P2 |
| 58 | CDI | Needs Improvement | Query lifecycle (test :313) | Frontend mock default, inbox gate, typed DRG | 55% | P2 |
| 59 | Tenant subscription billing (Stripe) | Not Started | Stub id on tenant | Real Stripe, webhook, entitlement; remove dead patient checkout | 5% | P3 |
| 60 | Appointments | Completed and Verified | Calendars, slots, conflicts, CRUD, statuses (test :453) | Reminders, rooms as resources, timezone, encounter link | 70% | P3 |
| 61 | In-app notifications | Partially Completed | Table, bell, mark read | Producers, polling/push, targeting | 40% | P1 |
| 62 | Reporting | Partially Completed | IPD dashboard | Census/LOS/readmission/occupancy, export, role dashboards | 20% | P2 |
| 63 | Quality measures | UI Only | Mock store | Backend, eCQM/NHSN | 10% | P3 |
| 64 | FHIR Patient Access API | Partially Completed | 8 resources, CapabilityStatement, compartment, log (test :2170) | US Core profiles, paging, `$export`, 13 USCDI classes, discovery path, `aud` | 50% | P2 |
| 65 | SMART on FHIR / patient portal | Partially Completed | PKCE, consent screen, rotation, revocation, invite/login | Invite takeover fix, tenant-scoped login, `.well-known` placement, localStorage token | 60% | P1 (security fixes) |
| 66 | C-CDA / transitions of care | Not Started | — | CCD/discharge summary document generation | 0% | P3 |
| 67 | Direct messaging | Not Started | transport throws | HISP integration | 0% | P3 |
| 68 | AI assistant | Needs Improvement (blocking) | Browser-side Gemini on Medications tab | Rotate key, remove client call, server proxy with BAA, consent, audit; remove dead AI surfaces | 10% | P0 |
| 69 | Staff scheduling | Backend Only | Shifts, coverage, assignments, ratios (tests :608,:650) | Frontend flag default, time-off | 50% | P2 |
| 70 | Visitors and family contacts | Completed and Verified | CRUD (test :191) | Reconcile with emergency contacts | 80% | P3 |

## Lists

### Completed and Verified (11)
Tenant setup; Patient search; Allergies (one failing test to fix); Bed management + EVS; Physician notes / H&P; Medication reconciliation; Code events; Eligibility verification; Appointments; Visitors & family; Backend request pipeline (architecture).

### Partially Completed (30)
Staff management; Authentication; RBAC; Patient registration; Patient details; Immunizations; Consent; Admission; Transfers; Vital signs; Problem list; Care plans; I/O; CPOE; Medication orders; e-Prescribing; CDS; Drug database; Laboratory; Consultations; Infection control; Discharge; ADT notifications; Insurance; In-app notifications; Reporting; FHIR API; SMART/portal; Staff scheduling (backend); Database architecture.

### UI Only (7)
Nursing assessments (risk scores); Allied health notes; Dietary; Prior authorization; Quality measures; Invoices tab; Triage / symptom assessment / daily log / health alerts / chronic dashboard (dead-endpoint pages).

### Backend Only (3)
Patient documents (no upload UI); Staff scheduling (UI on fixtures); ADT recipient directory (no UI).

### Not Started (13)
Audit logging; Initial assessments; Nursing notes/handoff; Physician dashboard; Nursing dashboard; Pharmacy verification; Pharmacy inventory/formulary; Procedures/ICD-10-PCS; Charge capture; Coding; Claims/remittance; Statements/payments; Stripe billing; C-CDA; Direct.

### Needs Improvement (9)
Security hardening; Patient history; Nursing flowsheets; Order dashboard; MAR; Imaging; Results/critical notification; Denials; CDI; AI assistant.

### Blocked (0 hard blocks; 3 conditional)
- Claims/remittance: blocked on charge capture and coding.
- EPCS / Surescripts transmission: blocked on vendor credentials and certification.
- Live drug database and CDS knowledge base: blocked on a licensing decision (First Databank / Medi-Span / Lexicomp) or acceptance of RxNav-only scope.

## Weighted completion

Weighting Phase-1-critical modules (3-9, 15-24, 27, 31-33, 37, 39, 41, 48, 61, 68) at 2x and the rest at 1x, the verified completion of the application against the US inpatient requirement set is approximately **43%**. The previous report's "4 of 45 complete" undercounted; the real picture is a broad, mostly-wired foundation with thin safety, audit and revenue layers.
