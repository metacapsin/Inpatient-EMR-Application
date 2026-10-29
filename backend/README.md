# EMR backend (Express + PostgreSQL)

REST API for the Inpatient EMR frontend in `frontend/`. It keeps the request/response contracts the React app
already uses (same paths, `{ status, data }` envelopes, `_id`/`id` mirrors), so the frontend only needs its base URL
pointed here.

- **Runtime:** Node 20+ (developed on 24), Express 5, ES modules
- **Database:** PostgreSQL 14+ via `pg` (plain SQL migrations, parameterised queries only)
- **Auth:** JWT access token (15 min) + rotating refresh token (hashed in DB), bcrypt passwords, role checks, per-tenant scoping
- **Validation:** `zod` on every write; Postgres constraint errors are mapped to 4xx

## Quick start

From the repository root:

```bash
npm run install:all     # frontend + backend dependencies
cp backend/.env.example backend/.env    # then edit secrets (see below)
npm run dev:all         # embedded PostgreSQL + API (:4000) + Vite (:5173)
npm run db:setup        # in a second terminal, once the database is up: migrations + demo data
```

`dev:all` starts three processes: `dev:db` (embedded PostgreSQL), `dev:backend` (API, auto-restarts on change) and
`dev:frontend` (Vite). Run any of them on its own, e.g. `npm run dev:backend`.

Frontend wiring lives in `.env.local` in `frontend/` (git-ignored):

```
VITE_EMR_API_BASE_URL=http://localhost:4000
VITE_USE_MOCK_API=false
VITE_MEDICATION_API_MOCK=false
VITE_CARE_PLAN_MOCK=false
VITE_IO_MOCK=false
VITE_HAI_EVENT_MOCK=false
VITE_CDI_DENIAL_MOCK=false
VITE_STAFF_SCHEDULING_MOCK=false
VITE_STAFFING_API_MOCK=false
VITE_RADIOLOGY_MOCK=false
VITE_CODE_EVENT_MOCK=false
```

Modules not listed there (quality measures, unified orders, EVS) still use their in-memory mocks because no backend
routes exist for them yet. Appointments, calendar settings and the patient record lists have no mock flag: they always
call the API.

## PostgreSQL

Two options; the API only needs `DATABASE_URL`.

1. **Embedded (default for development, no install or admin rights).** `npm run db:embedded` downloads PostgreSQL binaries
   through the `embedded-postgres` npm package and runs a real server using the credentials/port from `DATABASE_URL`.
   Data is stored in `backend/.pgdata` (git-ignored). On first run it initialises the cluster and creates the database.
2. **Your own PostgreSQL.** Create a role and database, then put them in `DATABASE_URL`:
   ```sql
   CREATE ROLE emr_user LOGIN PASSWORD '<password>';
   CREATE DATABASE emr OWNER emr_user;
   ```
   Skip `dev:db` and run `npm run dev:backend` + `npm run dev:frontend`.

### Environment (`backend/.env`, never committed)

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default 4000) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `DATABASE_URL` | `postgres://user:password@host:port/db` |
| `PGDATA_DIR` | Embedded server data directory |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing keys. Use long random values, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | e.g. `15m`, `7d` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Used only by `db:seed` for the demo accounts |
| `GEMINI_API_KEY` | Reserved: the Gemini key currently used client-side should move behind a backend route |

### Migrations and seed

```bash
npm run db:migrate            # applies backend/src/db/migrations/*.sql in order (tracked in schema_migrations)
npm run db:seed               # demo tenant, 5 users (one per role), facility, 6 patients, 2 admitted, meds, vitals
npm --prefix backend run db:seed -- --reset   # wipes ALL data, then seeds
```

Demo users: `SEED_ADMIN_EMAIL` plus `physician@`, `nurse@`, `pharmacist@`, `billing@` on the same domain. All share
`SEED_ADMIN_PASSWORD`. The seed refuses to run when `NODE_ENV=production` unless `SEED_ALLOW_PROD=1`.

## Schema

IDs are text UUIDs. Every clinical table carries `tenant_id` and every query is scoped to the caller's tenant.

| Area | Tables |
| --- | --- |
| Identity | `tenants`, `users`, `refresh_tokens`, `notifications` |
| Facility | `wards` → `rooms` → `beds` (cascading FKs, unique names within parent) |
| Patients / ADT | `patients`, `encounters` (partial unique indexes: one active encounter per patient and per bed), `bed_transfers` |
| Clinical | `health_metrics` (vitals), `care_plans` + `nanda_diagnoses`, `io_records`, `nursing_flowsheets` + `nursing_flowsheet_versions`, `consents`, `patient_rights_requests`, `hai_events`, `visitors`, `family_contacts` |
| Medication | `medications`, `mar_entries`, `prn_stat_orders`, `prescriptions`, `dispenses`, `discharge_medications` |
| Revenue cycle | `cdi_queries`, `claim_denials` |
| Appointments | `service_locations`, `visit_types`, `calendar_general_settings`, `provider_calendar_settings` (weekly hours per provider and location), `appointments` (local date + time, no timezone) |
| Patient records | `patient_documents` (file bytes in `BYTEA`), `patient_allergies`, `patient_immunizations`, `history_categories`, `patient_history`, `lab_orders`, `lab_documents` |
| Staffing | `staff_profiles` (clinical role, certifications, float pool), `staff_shifts`, `staff_coverage_rules`, `staffing_assignments` + `staffing_nurse_assignments`; `wards.care_model` drives nurse:patient ratios |
| Orders / events | `radiology_orders`, `code_events` (timeline and team as JSONB) |
| Problem list | `icd10_codes` (CMS/NCHS reference), `problems` (patient medical problem list; distinct from NANDA) |

Nested documents that the UI treats as one unit (care-plan diagnoses/goals, flowsheet sections, consent form extras) are
stored as `JSONB` next to the indexed columns used for lookups.

## API overview

Public: `GET /health`, `GET /health/db`, `POST /login`, `POST /auth/refresh`, `POST /forgotPassword`,
`POST /auth/reset-password`, `POST /auth/register` (creates a tenant + admin). Everything else needs
`Authorization: Bearer <token>`.

| Module | Endpoints |
| --- | --- |
| Auth/users | `POST /auth/logout`, `GET/PUT /auth/profile`, `GET/PUT /tenants/current`, `GET /tenants/users`, `POST /auth/register-user`, `PUT/DELETE /auth/users/:id` (admin) |
| Facility | `GET/POST/PUT/DELETE` under `/Wards/*`, `/Rooms/*`, `/Beds/*`; `GET /Beds/getLiveBedBoard` |
| Patients | `GET /Patient/getAllPatientListPaginated`, `GET /Patient/getPatientById/:id`, `POST /Patient/createPatient`, `PUT /Patient/updatePatientById/:id`, `DELETE /Patient/deletePatientById/:id` (soft) |
| ADT | `POST /api/admissions`, `GET /api/admissions/active`, `POST /api/transfers`, `POST /api/discharges` (`phase: initiate \| confirm`), `POST /api/discharges/confirm` |
| Dashboard | `GET /dashboard/ipd`, `GET /notifications`, `PUT /notifications/:id/read`, `DELETE /notifications/:id` |
| Vitals | `POST /api/health/metrics/add`, `GET /api/health/metrics/{patient/:id,latest,trend}` |
| Visitors / family | `/Visitors/*`, `/PatientFamily/*` |
| Care plan | `/api/CarePlan/{nanda/search,create,:encounterId,:planId,:planId/goalStatus}` |
| I/O | `POST /api/IORecord/add`, `GET /api/IORecord/{balance,timeline}/:encounterId` |
| Flowsheet | `POST /api/NursingFlowsheet/save`, `GET /api/NursingFlowsheet/:encounterId`, `.../history/:encounterId` |
| Consents | `/api/Consent/{create,encounter/:id,completeness/:id,:id/sign,:id/revoke}`, `/api/PatientRights/*` |
| Medication | `/api/patients/:id/medications`, `/api/mar`, `/api/prn-stat`, `/api/prescriptions`, `/api/dispense`, `/api/discharge`, `/api/discharges/:encounterId/medications` |
| Infection control | `GET /api/HAIEvent/{encounter/:id,summary/:unitId}`, `POST /api/HAIEvent` |
| CDI / denials | `/api/CDI/*`, `/api/Denial/*` |
| Appointments | `POST /Appointment/{getAppointmentListPaginated,createAppointment,conflict,getProviderAvailableSlots}`, `PUT /Appointment/updateAppointment`, `GET /Appointment/{getAppointmentById/:id,getAppointmentListByPatientId/:id}`, `DELETE /appointments/:id`, `PUT /appointments/:id/status`, `GET /appointments/dashboard-stats`, `POST /setting/getDropdownListData` |
| Calendar setup | `GET /ProviderProfile/getProviderList` (active physicians), `/ServiceLocation/*`, `/VisitType/*`, `/CalendarSetting/{getGeneralCalendarSetting,updateGeneralCalendarSetting,getProviderServiceLocations/:id,saveProviderCalendarSetting}` (writes admin-only) |
| Patient records | `GET /Patient/{getAllDocument,getDocumentById,downloadDocument,getAllAllergyList?rcopiaID=,getPatientImmunizationList,getPatientImmunizationById,downloadImmunization,getAllHistoryCategories,getAllPatientHistory,getPatientHistoryById}`, `GET /lab-orders/by-patient/:id`, `GET /lab-orders/:id`, `GET /LabDetails/{getAllLabDocuments,getLabDocumentById,downloadLabDocument}`; writes: `POST /Patient/{uploadDocument,createAllergy,createImmunization,createPatientHistory}`, `POST|PUT /lab-orders`, `POST /LabDetails/createLabDocument` |
| Staff scheduling | `/api/inpatient/staff-scheduling/{shift-types,staff,shifts,open-shifts,coverage-rules,me/shifts}` |
| Live staffing | `/api/Staffing/{assignment/:unitId/:date/:shift,assignment,assignment/:id,floatPool/:tenantId,ratioCheck/:unitId,unit/:id/careModel}` (`unitId` = ward id) |
| Radiology | `/api/Radiology/{order,encounter/:id,order/:id,order/:id/acknowledge,.../result,.../cancel,.../critical}` |
| Code events | `/api/CodeEvent/{activate,active/:unitId,patient/:id,:id,:id/timeline,:id/team,:id/close,:id/generate-note}` |
| Problem list / ICD-10 | `GET /api/icd10/search?q=`, `GET|POST /api/patients/:patientId/problems`, `PATCH /api/problems/:id` (no hard delete; use `entered_in_error`) |

ICD-10-CM catalog import (after migrate):

```bash
# Place icd10cm-order-YYYY.txt under backend/data/icd10/ (see that folder's README), or:
ICD10_AUTO_DOWNLOAD=1 npm run db:seed:icd10
```

Roles: `admin` can do everything; facility management and user administration are admin-only; clinical writes need
`physician`/`nurse`/`staff` as appropriate (see `requireRole` in each route file); pharmacy dispensing needs
`pharmacist`/`physician`; CDI/denials need `billing`/`physician`. Appointments are written by `physician`/`nurse`/`staff`; calendar
setup, coverage rules and care models are admin-only (shift scheduling also allows `staff`); live staffing boards are
edited by `nurse`/`staff`; radiology orders and results need `physician`, acknowledging/critical flags `physician`/`nurse`; code
events `physician`/`nurse`.

Notes on behaviour that is not obvious from the routes:

- **Appointments:** a provider is an active user with role `physician`. Slots come from `provider_calendar_settings` (default
  Mon-Fri 09:00-17:00 in 30 min steps when none is saved), minus the provider's non-cancelled bookings; creating or moving an
  appointment into an overlapping time is a 409. Dates are accepted as `MM/dd/yyyy` or `yyyy-MM-dd` and returned as `MM/dd/yyyy`.
- **Documents:** uploads are JSON with `contentBase64` (data URL or raw), so the 2 MB body limit caps file size.
- **Staffing:** a board is created on first open and its roster seeded from scheduled `staff_shifts` for that ward/date/shift.
  Shift boundaries are treated as UTC calendar days. Acuity chips are derived from the encounter's admission type.
- **Code events:** a code's unit is the ward of the patient's bed. `active/all` and the frontend's placeholder `active/unit-1`
  return every active code in the tenant. Duration is computed from the call and end times, not trusted from the client.
  `listOnShiftStaffForCodeEvent` in the frontend still reads the mock roster.

## Tests

```bash
npm run test:backend   # needs the database running and migrated
```

`backend/tests/api.test.js` drives the real HTTP app against the real database. Each run creates throw-away tenants via
`/auth/register` and deletes them afterwards, so seeded data is untouched.

## Known gaps

- Not implemented (frontend still mocked or calling the old hosted API): patient portal, quality measures, EVS, unified
  orders, billing/subscriptions (Stripe/Razorpay), Azure/AWS cost modules, AI health-insights endpoints, and the patient
  pages for medications, prescriptions, diagnoses and notes (`/Patient/getAll{Medication,Prescription,Diagnoses}List`,
  `/Patient/getPatientWiseNotesList`) which still call the old API.
- Radiology order drafts stay in the browser's localStorage when `VITE_RADIOLOGY_MOCK=false`.
- `forgotPassword` has no mail transport: in development the reset token is printed to the API log.
- No DRG grouper: `GET /api/CDI/drg/:encounterId` is not implemented; DRGs are entered manually.
- The legacy Mongoose fragments in `/api` (care plan, CDI, denial models) are unused and were left untouched; their
  care-plan rules were ported into `src/routes/inpatientDocs.js`.
