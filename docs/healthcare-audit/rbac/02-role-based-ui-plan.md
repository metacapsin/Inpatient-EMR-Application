# RBAC Phase 2: Department Portals and Role-Based UI

Date: 2026-11-17. Status: **proposal, not started**. Builds on `01-completed-work.md` (read/action gating done 2026-11-13). Nothing in this document is implemented yet.

## 1. Where the app stands today

| Layer | Current state | Evidence |
|---|---|---|
| Roles | 6 fixed roles: `admin`, `physician`, `nurse`, `pharmacist`, `billing`, `staff` | `001_init.sql:17` CHECK constraint, `OnboardingWizardPage.tsx:11` |
| Backend gating | `requireRole(...)` per route, admin bypasses everything except 7 clinical attestations (`requireClinicalRole`) | `middleware/auth.js`; 75 gates across `routes/*.js` |
| Frontend gating | `RoleGuard` on 1 route (CDI), `roles` field on 2 nav links; everything else is visible to every role | `RoleGuard.tsx`, `mainNavConfig.ts`, `settingsNav.config.ts` |
| Navigation | 4 fixed dropdowns (Patients, Clinical, Operations, Billing) + Dashboard + Settings, identical for every role | `mainNavConfig.ts` |
| Dashboard | One shared IPD dashboard; only the "acknowledge critical" button is role-aware | `Dashboard.tsx:63-65` |
| Department scoping | None. No `departments` table, `users` has no department/unit column | `001_init.sql` |
| Lab flow | CPOE places order → collect → enter result → flag critical → acknowledge. No file attachment, no lab-tech role, no notification to the orderer | `labs.js:163-310`, `module-inventory.md` #39, #41 |
| Imaging flow | Order → acknowledge → result → amend → critical flag. Same gaps as labs | `module-inventory.md` #40 |
| Documents | Upload/list/download/delete API exists, **no upload UI**, no request queue | `records.js:67`, `module-inventory.md` #10 |
| Notifications | `notifications` table + bell + mark-read exist, but nothing produces them on result events | `002_notifications.sql`, `dashboard.js:96` |
| Legacy drift | `clinicalRole.ts` normalises roles to the dead Mongo backend's names (`provider`, `clinical-staff`) | `features/clinical-workflows/clinicalRole.ts` |

Conclusion: the backend boundary is mostly real, but the UI shows every role every screen. The ask is to turn this into **department portals**: each person logs in and sees only the screens, nav groups, dashboard, and facesheet tabs for their job, plus a request → fulfil → review loop between departments (the lab example).

## 2. Hospital sectors and roles

A real inpatient hospital breaks into these sectors. The right-hand column is what we map each to in the app. Twelve roles total, eight departments. The six that exist are kept so no data migration is needed.

| # | Department (sector) | Real-world staff | App role | Status |
|---|---|---|---|---|
| 1 | Administration & IT | Hospital admin, IT, compliance officer | `admin` | exists |
| 2 | Patient Access / Front Office | Registration clerk, admissions coordinator, appointment desk, bed coordinator | `registration` (rename of today's `staff`), `bed_manager` | `staff` exists; `bed_manager` new |
| 3 | Medical Staff | Attending, hospitalist, consultant, resident, radiologist (reads) | `physician` | exists |
| 4 | Nursing | Staff RN/LVN, charge nurse, CNA | `nurse`, `charge_nurse` | `nurse` exists; `charge_nurse` new |
| 5 | Pharmacy | Clinical pharmacist, pharmacy tech | `pharmacist` | exists |
| 6 | Diagnostics | Lab technician / phlebotomist, radiology technologist | `lab_tech`, `radiology_tech` | new |
| 7 | Health Information Management (Medical Records) | HIM clerk, scanning/release-of-information staff, coder | `him` | new |
| 8 | Revenue Cycle | Billing, coding, denials, CDI specialist | `billing` | exists |
| 9 | Support Services | Environmental services (housekeeping), transport | `evs` | new |
| 10 | Quality & Infection Control | Quality analyst, infection preventionist | `quality` | new |
| 11 | Allied Health (Phase 3) | PT/OT/RT, dietitian, social work | `allied_health` | new, deferred |

Recommendation: ship roles 1-8 in this phase (`lab_tech`, `radiology_tech`, `him`, `bed_manager`, `charge_nurse` added; `staff` kept as the stored value but labelled "Registration / Front desk" in the UI). Add `evs`, `quality`, `allied_health` in Phase 3 when those modules have real backends. Keep `staff` as the DB value for registration to avoid rewriting 20 existing `requireRole('staff')` gates.

## 3. Permission model

Hard-coded role lists in 75 route gates do not scale to 12 roles. Introduce a **permission registry** and derive both backend and frontend gating from it.

### 3.1 Permission keys

Dot-namespaced, `module.resource.action`. Initial set (about 60 keys), grouped:

```
patients.view  patients.register  patients.edit  patients.merge
adt.admit  adt.transfer  adt.discharge  adt.view
beds.view  beds.manage  beds.reserve  evs.queue.view  evs.queue.work
appointments.view  appointments.manage
notes.view  notes.physician.write  notes.physician.sign  notes.nursing.write  notes.nursing.sign
vitals.view  vitals.record  flowsheet.view  flowsheet.write  careplan.view  careplan.write
orders.view  orders.place  orders.cosign  orders.acknowledge  orders.cancel
labs.worklist  labs.collect  labs.result.enter  labs.result.upload  labs.result.verify  labs.result.view  labs.critical.acknowledge
imaging.worklist  imaging.perform  imaging.result.upload  imaging.result.view  imaging.critical.acknowledge
meds.view  meds.prescribe  meds.sign  meds.verify  meds.dispense  mar.view  mar.administer  medrec.complete
documents.view  documents.upload  documents.request  documents.release  documents.delete
problems.view  problems.write  allergies.view  allergies.write  consents.view  consents.capture
discharge.view  discharge.checklist  discharge.summary.sign  discharge.finalize
billing.denials  billing.cdi  billing.charges  billing.insurance  billing.eligibility  billing.invoices
quality.infection.view  quality.measures.view  reports.view
staffing.view  staffing.manage
settings.facility  settings.users  settings.roles  settings.integrations  settings.audit  settings.security
ai.assistant
```

### 3.2 Role → permission map (summary)

Full matrix is in section 5. Rules:

- `admin` gets every `*.view`, every `settings.*`, user management, and all non-clinical writes. It never gets `*.sign`, `mar.administer`, `meds.dispense`, `labs.result.verify`, `labs.critical.acknowledge`, `medrec.complete`, `discharge.summary.sign` (preserves SEC-17).
- `physician`: all clinical view + `orders.*`, `notes.physician.*`, `meds.prescribe/sign`, `labs.critical.acknowledge`, `discharge.summary.sign`, `billing.cdi`.
- `nurse`: clinical view, `vitals.record`, `flowsheet.*`, `notes.nursing.*`, `careplan.write`, `orders.acknowledge`, `mar.administer`, `labs.collect`, `labs.critical.acknowledge`, `discharge.checklist`, `documents.request`, `evs.queue.view`.
- `charge_nurse`: `nurse` + `beds.manage`, `staffing.view`, `adt.transfer`.
- `pharmacist`: `meds.view/verify/dispense`, `mar.view`, `medrec.complete`, `orders.view`, `allergies.view`, `labs.result.view`, `problems.view`.
- `lab_tech`: `patients.view` (demographics only), `labs.worklist`, `labs.collect`, `labs.result.enter/upload`, `labs.result.view`, `orders.view` (lab only).
- `radiology_tech`: `patients.view`, `imaging.worklist/perform/result.upload/result.view`, `orders.view` (imaging only).
- `him`: `patients.view`, `documents.*`, `consents.view`, `problems.view`, `notes.view` (signed only), `settings.audit` (read).
- `staff` (Registration): `patients.register/edit/view`, `appointments.manage`, `adt.admit`, `beds.view`, `beds.reserve`, `billing.insurance`, `billing.eligibility`, `consents.capture`.
- `bed_manager`: `beds.*`, `adt.transfer`, `adt.view`, `evs.queue.view`, `patients.view`.
- `billing`: `billing.*`, `patients.view` (demographics + insurance), `discharge.view`, `documents.view` (billing category).
- `evs`: `evs.queue.*`, `beds.view` (status only).
- `quality`: `quality.*`, `reports.view`, read-only clinical views.

### 3.3 Storage

Phase 2 (this plan): one static module shared by both sides.

- `backend/src/lib/permissions.js`: `PERMISSIONS` (set of keys) and `ROLE_PERMISSIONS` (role → key[]). Export `roleHas(role, key)`.
- `frontend/src/auth/permissions.ts`: generated copy of the same map (a `node scripts/sync-permissions.mjs` emits the TS file from the JS source; CI fails if they drift).

Phase 3: `role_permissions(tenant_id, role, permission, granted)` table so a hospital can turn individual permissions on or off per role in Settings → Roles & Permissions. `requireAuth` already reloads the user row per request, so adding the effective permission set to `req.user.permissions` there is one query with no caching problem.

### 3.4 Backend enforcement

- New `requirePermission(...keys)` in `middleware/auth.js`: passes if the role has any listed key. No implicit admin bypass; admin's breadth comes from the map, which is where SEC-17 is encoded.
- Migrate gates incrementally: `requireRole('physician','nurse','staff')` on `GET /clinical/notes` becomes `requirePermission('notes.view')`. The 75 call sites convert file by file; `requireRole` stays exported until the last one is gone.
- `GET /auth/me` (or the profile load in `App.tsx:50`) returns `permissions: string[]` and `landingRoute` so the frontend never re-derives the map at runtime.
- Department-restricted data: `lab_tech` listing orders gets `WHERE order_type = 'lab'` applied server-side by the permission (`orders.view` scoped by `labs.worklist`), not by the client filter.

### 3.5 Frontend enforcement

- `usePermissions()` hook reading `state.auth.permissions`; `can(key)`.
- `<Can perm="labs.result.upload">` render helper; `PermissionGuard` route wrapper replaces `RoleGuard` (keep `RoleGuard` as a thin alias until migrated).
- `MainNavLink` gets `permission?: string`; `MainNavMenu` already filters by `roles`, extend to `permission`. Empty groups disappear.
- Facesheet tab registry gets a `permission` per tab so a billing user opening a patient sees Demographics, Insurance, Invoices, Documents (billing) only.
- Role landing route: `ROLE_HOME = { physician: '/app/worklist/provider', nurse: '/app/worklist/nursing', lab_tech: '/app/lab/worklist', ... }`; `/app` redirects there instead of `/app/dashboard`.
- Delete `clinicalRole.ts` aliasing (`provider`, `clinical-staff`); replace `canNursingActions` etc. with `can()` calls. This removes the last dependency on the dead Mongo backend's role names.

## 4. Cross-department workflow: request → fulfil → review

The lab example generalises. Every inter-department hand-off is the same state machine; we implement it once per queue type on top of what already exists.

```
 Requester (ward)            Fulfilling department             Reviewer (ward)
 ─────────────────           ──────────────────────            ───────────────
 physician/nurse places  →   item appears in dept worklist  →  result/report lands in
 order or request            (lab_tech / radiology_tech /      requester's Results Inbox
                             him / pharmacist)                 + facesheet tab
                                   │                                  │
                             accept → in progress →              review → acknowledge
                             enter values / upload file →        (critical: mandatory ack,
                             mark complete (optionally verify)   escalation if unacked)
                                   │
                             notification row created for
                             ordering provider + unit nurses
```

### 4.1 Laboratory (extends existing `labs.js`)

| Step | Who | Exists? | Work |
|---|---|---|---|
| Place lab order | physician (nurse per protocol) | yes, CPOE `POST /api/orders` | none |
| Lab worklist | `lab_tech` | no | `GET /api/lab/worklist?status=` (orders of type lab, grouped ordered / collected / in-progress / resulted); new page `/app/lab/worklist` |
| Collect specimen | `lab_tech`, `nurse` | yes `POST /lab-orders/:id/collect` | gate becomes `labs.collect` |
| Enter result values | `lab_tech` | yes `POST /lab-orders/:id/results` | gate `labs.result.enter`; add `lab_tech` to allowed roles |
| Upload report file (PDF/image) | `lab_tech` | partial: `records.js uploadDocument` exists but is not linked to a lab order | add `lab_result_attachments(result_id, document_id)`; reuse the document upload endpoint; result entry form gets a drop-zone |
| Verify / release | pathologist (`physician`) or senior `lab_tech` | no | `POST /lab-results/:rid/verify` sets `status='final'`; until then result is `preliminary` and hidden from the portal |
| Notify requester | system | table exists, no producer | on final result: insert `notifications` for ordering provider; on critical: also unit nurses and charge nurse |
| Review | physician / nurse | yes (facesheet Labs tab, critical worklist) | new `/app/worklist/results` inbox: unreviewed finals for my patients, with "mark reviewed" (non-critical) and existing acknowledge (critical) |

### 4.2 Imaging / radiology

Same shape on `orders.js` imaging type: `radiology_tech` worklist (`/app/imaging/worklist`), perform → upload report + optional image link, radiologist (`physician`) reads and finalises, provider reviews. Critical finding flag already exists.

### 4.3 Medical records (HIM)

New `record_requests` table: `id, tenant_id, patient_id, encounter_id, requested_by, request_type (outside_records | scanned_consent | prior_imaging | other), notes, status (open | in_progress | fulfilled | rejected), fulfilled_document_id, created_at, fulfilled_at`. Routes: `POST /api/record-requests` (ward), `GET /api/record-requests?status=` (HIM queue), `POST /api/record-requests/:id/fulfil` (uploads document, links it, notifies requester). UI: "Request records" button on facesheet Documents tab for ward roles; `/app/him/queue` for `him`. This also delivers the missing Documents upload UI from inventory #10.

### 4.4 Pharmacy

Pharmacy verification queue (inventory #35) is the same pattern on medication orders: order placed → `pharmacist` worklist → verify / reject → nurse sees it on MAR. Build it on the same worklist component.

### 4.5 Shared pieces built once

- `DepartmentWorklist` component: tabs by status, patient/bed column, age of request, assign-to-me, filters. Used by lab, imaging, HIM, pharmacy, EVS (EVS already has its own; align visually, don't rewrite).
- Notification producer helper `notify(tenantId, userIds, type, message, metadata)` in `lib/notifications.js`, plus `GET /notifications` already powers the bell.
- Results Inbox page for ward roles.

## 5. Screen → role access matrix

F = full (view + act), V = view only, – = hidden. Admin column reflects SEC-17: admin sees everything but cannot perform clinical attestations.

| Screen / module | admin | physician | nurse | charge_nurse | pharmacist | lab_tech | radiology_tech | him | staff (registration) | bed_manager | billing | evs | quality |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard (role landing) | F | Provider worklist | Nursing worklist | Nursing + unit | Pharmacy queue | Lab worklist | Imaging worklist | HIM queue | Front-desk | Bed board | Revenue | EVS queue | Quality |
| Patient list | F | F | F | F | V | V (demographics) | V (demographics) | V | F | V | V (demo + insurance) | – | V |
| Register / edit patient | F | – | – | – | – | – | – | – | F | – | – | – | – |
| Appointments | F | V | V | V | – | – | – | – | F | – | – | – | – |
| ADT admit / transfer / discharge | F | V | V | transfer | – | – | – | – | admit | transfer | – | – | – |
| Bed board | F | V | V | F | – | – | – | – | V | F | – | V (status) | – |
| EVS queue | F | – | request | request | – | – | – | – | – | V | – | F | – |
| Clinical workspace (notes, vitals) | V | F | F (nursing) | F (nursing) | V | – | – | V (signed) | – | – | – | – | V |
| Orders dashboard | V | F | ack | ack | V (meds) | V (lab) | V (imaging) | – | – | – | – | – | – |
| Lab worklist / result entry / upload | V | – | collect | collect | – | F | – | – | – | – | – | – | – |
| Imaging worklist / report upload | V | read + finalise | – | – | – | – | F | – | – | – | – | – | – |
| Results inbox | V | F | F | F | V | – | – | – | – | – | – | – | – |
| Medication management / MAR | V | prescribe | administer | administer | verify + dispense | – | – | – | – | – | – | – | – |
| Med reconciliation | V | F | F | F | F | – | – | – | – | – | – | – | – |
| Care plan | V | F | F | F | – | – | – | – | – | – | – | – | – |
| Documents (facesheet tab) | F | V + request | V + request | V + request | V | – | – | F (upload, release) | V | – | V (billing docs) | – | V |
| HIM request queue | V | – | – | – | – | – | – | F | – | – | – | – | – |
| Consents | F | V | capture | capture | – | – | – | V | capture | – | – | – | – |
| Discharge readiness | V | summary + finalize | checklist | checklist | meds handoff | – | – | – | – | – | billing tab | – | – |
| Denials / CDI / charges | V | CDI replies | – | – | – | – | – | – | – | – | F | – | – |
| Insurance / eligibility | F | – | – | – | – | – | – | – | F | – | F | – | – |
| Infection analytics | V | V | V | V | – | – | – | – | – | – | – | – | F |
| Quality measures / reports | V | V | – | V | – | – | – | – | – | – | – | – | F |
| Staffing | F | – | V | F | – | – | – | – | – | – | – | – | – |
| Settings: facility, users, roles, integrations, security | F | – | – | – | – | – | – | – | – | – | – | – | – |
| Settings: audit trail | F | – | – | – | – | – | – | V | – | – | – | – | V |
| AI assistant | F | F | F | F | F | – | – | – | – | – | – | – | – |

Facesheet tabs follow the same table: a role sees a tab only if it has the matching `*.view` permission.

## 6. Implementation phases

Effort assumes one developer; multiply by the team.

### Phase A: permission foundation (1 week)

1. Migration `03x_roles_phase2.sql`: widen `users.role` CHECK to the 12 roles; add `departments(id, tenant_id, name, type)` and `users.department_id` (nullable, unused by gates yet).
2. `backend/src/lib/permissions.js` + `requirePermission` middleware + `GET /auth/me` returns `permissions`, `landingRoute`.
3. `scripts/sync-permissions.mjs` → `frontend/src/auth/permissions.ts`; CI drift check.
4. Frontend: `usePermissions`, `<Can>`, `PermissionGuard`, `permission` field on nav + settings nav, `/app` → role landing redirect, role options in onboarding and user management.
5. Convert all 75 `requireRole` gates to `requirePermission`; extend `tests/rbac.test.js` with one allow and one deny test per new role.
6. Remove `clinicalRole.ts` aliasing.

### Phase B: department portals (2 weeks)

1. Nav groups per role (hide empty groups), facesheet tab permission filter.
2. Role landing pages: Provider worklist (my patients, unsigned notes, unacked results, pending cosigns), Nursing worklist (my unit's patients, due meds, due vitals, open tasks), Lab worklist, Imaging worklist, HIM queue, Front-desk (today's admissions, appointments, pending registrations), Revenue (existing denials/CDI tiles), Pharmacy queue (verification). Each reuses `DepartmentWorklist`.
3. Replace the single Dashboard with the per-role landing while keeping `/app/dashboard` for admin.

### Phase C: request → fulfil → review (2 weeks)

1. Labs: `lab_result_attachments`, upload in result entry, verify/finalise, notification producer, Results Inbox.
2. Imaging: tech worklist + report upload + radiologist finalise + notification.
3. HIM: `record_requests` table, routes, request button, HIM queue, fulfil-with-upload.
4. Pharmacy verification queue on medication orders.
5. Tests: one integration test per flow proving a `lab_tech` cannot read notes, a `nurse` cannot enter a result, and a result upload notifies the orderer.

### Phase D: hardening (1 week)

1. `role_permissions` tenant overrides + Settings → Roles & Permissions screen (admin only).
2. Unit scoping: nurse and charge_nurse lists default to their `department_id`; lab and imaging worklists filter by facility.
3. Audit event on every 403 (ties into the audit-logging module).
4. Escalation: critical result unacknowledged for 30 minutes notifies charge nurse, then attending.

## 7. Files touched (Phase A and B)

Backend: `src/middleware/auth.js`, new `src/lib/permissions.js`, new `src/lib/notifications.js`, `src/routes/auth.js` (me endpoint, role options), `src/routes/labs.js`, `src/routes/orders.js`, `src/routes/records.js`, every other `src/routes/*.js` gate, new `src/routes/recordRequests.js`, `src/routes/dashboard.js` (worklist endpoints), `src/db/migrations/03x_*.sql`, `tests/rbac.test.js`.

Frontend: new `src/auth/permissions.ts`, `src/auth/usePermissions.ts`, `src/components/auth/Can.tsx`, `src/components/auth/PermissionGuard.tsx`, `src/components/Layouts/mainNavConfig.ts`, `MainNavMenu.tsx`, `src/modules/settings/config/settingsNav.config.ts`, `src/router/routes.tsx`, `src/pages/facesheet/FacesheetPage.tsx` (tab registry), new `src/pages/worklists/*`, new `src/pages/lab/LabWorklistPage.tsx`, new `src/pages/imaging/ImagingWorklistPage.tsx`, new `src/pages/him/RecordRequestQueuePage.tsx`, `src/pages/onboarding/OnboardingWizardPage.tsx`, `src/store/authSlice.tsx` (permissions), delete `src/features/clinical-workflows/clinicalRole.ts`.

## 8. Open decisions for the customer

1. Does the hospital want **radiologist** as a separate role or as `physician` with a specialty flag? (Plan assumes specialty flag.)
2. Should lab results require a **verify step** before clinicians see them, or release on entry? (Plan assumes verify for `lab_tech` entries, immediate release for interfaced LIS results later.)
3. Is **unit scoping** for nurses wanted at launch, or is seeing all inpatients acceptable in a small facility?
4. Are `evs`, `quality`, `allied_health` logins needed in the first release, or do those teams work from paper and the admin account for now?

## 9. Shareable customer design

An interactive one-page design (department map, role switcher showing each role's portal, access matrix, lab request → upload → review flow, rollout timeline) is published as a Claude artifact; the link is in the session summary. Source is kept in this repo at `docs/healthcare-audit/rbac/role-based-ui-design.html` so it can be regenerated or handed to the customer as a file.
