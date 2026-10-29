# Physician H&P / Clinical Notes Build Plan

**For a fresh Claude Code session in this repo.** Standalone and implementation-ready, same shape as `starting_flow_build_plan.md` and `cpoe_build_plan.md`. Sequenced right after Problem List / ICD-10 in this batch.

Read Phase 0 before writing code — it's what's actually in the codebase today, verified against the live files, not assumed.

---

## Phase 0 — Orientation (read first)

Repo conventions are unchanged from the other plans in this batch. Full detail in `starting_flow_build_plan.md` Phase 0 if you need it restated.

**Migration numbering note**: this plan proposes `007_clinical_notes.sql`. Other plans in this batch each independently propose their own "007" — renumber at actual build time to whatever's next in `backend/src/db/migrations/`.

**The trap to avoid**: `backend/src/routes/inpatientDocs.js` (426 lines) sounds like it should hold physician documentation. It does not — it implements Care Plan/NANDA, Intake/Output, Nursing Flowsheets, and HAI/infection events. Don't extend it for H&P; its name is a legacy mismatch, not a hint about where notes belong.

**The real finding**: a full physician-note *frontend* already exists — `frontend/src/pages/inpatient/ClinicalWorkflowsPage.tsx` (1056 lines), reached via "Clinical Workspace" in top nav (`/app/inpatient/clinical`), **not** the per-patient facesheet. Its "physician" tab has free-text `hpi`/`ros`/`assessment`/`plan` fields, an addendum field, and a sign button gated by `canSignPhysicianNote`. It calls `clinicalApi.ts` (base `/api/inpatient/clinical`): `/notes/create`, `/notes/patient/:id`, `/notes/update/:id`, `/notes/sign/:id`, `/notes/addendum/:id`, plus `/nursing-notes`, `/handover`, `/vitals`, `/orders`, `/alerts/*`. **Every one of these 404s.** Grepped all backend routes and all migrations for these paths and for `nursing_notes`/`physician_notes` tables — zero matches anywhere. `clinicalOps.js` (375 lines, the only other "clinical"-named router) implements exclusively Radiology orders and Code Events, with no `/api/inpatient/clinical` prefix at all. This UI is fully built and fully disconnected.

There is also a **second, separate, also-dead** notes concept: `frontend/src/pages/patient/Notes.tsx` (570 lines), reached at facesheet tab `notes` and `/app/notes`, calling `patientDataAPI` — `backend/src/routes/patientData.js` has zero matching routes either. Two dead note UIs exist in parallel; this plan builds the backend for the more complete one (`ClinicalWorkflowsPage`) and recommends retiring the other rather than building two backends for one concept.

---

## Industry grounding

- **Standard H&P sections** (every mainstream clinical-documentation guide agrees on this set): Chief Complaint, HPI, Past Medical History, Past Surgical History, Family History, Social History, Medications, Allergies, Review of Systems, Physical Exam, Assessment & Plan.
- **CMS timing rule — 42 CFR 482.24(c)(4)** (Condition of Participation: Medical Record Services): the H&P must be completed/documented **no more than 30 days before or 24 hours after admission**, placed in the record **within 24 hours after admission**, and in all cases **before** any surgery or procedure requiring anesthesia. If it was done in the pre-admission window, an updated exam noting any changes must still be entered within 24h and pre-op.
- **No standalone ONC certification criterion covers note *authoring*.** §170.315(a)(2) "Clinical Decision Support" is unrelated — it governs interactive alerts, not notes. USCDI's **Clinical Notes** data class (8 note types including H&P) is a real, mandatory data class, but its certification obligation is about *exposing* the note via the Standardized API (§170.315(g)(10), FHIR `DocumentReference`) — content-agnostic, just note text + type + author + date retrievable. That's a separate, later initiative (see Out of Scope).
- **Real-world UX pattern**: structured section scaffolding with free-text fill-in (Epic's SmartText/SmartPhrase model) — not pure free text, not rigid discrete fields for everything. This plan's schema follows that: named sections as nullable columns, filled in as much or as little as the note type calls for.

---

## Current codebase state (verified)

- "H&P" exists only as a dropdown value in `ClinicalWorkflowsPage.tsx`'s `NOTE_TEMPLATES` (line 89) — cosmetic, no backend differentiation.
- `patient_documents` (`003_scheduling_records_ops.sql:67-80`) is generic BYTEA blob storage (`id, tenant_id, patient_id, name, document_type, notes, mime_type, content, document_date, created_by, created_at`) — no sections, no status, no signer, no versions. Not suited to sectioned, signable notes without major changes.
- `nursing_flowsheets` + `nursing_flowsheet_versions` (in `inpatientDocs.js`) already implement a working draft → signed → amended + version-history pattern — the closest existing analog, worth copying the *pattern* from even though the table itself is for a different feature.
- `allied-health-notes` (`frontend/src/features/`) is a working, backend-wired PT/OT/RT/social-work progress-note feature — a decent structural template for a new feature folder.
- Migrations currently top out at `006_cpoe_orders.sql`.
- `encounters` already has an admission timestamp column — the CMS 24-hour timer reads directly off that; confirm exact column name in the live schema before writing the compliance check.

---

## The real job

1. A real `clinical_notes` schema with discrete H&P sections, a status lifecycle, and an append-only addendum model.
2. A backend router matching the path contract the frontend **already expects** (`/api/inpatient/clinical/notes/*`) — this turns "fully unwired" into "wired" with the smallest possible frontend diff.
3. A CMS-timing visibility flag (surfaced, not enforced — a late H&P still needs to be saved, just flagged).

---

## Phase 1 — Schema

New migration `007_clinical_notes.sql` (renumber per Phase 0's note):

```sql
CREATE TABLE clinical_notes (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    note_type       TEXT NOT NULL CHECK (note_type IN ('hp','progress','discharge_summary','consult')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed','amended')),
    chief_complaint TEXT,
    hpi             TEXT,
    pmh             TEXT,
    psh             TEXT,
    family_history  TEXT,
    social_history  TEXT,
    medications_reconciliation TEXT,
    allergies       TEXT,
    ros             TEXT,
    physical_exam   TEXT,
    assessment_plan TEXT,
    author_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
    signed_at       TIMESTAMPTZ,
    signed_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinical_note_addenda (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    note_id     TEXT NOT NULL REFERENCES clinical_notes(id) ON DELETE CASCADE,
    author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clinical_notes_encounter_idx ON clinical_notes (encounter_id, created_at DESC);
```

`note_type` values match the frontend's existing `NOTE_TEMPLATES` exactly — don't invent new ones. Section columns are nullable because a `progress` note mostly just uses `assessment_plan`; only `hp` is expected to fill most of them.

---

## Phase 2 — Backend

New `backend/src/routes/clinicalNotes.js` — a dedicated file, **not** another addition to `inpatientDocs.js`; that file's naming already caused this confusion once. Mount at the prefix the frontend already calls, `/api/inpatient/clinical`:

- **`POST /notes/create`** — `requireRole('physician')` for `hp`/`consult`/`discharge_summary` (admin always passes); status starts `draft`.
- **`GET /notes/patient/:patientId`** — optional `?encounterId=`.
- **`PUT /notes/update/:id`** — only while `status='draft'`; reject (403/409) once signed — immutability-after-sign, matching `nursing_flowsheets`' existing pattern.
- **`POST /notes/sign/:id`** — `draft`→`signed`, sets `signed_at`/`signed_by`. Response includes a derived `cmsCompliance` object: `{ deadline, signedAt, isLate }` computed from `encounter.admission_timestamp` per 42 CFR 482.24(c)(4) — a late signature still succeeds, it's just flagged for the UI.
- **`POST /notes/addendum/:id`** — only on `signed` notes; inserts into `clinical_note_addenda`, bumps note `status` to `amended`.
- **Leave `/nursing-notes`, `/handover`, `/vitals`, `/orders`, `/alerts/*` unimplemented in this pass** — they're different features that happen to share the same frontend API client file. Call this out in the PR so whoever picks those up next gives each its own router instead of growing one "clinical" file into a second `inpatientDocs.js`-style trap.

---

## Phase 3 — Frontend

- Extend `ClinicalWorkflowsPage.tsx`'s physician tab with the missing discrete sections (CC/PMH/PSH/Family Hx/Social Hx/Meds/Allergies) alongside the existing hpi/ros/assessment/plan fields — reuse the existing tab shell.
- Wire `clinicalApi.ts`'s existing calls to the new real endpoints — the path contract should already match; verify request/response shapes line up and adjust the thin client if the envelope differs (`{status, data}` vs whatever it currently assumes).
- Add a notes entry to `facesheetModules.ts` so H&P/notes are reachable per-patient from the facesheet, not only from the standalone Clinical Workspace — currently inconsistent with other clinical modules.
- **Decision needed, don't act unilaterally**: retire `pages/patient/Notes.tsx`/`patientDataAPI` (the other dead notes path) rather than building a second backend for a redundant feature. Flag this to the user/team before removing it.

---

## Phase 4 — End-to-end check

Extend `backend/tests/api.test.js`: create an encounter, create a draft H&P, update it, sign it, assert the PUT is rejected post-sign, add an addendum, and assert the `cmsCompliance.isLate` flag is correct for both a timely and a late sign (two explicit cases — this is exactly the kind of rule a later refactor could silently drop without a test pinning it down).

---

## Explicitly out of scope for this pass

- `/nursing-notes`, `/handover`, `/vitals`, `/alerts/*` endpoints — separate features, noted above.
- SmartPhrase/SmartText-style macro authoring — a nice-to-have editor feature, not core documentation capability.
- FHIR `DocumentReference` export (§170.315(g)(10)) — needs the whole Standardized API layer; a bigger, separate initiative, not specific to H&P.
- Resident/trainee co-signature workflow.

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md` and `cpoe_build_plan.md` are its siblings in this same directory.*
