# Issues and Fixes

Audit date: 2026-11-12. Every issue has a stable ID, severity, location and proposed fix. Items marked ✅ were fixed in the approved Patient Details module on 2026-11-12 (see `patient-details/01-completed-work.md`); everything else is still open. Each fix requires a module-level change proposal and explicit approval before implementation.

Severity: **P0** patient-safety / security-critical, **P1** high, **P2** medium, **P3** low.

## A. Security and privacy

| ID | Sev | Issue | Location | Proposed fix |
|---|---|---|---|---|
| SEC-01 ⚠️ mitigated 2026-11-12 (client call + key removed; key revoked by Google, new key + history purge pending) | P0 | Hardcoded, git-tracked Google Gemini API key; PHI sent browser→Google with no BAA | `frontend/src/services/geminiApi.ts:5,8,106`; caller `pages/patient/Medications.tsx:277-280` | Rotate key at Google immediately; delete client call; if AI is kept, proxy via backend `GEMINI_API_KEY` with consent gate + audit; purge from git history |
| SEC-02 | P0 | No staff audit log; tenant deletion unlogged; FHIR log insert fails on 401 | `middleware/auth.js`, `platformAdmin.js:179-189`, `routes/fhir.js:68`, `020:57` | `audit_events` table + middleware at `requireAuth`; log privileged platform actions; make `fhir_access_log.tenant_id` nullable |
| SEC-03 ✅ fixed 2026-11-12 | P1 | Open self-service tenant + admin registration | `routes/auth.js:173-202` | Disable or gate behind invite/feature flag |
| SEC-04 | P1 | Read-side RBAC absent (116/127 GETs) | all routers | Role matrix for reads; start with notes, labs, documents, prescriptions, ADT log |
| SEC-05 | P1 | Ungated PHI reads: CDI inbox, ADT notification log | `revenue.js:87`, `adtNotifications.js:104` | Add `billing` gate + owner check; `admin`/`staff` gate on ADT log |
| SEC-06 | P1 | Portal invite can be redirected to arbitrary email, nulling an active account's password (account takeover) | `patientAccounts.js:112-147` | Admin-only; use patient's email on file; never null an active account; audit row |
| SEC-07 | P1 | No MFA, lockout, password policy, idle timeout; logout leaves access token valid; deactivation lags | `auth.js:23,81-87,207-216`, `middleware/auth.js:25` | MFA (TOTP), lockout counter, NIST 800-63B policy, idle timeout, jti denylist, per-request `is_active`/role check |
| SEC-08 | P1 | Forgot-password sends no email in production | `auth.js:131-150`, `smartAuth.js:611-635` | Call `lib/email.js` |
| SEC-09 | P1 | Tokens + cached `patientData` in `localStorage`; flowsheet PHI in `localStorage` | `auth-tokens.ts:48-70`, `authSlice.tsx:60-88,314`, `NursingFlowsheetContext.tsx:102` | Memory/sessionStorage for access token, httpOnly cookie for refresh; stop persisting PHI |
| SEC-10 ✅ fixed 2026-11-12 | P1 | Login payload (plaintext password) logged to browser console | `services/auth.service.ts:70` | Remove `console.log` |
| SEC-11 ✅ fixed 2026-11-12 | P1 | Stedi 270 log line prints subscriber first/last name | `lib/stedi.js:25-27,70` | Extend `PHI_KEYS` or log correlation id only |
| SEC-12 | P2 | No DB TLS, no at-rest encryption, SMTP cert check disabled, plaintext webhook secrets, `http://` webhooks and plain MLLP allowed | `db/pool.js:9`, `lib/email.js:21`, `018:9`, `adtNotifications.js:29`, `adtTransport.js:36-55` | `sslmode=require`; encrypt secrets; https-only; MLLP over TLS or VPN requirement |
| SEC-13 | P2 | Platform and SMART secrets derive from `JWT_SECRET` when unset | `config.js:40,43` | Require distinct secrets in prod |
| SEC-14 | P2 | Patient portal login/forgot not tenant-scoped (oldest account wins) | `smartAuth.js:591-595,616-621` | Require `tenantId` or tenant-scoped login URL |
| SEC-15 | P2 | SMART discovery at wrong path, relative URLs, `aud` ignored; `/oauth/revoke` unscoped | `smartAuth.js:193-215,230,531-535` | Serve at `/fhir/.well-known`, absolute URLs, validate `aud`, scope revoke |
| SEC-16 | P2 | Any user can self-assert NPI/DEA | `auth.js:227-248` | Admin-only credential fields; NPPES check |
| SEC-17 | P2 | `admin` bypasses every clinical gate (sign, prescribe, dispense, ack criticals) | `middleware/auth.js:37` | Separate clinical privileges from admin |
| SEC-18 | P2 | Document download/delete: tenant-only auth, hard delete, no mime allowlist/AV, data-URL mime overrides field | `records.js:52-101,73,84` | Role + relationship check; soft delete; allowlist + magic bytes; object storage |
| SEC-19 | P2 | Dev fallback API origin `devapi.mdcareproviders.com` hardcoded | `auth-tokens.ts:7`, `authSlice.tsx:12` | Fail fast if base URL missing |
| SEC-20 | P2 | Dev-only invite/reset tokens returned in responses/logs when `NODE_ENV` unset | `patientAccounts.js:176`, `smartAuth.js:635`, `auth.js:145` | Gate on explicit `ALLOW_DEV_TOKENS` |
| SEC-21 | P3 | `X-Client-Route` header echoes patient ids/search on every request; backend never reads it | `services/api.ts:18-22,70-73` | Remove |
| SEC-22 | P3 | Misleading UI claim that break-glass is server-enforced | `NursingFlowsheetWorksurface.tsx:1268` | Remove text until implemented |

## B. Patient safety and data integrity

| ID | Sev | Issue | Location | Proposed fix |
|---|---|---|---|---|
| SAF-01 ✅ fixed 2026-11-12 | P0 | Silent mock fallback on live clinical screens (care plan, I/O, code events, HAI, radiology); session pins to mock | `features/*/config/*Mock.config.ts`, `*WithFallback.ts`, `haiEvent.service.ts:10`, `frontend/.env` | Remove fallbacks; show an explicit error; set every mock flag to `false` in `.env`; add a visible "DEMO DATA" banner wherever mocks remain |
| SAF-02 | P0 | MAR: no due-time generation; `given_by` client-supplied; duplicate administrations; free-text status; rows for nonexistent meds; ungated read | `medication.js:67-98`, `001:298-311`, `MedicationManagementPage.tsx:20-33` | Schedule generator from frequency; `given_by = req.user.id`; unique index on (medication, scheduled_time); status CHECK + reason codes; FK; role gate |
| SAF-03 | P0 | Discontinued CPOE order leaves `medications.is_active` true (and vice versa) | `orders.js:225-236`, `medication.js:46-50` | Propagate status both ways in one transaction; capture reason |
| SAF-04 | P0 | Two medication write paths bypass CDS and RxNorm | `medication.js:33,124` | Route through `orders.js` or add CDS + `rxnormCode` there; code med-rec lines |
| SAF-05 | P0 | Nursing flowsheet signer/timestamp from request body; UI locks before server confirms; `amended` revertible to draft | `inpatientDocs.js:307-319`, `NursingFlowsheetContext.tsx:240-247` | Server-side attribution; lock on server success only; treat `amended` as signed |
| SAF-06 | P0 | Critical lab notifications broadcast to every physician + nurse with PHI; no read-back/escalation; imaging criticals notify nobody; correction that stays critical keeps stale ack | `labs.js:104-115,236-241`, `clinicalOps.js:166-184` | Route to ordering/attending + assigned nurse; read-back fields; escalation job; imaging notification; re-notify on material change |
| SAF-07 ✅ fixed 2026-11-12 | P0 | Dietary tab shows a hardcoded different patient inside the chart | `pages/facesheet/DietaryTab.tsx:9-22`, `data/dietaryDummyData.ts` | Hide tab or replace with empty state bound to route patient until a diet-order backend exists |
| SAF-08 ✅ fixed 2026-11-12 | P1 | Shadow bed placement writes to `localStorage`, never calls ADT | `rooms.service.ts:373-502`, `patientLocation.service.ts:132-160`, `PatientLocationPage.tsx:87,104` | Call `/api/admissions` / `/api/transfers`; delete local store |
| SAF-09 | P1 | Risk assessments (Braden/Morse/GCS/pain) save to dead endpoints and swallow errors | `RiskAssessments.tsx:182-204,345-367,490-511`, `api.ts:907-912` | Build `risk_assessments` table + routes, or remove the page |
| SAF-10 ✅ fixed 2026-11-12 | P1 | Discharge finalize UI gated on fabricated charges/prior auth/eligibility; omits server med-rec gate; client decides initiate from Redux | `dischargeReadinessValidation.ts:271-367`, `dischargeReadiness.service.ts:120-230,540-552`, `useDischargeFinalizeFlow.ts:83-87` | Drive gates from server response only; delete charge mock and fake claim submission |
| SAF-11 | P1 | Lab results (incl. preliminary, unacknowledged criticals) released to portal with no hold | `fhir.js:305-323`, `lib/fhir/observation.js:106-111` | Release policy (final + ack or N-hour window) [clinical review] |
| SAF-12 | P1 | Discharge initiated/confirmed by any clinical role; no discharge order | `adt.js:30,124-133,170-179` | Physician-only initiate (or discharge order type) |
| SAF-13 | P1 | ICD-10 catalog empty on Linux; seeder uses `powershell.exe` | `db/seedIcd10.js:65-77`, `backend/data/icd10/` | Cross-platform unzip; document seeding step |
| SAF-14 | P1 | Held beds unpickable in admit UI (`held` vs `hold`) | `emrBeds.service.ts:109-120` | Match backend enum |
| SAF-15 | P1 | Vitals form drops respiratory rate and height | `pages/patient/Vitals.tsx:331,335` | Re-enable |
| SAF-16 | P1 | Allergy class free text at API vs enum used by CDS equality match | `records.js:154`, `lib/cds/schemas.js:51-60` | Enforce enum server-side |
| SAF-17 | P1 | `cds_alerts.outcome='blocked'` never written (refused overrides unaudited) | `orders.js:125-127`, `cds.js:177-179` | Persist before throwing |
| SAF-18 | P1 | e-Rx transmit failure `error` status rolled back with the transaction | `medication.js:286-289`, `db/pool.js:21-23` | Write status outside the failing tx |
| SAF-19 | P2 | Radiology result/cancel never closes CPOE ledger row | `clinicalOps.js:122-184` | `UPDATE orders` like `labs.js:177` |
| SAF-20 | P2 | Admin bed `available` override skips EVS inspection | `facility.js:161` | Require inspection or log override reason |
| SAF-21 | P2 | `attending_physician_id` unvalidated text (no FK) | `adt.js:60,78`, `001:111` | FK to users, validate role |
| SAF-22 | P2 | Reserving a `dirty` bed creates an unconsumable hold | `bedReservations.js:97` | Only `available` |
| SAF-23 | P2 | Med-rec routes escape module gate; `medRecComplete` not tenant-scoped | `moduleGate.js:15-20`, `lib/medRec.js:5,11` | Add rules; add tenant predicate |
| SAF-24 | P2 | HL7: PV1-10 misused for diagnosis, MSH-10 up to 199 chars, lossy delimiter escaping, no DG1 | `lib/hl7Adt.js:7,24,38` | Add DG1; cap MSH-10 at 20; proper escape sequences |
| SAF-25 | P2 | Order completion by test-name string match; single specimen per order | `labs.js:129,172-175` | Test catalog with ids; per-specimen accession |
| SAF-26 | P2 | Code-event `generate-note` never persisted; `'unit-1'` magic value | `clinicalOps.js:264,353-374` | Create a `clinical_notes` row; remove placeholder |
| SAF-27 | P2 | Admission med rec can duplicate CPOE orders; CDS errors swallowed | `medReconciliation.js:186-195,220-223` | Dedupe by RxNorm; surface errors |

## C. Functional bugs

| ID | Sev | Issue | Location | Proposed fix |
|---|---|---|---|---|
| BUG-01 ✅ fixed 2026-11-12 | P1 | Backend test `patient records` fails: allergy `Status[0].Active` shape | `tests/api.test.js:570`, `records.js` allergy output after migration 021 | Align output shape or update test after confirming which is intended |
| BUG-02 | P1 | Order dashboard acknowledge posts to nonexistent route | `unifiedOrders.service.ts:456-472` | Implement endpoint or remove button |
| BUG-03 | P1 | Clinical Workspace: 4 of 5 tabs call nonexistent `/api/inpatient/clinical/{nursing-notes,handover,vitals,orders,alerts}`; page errors on every open | `clinicalApi.ts:40-103`, `ClinicalWorkflowsPage.tsx:246-268` | Build nursing notes/handover backend; point vitals/orders tabs at real services; remove alerts tab |
| BUG-04 ✅ partly fixed 2026-11-12 (AI endpoints built, dead AI clients removed; non-AI dead pages still open) | P1 | Dead endpoints with live callers: PreventiveScreening, DailyLog, HealthAlerts, HealthSummary, PatientRiskList, AI chatbot, 10 `/ai/health-insights/*`, triage | `api.ts:753,817-859,895-904`, `healthMonitoringService.ts:19-49` | Remove pages/buttons or build backends |
| BUG-05 ✅ fixed 2026-11-12 | P1 | CDI/denial/staffing/radiology/charge mock flags default on | `cdi.service.ts:15`, `denial.service.ts:14`, `staffScheduling.service.ts:32`, `radiologyMock.config.ts:2` | Set `false` in `.env`; invert defaults to real |
| BUG-06 | P2 | Patient list: `19-35` age filter resets; `today`/`thismonth` ignored; name sort maps to created date | `PatientList.tsx:44-67,102-104`, `patients.js:240` | Whitelist + backend support |
| BUG-07 ✅ fixed 2026-11-12 | P2 | Dashboard "Prior auth expiring" from mock store | `dischargeReadinessValidation.ts:9,296-310`, dashboard | Remove until prior auth backend exists |
| BUG-08 | P2 | Critical-results strip links to nonexistent route `/app/patients/:id/lab-orders` | `IpdCriticalResultsStrip.tsx:27` | Link to `/app/facesheet/:id/lab-orders` |
| BUG-09 | P2 | Order dashboard filters applied in JS after `LIMIT 2000`; medication priority hardcoded `routine`; phantom types/statuses in UI | `orders.js:274,320,363-374`, `types/unifiedOrders.ts` | Filter in SQL; carry priority; align types |
| BUG-10 | P2 | `NUMERIC` values returned as strings (vitals, I/O) | `patientData.js:18-27`, `inpatientDocs.js:255-259` | Cast or `pg` type parser |
| BUG-11 | P2 | Flowsheet `shiftInfo` not persisted though client expects it | `inpatientDocs.js:307` | Add to whitelist |
| BUG-12 | P2 | Discharge-summary upsert cannot clear a field | `dischargeReadiness.js:138-146` | Distinguish null from omitted |
| BUG-13 | P2 | Duplicate lab stores (`lab_documents` vs `lab_results`) both shown | `pages/patient/Labs.tsx:96` | Retire `lab_documents` |
| BUG-14 | P2 | Bed board `totalBeds` reflects filtered set | `facility.js:220-226` | Count before filter |
| BUG-15 | P2 | `rxnav.js` dead ternary; stub default in prod | `lib/rxnav.js:12` | Explicit `live` default in prod |
| BUG-16 | P3 | Notes create returns 200 not 201; notes blocked after discharge | `clinicalNotes.js:86,115` | Return 201; allow late entries with flag |
| BUG-17 | P3 | Dead files: `api/` tree, `RiskAssessments.tsx`, `PatientSteps.tsx`, `SignupPage.tsx`, six `pages/reports/*` stubs, `LabAIHighlightsSidebar.tsx`, `NextVisitPrepCard.tsx`, `AIChatAssistant/*`, `FacesheetPatientBanner`/`EncounterBanner` (not found), `vitalsAPI`, `patientAPI` legacy paths | various | Delete after approval |
| BUG-18 | P3 | Stripe patient checkout targets dead `/Patient-Portal/subscription/*` with default bypass granting "active" | `api.ts:789-801`, `config/subscription.ts:7`, `SubscriptionPage.tsx:122` | Remove or wire; never grant entitlement client-side |

## D. Patient Details UI (Phase 4)

Verified in browser at 1440, 768 and 375px on the seeded demo patient.

| ID | Sev | Screen | Symptom | Root cause | Fix |
|---|---|---|---|---|---|
| UI-01 ✅ fixed 2026-11-12 | P1 | All chart tabs, mobile ≤ lg | First ~60px of header, breadcrumb and content hidden under a white strip | `FacesheetSidebar.tsx:23` drawer is 260px with `ltr:-left-[260px]`, but global `.horizontal .sidebar { left:-200px }` (`tailwind.css:180`, written for the 200px main sidebar) has higher specificity, leaving 60px visible at z-50 | Scope the theme rule to the main sidebar (`.sidebar:not(.facesheet-chart-nav)`) or give the drawer `!important`/`translate-x-full` and `w-[200px]`; verify with `getBoundingClientRect().left === -260` |
| UI-02 ✅ fixed 2026-11-12 | P0 | Dietary | Different patient's name/MRN displayed | Dummy data file | SAF-07 |
| UI-03 ✅ fixed 2026-11-12 | P2 | Location | Red error "locked bed does not belong to the chosen room and unit" on first load | Validation runs before user interaction against the shadow placement store | Validate on submit only; remove shadow store (SAF-08) |
| UI-04 ✅ fixed 2026-11-12 | P2 | Invoices, Prior Auth | Fabricated financial data; "(mock invoice list)" text | Mock stores | Hide tabs behind a feature flag with empty state until backends exist |
| UI-05 ✅ fixed 2026-11-12 | P2 | Preventive Screening | Always empty + error toast | Dead endpoint | Remove from routes until built |
| UI-06 | P2 | Diagnoses vs History | Problem list empty while History shows diagnoses | Separate unlinked stores | Product decision: migrate history conditions into problem list or label clearly |
| UI-07 ✅ fixed 2026-11-12 | P2 | Documents, Medications, History modals | No `role="dialog"`, `aria-modal`, focus trap, Escape | Bare `fixed inset-0` divs (`Documents.tsx:398,451,484`, `Medications.tsx:490,672`, `History.tsx:285`) | Reuse `AppModal` / pattern from `Allergies.tsx:649-653` |
| UI-08 ✅ fixed 2026-11-12 | P2 | Most tabs | Search inputs unlabeled | placeholder-only inputs | `aria-label` or visible label |
| UI-09 ✅ fixed 2026-11-12 | P2 | Demographic | Loading state `min-h-screen` inside module card causes blank viewport + double scrollbar | `Demographic.tsx:152` | Use container-relative min height |
| UI-10 ✅ fixed 2026-11-12 | P2 | Documents, History, Immunizations, Medications, Prescriptions, Labs | Fetch failure indistinguishable from "no records" after toast disappears | toast-only error handling | Inline error state with retry |
| UI-11 ✅ fixed 2026-11-12 | P2 | Header | No allergy / code status / isolation banner | `EncounterHeader.tsx` | Add banners (depends on code-status field and HAI isolation) |
| UI-12 ✅ fixed 2026-11-12 | P3 | Navigation | Six modules hidden from rail and mobile strip (vitals, location, history, prescriptions, immunizations, preventive) | `facesheetModules.ts:95-102` | Decide per module: expose or remove |
| UI-13 | P3 | Allergies, Diagnoses, Patient table | Nested horizontal + vertical scroll containers inside module scroll | `min-w-[900px]`/`min-w-[760px]` tables | Acceptable on desktop; card layout under `md` |
| UI-14 ✅ fixed 2026-11-12 | P3 | Documents preview | Inline `maxHeight: 92vh`, conflicting title classes | `Documents.tsx:401-406` | Tailwind classes; fix class conflict |
| UI-15 ✅ fixed 2026-11-12 | P3 | Facesheet | Header fetch failure still renders modules without identity banner | `FacesheetPage.tsx:101-116` | Block modules until patient resolved |
| UI-16 ✅ fixed 2026-11-12 | P3 | Header | Bed list refetched on every window focus for one header line | `EncounterHeader.tsx:56-62` | `staleTime` |
| UI-17 ✅ fixed 2026-11-12 | P3 | Chart tabs | 10 "AI explain" buttons always error | dead `/ai/health-insights/*` | Remove |

Console noise observed on Nursing Flowsheet, Care Plan, Infection Control, Orders tabs: repeated 404s from the fallback-first services above.

## E. Recommended fix order

1. SEC-01, SEC-10, SEC-11 (credential/PHI leaks: hours).
2. SAF-01, SAF-07, SAF-10, BUG-05, BUG-07 (remove fabricated data from clinical/financial screens: 1-2 days).
3. SEC-02 (audit log) and SEC-04/05 (read RBAC) as the first platform module.
4. SAF-02 to SAF-06 inside the Medication, Nursing documentation and Results modules.
5. UI-01 and the Patient Details proposal.
6. Everything else per the roadmap.
