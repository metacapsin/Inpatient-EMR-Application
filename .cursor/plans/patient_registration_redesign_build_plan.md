# Patient Registration Redesign Build Plan

**For a fresh Claude Code session in this repo.** Standalone and implementation-ready, same shape as the other plans in `.cursor/plans/`. Source of this plan: a direct field-by-field reference extraction from the sibling project `/home/jatin/Desktop/EMR/EMR-ng` (a separate, more mature Angular EMR codebase the user wants used as a format reference — **read-only reference, not part of this repo, never edited**), plus a full audit of this app's current registration flow and every screen that displays patient data.

Read Phase 0 before writing code.

---

## Phase 0 — Orientation (read first)

Repo conventions are unchanged from the other plans in this batch (routes in `backend/src/routes/*.js`, `ok()`/`created()` envelope, `row()`/`rows()` snake→camel via `patientOut()` in this specific file, Zod via `parse()`, numbered migrations, `withTx`).

**Migration numbering note**: five other plans from this same research cycle (`problem_list_icd10`, `physician_hp`, `settings_module_backend`, `bed_booking`, plus CPOE's own `006`) each claim or already occupy a migration number. Check `backend/src/db/migrations/` at actual build time and number this plan's migration sequentially — don't assume a fixed number here.

**The single most important architectural fact, verified directly (not from any agent's secondhand report)**: `backend/src/routes/patients.js` has exactly **one** base query (`PATIENT_SELECT`, line 39) and **one** output shaper (`patientOut()`, line 48), reused by `GET /Patient/getPatientById/:id`, `GET /Patient/getPatientDemographics/:id`, `GET /patient/getPatientByID/:id` (three URLs, one identical handler — `getOne` at line 152), and the paginated list endpoint. **This means the backend side of "make new fields show up everywhere" is a single change.** The real propagation work is entirely on the frontend, where — per direct codebase audit — there is **no shared, normalized patient cache**: the facesheet header, the Demographics tab, the Patient List, the ADT quick-search, and the appointment-booking picker each independently fetch and map patient data with their own TypeScript type. New fields will not "just appear" on any of them without a per-screen update. This plan treats that as its own explicit phase (Phase 4), not an afterthought.

**Current state, confirmed by direct read**:
- Registration today is a single-step **modal** (`frontend/src/components/patients/AddPatientModal.tsx`), opened from `PatientList.tsx`, not a page. 11 fields: firstName*, middleName, lastName*, dOB, sex, mobilePhone, email, address1, city, state, zipCode. Manual (non-Zod) validation. Submits via a raw inline `api.post('/Patient/createPatient', ...)` call — no dedicated service function exists for it.
- The backend's Zod schema (`patientBody`, `patients.js:163-175`) and the `patients` table (`001_init.sql:75-100`) already accept more than the form collects (`homePhone`, `address2`, `mrn` override, `status`) — but hold **nothing** resembling insurance, emergency contacts, guarantor, race/ethnicity/language, marital status, prefix/suffix, advance directive, or country of birth. Those are all net-new.
- Side effects on create (`checkEligibility()` stub, `enqueueRcopiaSync()` via `pg-boss`) are confirmed still present and working — don't disturb them.
- After a successful save today: toast, modal closes, the patient **list** re-fetches. No navigation to the new patient's chart.
- A separate, dead `SignupPage.tsx` self-registration flow exists (not wired into `routes.tsx`, posts to a backend path that doesn't exist). Orphaned, unrelated to this plan — not touched here.

---

## The EMR-ng reference format

Found at `src/app/core/patient/add-patient/` (`add-patient.component.ts`/`.html`), routed at `/patient/add-patient`. **A single long scrollable reactive form with section dividers — not a wizard.** A second, lighter `quick-add-patient` variant exists alongside it with the same backend contract but fewer required fields — EMR-ng itself distinguishes "full registration" from "quick add," which this plan mirrors (see Phase 3).

Section order and content:
1. **Patient Identification** — photo upload (deferred until after save, needs the new patient's ID), MRN (always read-only/server-generated).
2. **Personal Information** — prefix, first/middle/last name, suffix, DOB, sex, marital status, email, work email, pregnant/breastfeeding (shown only if sex=F).
3. **Insurance** (toggle-revealed) — Primary Insurance block + nested Guarantor Info (shown only if guarantor ≠ "Self"), Secondary Insurance block (toggle-revealed, mirrors primary) + its own nested Guarantor Info. Each insurance block: type, company (typeahead), member ID, plan type, group number, company phone, effective/termination dates, status, guarantor relationship, co-pay, medical group, PCP name. A live "Verify Coverage" button runs a real Stedi X12-271 eligibility check and auto-fills several fields from the response; a cross-field rule requires at least one insurance block to be status=Active if "has insurance" is yes.
4. **Home Address** — address1*, address2, city*, state*, zip*.
5. **Mailing Address** (toggle — "same as home" checkbox, default unchecked copies home fields live) — same four fields, all optional if shown.
6. **Contact Information** — home phone*, mobile phone*, work phone, other phone.
7. **Additional Demographics** — advance healthcare directive status, preferred language, ethnicity, race, notice-of-privacy-practices date, country of birth.
8. **Emergency Contact** × 2 (fixed, not dynamically add/removable) — relationship, name, phone, address, city, state, zip. None required.

Notable things **not** in EMR-ng's form, worth knowing before scope-creeping this plan: no SSN field anywhere, no duplicate-patient check, no address autocomplete, no insurance-card scan. After a successful save, EMR-ng oddly discards the returned `patientId` for navigation purposes and routes back to the patient list (it's only used internally to finish the photo-upload follow-up call) — this plan deliberately does **not** copy that specific behavior (see Phase 3).

Full field-level validation patterns (name/phone/zip regex, date rules, age-aware guarantor logic) live in `EMR-ng/src/app/shared/services/patient-form-validation.service.ts` if exact parity is wanted later — this plan ports the *intent* of these rules (see Phase 3), not the literal Angular validator code.

---

## Scope decisions (stated explicitly, not assumed)

1. **Live insurance eligibility verification is out of scope.** EMR-ng's "Verify Coverage" hits a real Stedi X12-271 API; this project has no payer contract or credentials — only the existing `checkEligibility()` stub (`patients.js`, returns `{eligible: true}` unconditionally, per `starting_flow_build_plan.md`). Build the insurance UI/fields and keep calling the existing stub, structured so a real integration later is a drop-in swap — consistent with how every other stubbed vendor integration in this codebase (Rcopia, Stripe, ADT notification) is already handled.
2. **No SSN field** — EMR-ng doesn't have one either; no reason to introduce new PII scope this project doesn't already need.
3. **Photo upload UI is in scope; photo storage infrastructure is not.** This repo has no file-upload infrastructure anywhere (confirmed in this same research cycle's Settings-module plan). Build the deferred-upload interaction (select → preview → upload-after-save using the new patient ID) against a storage endpoint left as an explicit TODO, rather than inventing ad hoc storage.
4. **Reference-data dropdowns (states/race/ethnicity/preferred-language/country) are static frontend constants, not new backend endpoints.** The Settings-module plan from this same research cycle already flagged `/setting/getRaceCodes` etc. as possibly-unused scaffolding worth confirming before building. Patient registration is the real caller that resolves that question — and because these are small, fixed, non-tenant-specific enumerations, a static constant avoids an unnecessary network round trip and a backend route that just returns a hardcoded list anyway.
5. **No dynamic (>2) insurance or emergency contacts** — matches EMR-ng's own fixed-primary/secondary model; don't over-build past the reference being followed.

---

## Phase 1 — Schema

New migration (renumber per Phase 0's note):

```sql
ALTER TABLE patients
    ADD COLUMN prefix TEXT,
    ADD COLUMN suffix TEXT,
    ADD COLUMN marital_status TEXT,
    ADD COLUMN preferred_language TEXT,
    ADD COLUMN ethnicity TEXT,
    ADD COLUMN race TEXT,
    ADD COLUMN country_of_birth TEXT,
    ADD COLUMN work_phone TEXT,
    ADD COLUMN work_email TEXT,
    ADD COLUMN other_phone TEXT,
    ADD COLUMN advance_directive_status TEXT,
    ADD COLUMN notice_of_privacy_practices_date DATE,
    ADD COLUMN pregnant BOOLEAN,
    ADD COLUMN breastfeeding BOOLEAN,
    ADD COLUMN mailing_address1 TEXT,
    ADD COLUMN mailing_address2 TEXT,
    ADD COLUMN mailing_city TEXT,
    ADD COLUMN mailing_state TEXT,
    ADD COLUMN mailing_zip_code TEXT;

CREATE TABLE patient_insurance (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    rank            TEXT NOT NULL CHECK (rank IN ('primary','secondary')),
    insurance_type  TEXT,
    company_name    TEXT,
    member_id       TEXT,
    plan_type       TEXT,
    group_number    TEXT,
    company_phone   TEXT,
    effective_date  DATE,
    termination_date DATE,
    status          TEXT CHECK (status IN ('active','inactive')),
    copay_amount    NUMERIC(8,2),
    medical_group   TEXT,
    pcp_name        TEXT,
    guarantor_relationship TEXT,
    guarantor_name  TEXT,
    guarantor_address TEXT,
    guarantor_dob   DATE,
    guarantor_member_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, rank)
);

CREATE TABLE patient_emergency_contacts (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    rank        TEXT NOT NULL CHECK (rank IN ('primary','secondary')),
    relationship TEXT,
    name        TEXT,
    phone       TEXT,
    address1    TEXT,
    city        TEXT,
    state       TEXT,
    zip_code    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, rank)
);
```

`UNIQUE (patient_id, rank)` on both new tables enforces "exactly one primary, one secondary" the same way the UI models it — an upsert on `(patient_id, rank)` is the natural write pattern for editing either block later. `patients.profile_picture` already exists (confirmed) — reuse the existing `PUT /Patient/updateProfilePicture/:id` endpoint for the post-save photo step; no new column needed.

---

## Phase 2 — Backend

1. **Extend `patientBody`** (the Zod schema in `patients.js`) with the new flat `patients` columns above.
2. **Extend `PATIENT_SELECT`/`patientOut()`** — the single shared query/mapper — to also pull `patient_insurance` (both ranks) and `patient_emergency_contacts` (both ranks), shaped as `insurance`/`secondaryInsurance` nested objects and an `emergencyContacts` array. **This is the one change that makes the new data available to every read endpoint at once** — `getPatientById`, `getPatientDemographics`, and the paginated list all inherit it automatically, since they all call this same function today.
3. **Extend `POST /Patient/createPatient`** to accept nested `insurance`/`secondaryInsurance`/`emergencyContacts` in the request body, and insert into the two new tables **inside the same `withTx`** as the `patients` insert — atomic, so a patient never ends up with a half-written insurance record.
4. **Check for an existing general patient-update endpoint before adding a new one** — if one exists, extend it to handle upserts into the two new tables (matched on `patient_id`+`rank`); if not, add one (`PUT /Patient/updatePatientDetails/:id` or similar, matching this codebase's existing legacy-shaped naming where a new endpoint has no prior contract to preserve).
5. **Static reference data**: add the states/race/ethnicity/preferred-language/country lists as frontend constants (see Scope Decisions #4) — no backend work.
6. **Keep `checkEligibility()` as-is** — the "Verify Coverage" UI button (Phase 3) calls it unchanged.

---

## Phase 3 — Frontend: the registration experience

- **Decision**: build a full-page registration flow (new route, e.g. `/app/patients/register`) matching EMR-ng's section order above, and keep the existing `AddPatientModal.tsx` as the deliberately-thinner "quick add" path — this mirrors EMR-ng's own `add-patient`/`quick-add-patient` split, so it's a precedented structure, not a novel UX call.
- Port the *intent* of EMR-ng's validation rules (name/phone/zip format, DOB range, at-least-one-active-insurance cross-field rule, age-aware guarantor dropdown that drops "Self" for minors) using this codebase's existing patterns — Zod on the backend plus the same manual-validation style `AddPatientModal.tsx` already uses on the frontend. Don't introduce a new frontend validation library solely for this form.
- Give the full form a dedicated service function (`createPatient()` in `patient.service.ts`) rather than the inline Axios call the current modal uses — small cleanup, consistent with how every other resource in this codebase is called.
- **After a successful save, navigate to the new patient's facesheet** (`/app/facesheet/:id`) using the returned ID — a deliberate improvement over EMR-ng's own behavior (which discards the ID and returns to the list). This is also the most direct way to satisfy "the details should bind on the other relevant screen" for the single most relevant screen: the patient's own chart, immediately after creating them.
- Build the deferred photo-upload interaction (select → local preview → upload after save resolves the new patient ID), wired against a storage endpoint left as an explicit TODO per Scope Decision #3.

---

## Phase 4 — Cross-screen binding (the part that doesn't happen automatically)

Per the confirmed architecture (no shared cache; five independent consumers), go through each one explicitly:

1. **Facesheet header** (`EncounterHeader.tsx`, via `facesheetSlice.ts`'s `getPatientById()` mapper) — this mapper currently whitelists a fixed field set (`id, fullName, mrn, dOB, sex, mobilePhone, address, location`) onto `FacesheetPatient`; everything else lands unmapped in `patient.raw` and nothing renders it. Decide which new fields belong on a *persistent* header (likely just identity/contact — insurance and emergency contacts belong on the Demographics tab, not every tab's banner) and extend the whitelist accordingly. Don't map everything just because it's now available.
2. **Demographics tab** (`Demographic.tsx`) — likely needs the **least** new frontend work of all five screens: it already parses a `demographics`/`insuranceDetails`/`secondaryInsuranceDetails`/`additionalInformation` response shape that, until Phase 2, had nothing real behind it. Once `patientOut()` is extended, diff its existing parsing code against the new real response and adjust field names where they don't line up exactly — this is reconciliation, not a rebuild.
3. **Patient List** (`PatientTable.tsx`/`mapPatientRecord()`) — decide which new fields (if any) are worth a column; MRN isn't shown today despite being available in the underlying data — fix that in passing, it's a one-line, closely related improvement in the same file.
4. **ADT quick search** (`AdtPatientQuickSearch.tsx`) — no change expected; it deliberately shows only name+MRN for a fast picker, which is still correct.
5. **Appointment booking** (`BookAppointment.tsx`) — no change expected; its dropdown is deliberately minimal (id/name via a generic endpoint), unrelated to demographic richness.
6. **While in this area**: two confirmed-orphaned components exist (`FacesheetPatientBanner.tsx`, `EncounterBanner.tsx` — unused alternate header designs). Flag to the user whether to wire one in as a replacement header or delete them — don't silently delete without confirming.

---

## Phase 5 — End-to-end check

Backend: extend `backend/tests/api.test.js` — create a patient with full insurance (both ranks) and both emergency contacts, fetch via all three read-URL aliases and confirm an identical enriched shape from each, fetch via the paginated list and confirm the same fields appear there too, confirm tenant isolation holds on both new tables.

Frontend: manual browser walkthrough — register a patient through the new full-page form, confirm redirect lands on their facesheet, confirm the Demographics tab renders the entered insurance and emergency-contact data, confirm the Patient List now shows MRN.

---

## Explicitly out of scope for this pass

- Live Stedi/X12-271 eligibility verification (needs a real vendor contract — keep the stub).
- File-storage infrastructure for profile photos (flagged as a prerequisite decision in the Settings-module plan too; not solved here).
- SSN capture.
- A fully normalized, app-wide shared patient cache — the architectural gap is real, but fixing it is a much larger refactor than "bind registration details to the other relevant screens" calls for; the per-screen mapper updates in Phase 4 satisfy the actual ask without it. Worth flagging as a future improvement, not building now.
- Dynamic (>2) insurance or emergency contacts.
- Retiring the dead `SignupPage.tsx` self-registration flow — unrelated dead code noticed in passing; flag separately if the user wants it cleaned up.

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md`, `cpoe_build_plan.md`, `problem_list_icd10_build_plan.md`, `physician_hp_build_plan.md`, `settings_module_backend_build_plan.md`, and `bed_booking_build_plan.md` are its siblings in this same directory.*
