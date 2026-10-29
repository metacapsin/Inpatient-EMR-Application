# Problem List / ICD-10 Build Plan

**For a fresh Claude Code session in this repo.** Standalone and implementation-ready, same shape as `starting_flow_build_plan.md` and `cpoe_build_plan.md`. This module is sequenced to land *in parallel with* CPOE, not after it — CPOE's order forms (radiology especially) want a real problem/diagnosis to point at as "reason for order," and right now there isn't one.

Read Phase 0 before writing code — it's what's actually in the codebase today, verified against the live files, not assumed.

---

## Phase 0 — Orientation (read first)

Repo conventions are unchanged from the other plans in this batch (routes in `backend/src/routes/*.js`, `ok()`/`created()` envelope, `row()`/`rows()` snake→camel, Zod via `parse()`, `requireAuth`/`requireRole`, numbered migrations, `withTx`). Full detail in `starting_flow_build_plan.md` Phase 0 if you need it restated.

**Migration numbering note**: this plan proposes `007_problem_list.sql`. Four other plans in this same research batch (H&P, Settings, Bed Booking) each independently propose their own "007." Whichever actually gets built first in a real session claims `007`; renumber the others at build time to whatever's next in `backend/src/db/migrations/`. Don't let two plans both land as `007`.

**The real finding that shapes this plan**: there is no problem list anywhere in this codebase — not a stub, not a mock, nothing. The frontend has a page that *looks* like one, but it calls a dead vendor-shaped endpoint. This isn't "connect the mock to a real API," it's a from-scratch build on both ends.

**Don't confuse this with `nanda_diagnoses`** (`backend/src/routes/inpatientDocs.js` lines 40-43). That table holds **NANDA-I nursing diagnoses** (e.g. "Risk for Falls") for nursing care plans — a completely different taxonomy from medical ICD-10-CM problems. Both will coexist; name them distinctly in code and UI so nobody conflates them.

---

## Industry grounding (why this is scoped the way it is)

- **ONC §170.315(a)(6) "Problem list"** (45 CFR Part 170 Subpart C, part of the Base EHR Definition): a Health IT Module must let a user record, change, and access a patient's **active** problem list, coded to at minimum SNOMED CT® US Edition (§170.207(a)(4)).
- **USCDI "Problems / Health Concerns" data class**: requires **both** SNOMED CT and ICD-10-CM as applicable vocabulary — in practice, most EHRs capture ICD-10-CM as the billable/diagnostic code and let SNOMED ride alongside it where available.
- **ICD-10-CM** is large (~74,700+ codes) and updates annually every **October 1** (FY2026 update added 487 new codes, deleted 28, revised 38 descriptions). A real implementation needs the actual code set, not a hardcoded sample — and a plan for re-importing it every October.
- **SNOMED CT US Edition is NOT public domain** — it requires a UMLS/IHTSDO affiliate license. This plan deliberately scopes SNOMED out (see "Out of scope") rather than pretending it's a quick add.
- **Status lifecycle convention** (AHIMA best practice, matches every mainstream EHR): Active / Inactive / Resolved / Removed (entered-in-error), plus an independent Acute/Chronic flag. Resolved/removed problems are *never hard-deleted* — they move out of the active view but stay in the record.
- **FHIR `Condition` resource shape** (useful as a mental model even though this plan doesn't build FHIR export): `category` distinguishes `problem-list-item` from `encounter-diagnosis`; `Condition.encounter` links the visit; orders/care-plans cite a Condition as their "reason." This plan's schema mirrors that linkage pattern without committing to FHIR yet.

---

## Current codebase state (verified, not assumed)

- No `problems`/`diagnoses`/`conditions` table exists in any of the 6 migrations to date.
- `encounters.diagnosis` (`001_init.sql` line 112) is a single free-text `TEXT` column, set once at admission in `adt.js` — not a list, not coded.
- `patient_history.diagnosis_date` + free-text `conditions` (`records.js`) — same problem, different table.
- `radiology_orders.icd10_codes` is a JSONB string array used only as imaging-order justification (`clinicalOps.js:36,77,87-90`, `orders.js:78,129-132`), validated as `z.string().max(12)` — no real code-set check, no link to a problem record.
- Frontend nav/route mismatch: `facesheetModules.ts:55` registers a `diagnoses` facesheet tab meant for `/app/facesheet/:id/...`, but `routes.tsx` wires a flat `/app/diagnoses` (no `:id`) to `pages/patient/Diagnoses.tsx` instead — nested and flat routing disagree.
- `Diagnoses.tsx` (433 lines) has **real** fetch code, pointed at a **dead** endpoint: `healthConditionsAPI.getByPatient()` → `api.get('/Patient/getAllDiagnosesList?rcopiaID=...')` (`healthMonitoringService.ts:19-31`). Zero backend routes anywhere match this path. Its response parser (`mapApiToRecord`, lines 97-161) expects a Mongo/XML-wrapped shape (`RcopiaID[]`, `ICD10[0].Code[]`) — a different era of this codebase, not the current `row()/rows()` convention. Only delete is wired in the UI.
- `Icd10MultiTypeahead.tsx` (radiology feature) is a real, working typeahead *component* — but backed by only 10 hardcoded codes in `radiologyOptions.ts:63-74`, not a real search.
- The care-plan feature has diagnosis-linking UI (`CarePlanDiagnosisCard.tsx`, `CarePlanAddDiagnosisDialog.tsx`, a `diagnosisId` field) but it's entirely mock-store driven behind `VITE_CARE_PLAN_MOCK`.

---

## The real job

1. **A real ICD-10-CM code reference table**, searchable, not a 10-row sample.
2. **A `problems` table** — one row per coded problem on a patient's list, with status lifecycle and chronicity.
3. **One backend surface** for search + CRUD, and **one frontend screen** that actually renders under the facesheet, replacing the dead vendor-shaped page.

---

## Phase 1 — Schema

New migration `007_problem_list.sql` (renumber per the note in Phase 0):

```sql
CREATE TABLE icd10_codes (
    code          TEXT PRIMARY KEY,
    description   TEXT NOT NULL,
    billable       BOOLEAN NOT NULL DEFAULT true,
    effective_year INTEGER NOT NULL
);
CREATE INDEX icd10_codes_description_trgm ON icd10_codes USING gin (description gin_trgm_ops);
-- requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE problems (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id  TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    icd10_code    TEXT NOT NULL REFERENCES icd10_codes(code),
    icd10_description TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','resolved','entered_in_error')),
    chronicity    TEXT CHECK (chronicity IN ('acute','chronic')),
    onset_date    DATE,
    resolved_date DATE,
    noted_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX problems_patient_idx ON problems (patient_id, status);
```

`icd10_description` is denormalized onto `problems` deliberately — a problem row should keep the description text as it read *at the time it was added*, even if a future annual code-set refresh changes the canonical description.

**Sourcing the code set**: CMS/NCHS publish the full ICD-10-CM code list as a free flat file every FY (no license needed, unlike SNOMED). Write a one-time seed script (`backend/src/db/seedIcd10.js`, following the existing `seedPlatform.js` pattern) that loads that file into `icd10_codes`. If the full ~74,700-row file isn't sourced for this pass, ship with a few thousand of the most common inpatient-relevant codes and **say so explicitly** in the PR — don't silently under-deliver.

---

## Phase 2 — Backend

New `backend/src/routes/problems.js`, mounted in `app.js`:

- **`GET /api/icd10/search?q=`** — `SELECT code, description FROM icd10_codes WHERE description ILIKE '%'||$1||'%' OR code ILIKE $1||'%' LIMIT 20` (the trigram index keeps this fast at full scale). This is what replaces `Icd10MultiTypeahead`'s hardcoded 10-row list.
- **`POST /api/patients/:patientId/problems`** — add a problem (`requireRole('physician','nurse')`); body validates `icd10Code` exists in `icd10_codes` before insert.
- **`GET /api/patients/:patientId/problems`** — defaults to active-only; `?includeResolved=true` returns everything. Order: active chronic → active acute → inactive/resolved.
- **`PATCH /api/problems/:id`** — status/chronicity/resolved_date transitions. No `DELETE` endpoint — "removing" a problem is a status change to `entered_in_error`, never a hard delete (matches the ONC/AHIMA convention of preserving the audit trail).

---

## Phase 3 — Frontend

- Fix the routing mismatch: move the diagnoses screen under `/app/facesheet/:id/diagnoses`, matching what `facesheetModules.ts` already expects. Retire the flat `/app/diagnoses` route.
- Replace `healthConditionsAPI`/`mapApiToRecord`'s dead Rcopia-shaped call with real calls to the endpoints above — this is a rewrite of the data layer, not a patch, since the response shape is completely different.
- Problem list UI: grouped by status (Active/Chronic, Active/Acute, Inactive, Resolved), add/edit dialog using the real `GET /api/icd10/search` typeahead.
- Point `Icd10MultiTypeahead` (radiology) at the same search endpoint instead of its 10-row constant — one search backend, two consumers.
- Leave `nanda_diagnoses`/`inpatientDocs.js` untouched — different feature.

---

## Phase 4 — End-to-end check

Extend `backend/tests/api.test.js`: search ICD-10, add a problem to a patient, list it (confirm it's active), transition it to resolved, confirm it drops out of the default (non-`includeResolved`) list, confirm `entered_in_error` problems never reappear.

---

## Explicitly out of scope for this pass

- **SNOMED CT coding** — blocked on a UMLS/IHTSDO license this project doesn't have yet. The schema leaves room for a `snomed_code` column later; don't add it speculatively now.
- **FHIR `Condition` resource API / export** — a separate, later Standardized-API initiative, not specific to this module.
- A real `problem_id` FK from `radiology_orders`/the CPOE `orders` ledger — worth doing once both this and CPOE have landed, but not a hard dependency either direction. Flag it as a fast follow, don't block either plan on the other.
- NLP-based problem suggestion from notes/orders.

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md` and `cpoe_build_plan.md` are its siblings in this same directory.*
