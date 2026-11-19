# Development Roadmap (Phase 7)

Audit date: 2026-11-12. The roadmap is adjusted to what actually exists: the ADT/bed/EVS, eligibility, labs, notes, problem list and FHIR cores are already built, so Phase 1 is mostly **hardening and closing gaps**, not greenfield. Critical safety, security and legal items are not deferred.

Every item below is executed as a separate module change proposal with explicit approval.

```mermaid
gantt
    title Roadmap overview (indicative, sequential approvals)
    dateFormat  YYYY-MM-DD
    section Phase 0 Stop-the-bleeding
    Key rotation, PHI log, mock removal, failing test     :p0, 2026-11-13, 5d
    section Phase 1 Essential inpatient foundation
    Platform: audit log, read RBAC, MFA, session          :p1a, after p0, 20d
    Patient details UI + registration gaps                :p1b, after p0, 15d
    Admission + assessments + discharge hardening         :p1c, after p1a, 20d
    Clinical docs: nursing notes, signatures, worklists   :p1d, after p1a, 20d
    Medication safety: single write path, MAR, CDS        :p1e, after p1a, 25d
    Labs/results: targeting, read-back, escalation        :p1f, after p1d, 10d
    CI + test split                                        :p1g, after p0, 10d
    section Phase 2 Advanced clinical
    Pharmacy verification, BCMA, order sets, consults      :p2, after p1e, 45d
    section Phase 3 Integrations and revenue
    Charge capture, coding, 837/835, LIS, C-CDA, Direct    :p3, after p2, 90d
```

## Phase 0: Stop-the-bleeding (days, not weeks)

| Item | Issue IDs | Module |
|---|---|---|
| Rotate Gemini key, remove browser-side AI call, purge from history | SEC-01 | AI assistant |
| Remove password console.log; redact Stedi log | SEC-10, SEC-11 | Auth / Eligibility |
| Set all `VITE_*_MOCK` flags to `false`; remove silent fallbacks; hide Dietary/Invoices/Prior Auth/Preventive tabs behind flags; drop fabricated charges and prior-auth gate from discharge; drop mock prior-auth from dashboard | SAF-01, SAF-07, SAF-10, BUG-05, BUG-07, UI-02/04/05 | Frontend platform |
| Fix failing backend test; fix `npm test` glob; add CI | BUG-01, testing | Platform |
| Close open tenant registration | SEC-03 | Auth |

## Phase 1: Essential inpatient foundation

Ordered by dependency. Each row is one approval cycle.

| # | Module | Scope | Depends on | Exit criteria |
|---|---|---|---|---|
| 1.1 | Authentication | MFA (TOTP), lockout, NIST password policy, idle/absolute timeout, logout revocation, per-request `is_active`/role check, prod forgot-password email, distinct secrets | — | Role matrix test passes; deactivated user rejected on next request |
| 1.2 | Audit logging | `audit_events` table; middleware on every authenticated request (user, tenant, patient, action, route, outcome); privileged platform actions; viewer endpoint + admin UI; FHIR 401 logging | 1.1 | Every PHI read produces a row; tenant delete logged |
| 1.3 | RBAC | Read-side role matrix; fix two ungated routes; split clinical privileges from `admin`; frontend route/role guards; new roles (lab tech, radiologist, housekeeper, case manager, receptionist) | 1.2 | Billing user cannot open chart; tests per route |
| 1.4 | Patient details UI | UI-01 mobile fix, modal a11y, labeled inputs, inline error states, header banners (allergy/code status), hidden-module decisions, dead AI buttons removed, Location validation | Phase 0 | Playwright pass on 26 tabs at 3 widths, axe clean |
| 1.5 | Patient registration | Server-side required fields; USCDI demographics (gender identity, sex at birth, sexual orientation, coded race/ethnicity multi-select, interpreter, communication prefs); NOK/guardian roles; unknown-patient path; deceased flag; registration-time consents; list filter bugs | 1.3 | Fields persisted and surfaced in FHIR Patient |
| 1.6 | Hospital and staff | Departments table; licence/expiry/privileging fields; admin-only credential fields with NPPES check; staffing UI flag flipped to backend | 1.3 | Credential expiry report |
| 1.7 | Admission | Full admission type/source code sets; admitting + attending FK and care team; visit number; observation status; readmission flag; admission checklist prompting allergies, med rec, vitals, risk screens, consent, H&P deadline | 1.5 | Admit creates checklist; H&P worklist |
| 1.8 | Initial assessments | `risk_assessments` table + routes (Braden, Morse, GCS, pain, nutrition screen) wired to existing UI; nursing admission assessment; reassessment intervals | 1.7 | Saves persist and reload |
| 1.9 | Bed management fixes | Remove shadow localStorage placement; `hold` enum fix; inspection on admin override; level of care | — | Location tab uses ADT |
| 1.10 | Clinical documentation | Nursing notes + SBAR tables/routes; server-side signatures on flowsheets; amended lock; `shiftInfo`; retained note versions; co-sign; entered-in-error; overdue H&P/unsigned worklist; physician and nursing dashboards | 1.3 | Clinical Workspace tabs all real |
| 1.11 | Problem list | Linux-safe ICD-10 seeding; POA; principal diagnosis; encounter diagnoses linked to admission/discharge; SNOMED mapping (phase 2 ok) | — | Catalog populated in CI |
| 1.12 | Vital signs | `encounter_id`; pain/BMI; UCUM units; thresholds + abnormal flags; RR/height re-enabled; EWS scaffold [clinical review for thresholds] | 1.7 | Abnormal vitals notification |
| 1.13 | Medication safety foundation | Single write path through CPOE (retire legacy endpoints or add CDS + RxNorm); discontinue sync; unit/indication/start-stop/high-alert/schedule fields; MAR schedule generator, status + reason codes, server-side signer, dedupe, void; CDS `blocked` persisted; allergy enum server-side; RxNav live mode; med-rec RxNorm + prescriber attestation | 1.3 | MAR usable on a fresh tenant; CDS fires on every medication write |
| 1.14 | Labs and results | Targeted critical notifications; read-back fields; escalation job; imaging critical notification + ledger closure; correction re-notify; portal release policy; test catalog (minimal); lab-tech role | 1.3, 1.12 | TJC NPSG 02.03.01 evidence available |
| 1.15 | Discharge | Discharge order / physician approval; UB-04 disposition codes; AMA workflow (refusal, witness); deceased workflow (time, pronouncing physician); pending-results and consent gates; client gates from server only; recipient directory UI | 1.10, 1.13 | AMA and expired discharges tested |
| 1.16 | Notifications | Producers for orders, CDS, transfer requests, CDI; polling or SSE; targeting | 1.2 | Bell updates without reload |
| 1.17 | Security hardening | DB TLS, at-rest encryption plan, secret encryption, https-only webhooks, MLLP TLS, sessionStorage/httpOnly tokens, stop persisting PHI client-side, remove dev fallback origin | 1.1 | Pen-test baseline clean |
| 1.18 | Documents | Upload UI; multipart + object storage; mime allowlist + magic bytes; soft delete; versioning; role + relationship gate; scanned consent | 1.2 | Upload from chart works |

## Phase 2: Advanced clinical workflows

| Module | Scope |
|---|---|
| Pharmacy | Verification queue and state; inventory and lot tracking; formulary; therapeutic interchange |
| Complete MAR | BCMA barcode scanning; witness/second signature for high-alert and controlled; late/missed dashboards; PRN effectiveness; infusion/titration/taper representations |
| CPOE | Order sets; verbal/telephone orders with read-back and co-sign; hold/renew/modify; dietary, therapy, procedure, consult, nursing order types; nursing acknowledgement |
| CDS | Dose range, duplicate therapy, renal/hepatic, geriatric rules; licensed knowledge base decision; alert analytics |
| Imaging | Safety fields as discrete gated data; radiologist role and read workflow; modality worklist/PACS link |
| Consultations | Consult order and request/response workflow |
| Procedures | ICD-10-PCS code set, procedure records and notes |
| Care plans | Licensed NANDA-I; review scheduling; signatures; discharge-plan linkage |
| Patient monitoring | EWS with escalation; vitals alerts |
| Results management | Unacknowledged/incomplete worklists; TAT metrics |
| Infection control | NHSN vocabulary, device days, rates |
| Reporting | Census, ADC, LOS, readmissions, occupancy, disposition; export |
| e-Prescribing | Surescripts/NCPDP SCRIPT; EPCS with 2FA; PDMP |

## Phase 3: Integrations and optimisation

| Module | Scope |
|---|---|
| Revenue cycle | Chargemaster, charge capture (incl. DFT^P03), CPT/HCPCS, DRG grouper, coder workqueue, 837I generation + clearinghouse, 835 posting, statements, payments, prior authorization backend (278) |
| HL7 v2 | Inbound ADT, ORM/OML out, ORU in (LIS), SIU, MDM; MLLP listener with TLS |
| FHIR / ONC g(10) | US Core profiles, paging, `$export`, remaining USCDI classes, discovery fixes |
| C-CDA / Direct | CCD and discharge summary documents; HISP integration |
| Quality | Measure backend, eCQM/QRDA, NHSN export |
| Stripe | Real tenant subscription with webhooks and entitlement |
| Patient engagement | Portal messaging, appointment self-scheduling, reminders |
| AI (optional) | Server-side proxy with BAA, consent, audit; only after legal review |
| Operations | Multi-facility, departments, bed acuity, EVS SLAs |

## Explicitly not deferred

Audit logging, MFA, read RBAC, signature integrity, mock-data removal, critical-result targeting, AMA/deceased workflows and the Gemini remediation all sit in Phase 0/1 regardless of effort, because they are patient-safety, security or legal-record requirements.
