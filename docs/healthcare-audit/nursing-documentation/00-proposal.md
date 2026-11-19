# Module Change Proposal — Nursing Documentation: shift notes, SBAR handoff, risk assessments, trustworthy signatures

Status: ⬜ proposed, awaiting approval. Date: 2026-11-13. Owner: Dev 3 (Clinical documentation). Depends on the in-flight RBAC change being finished first (see `verification-2026-11-13.md`).

## 1. Why this module, why now

Nursing documentation is the largest volume of entries in any inpatient record and is the second thing surveyors read after the MAR:

- CMS CoP 42 CFR 482.23(b)(4): a registered nurse must assess every patient's needs on admission and supervise the care — the nursing admission assessment and reassessments must exist as records.
- CMS CoP 42 CFR 482.24(c)(1): every entry authenticated, dated and timed by its author — flowsheet signatures are currently supplied by the browser.
- TJC NPSG.09.02.01 (fall reduction) and NPSG.14.01.01 (pressure injury): validated tools (Morse Fall Scale, Braden Scale) scored on admission and at defined intervals.
- TJC PC.02.02.01 / NPSG 2 history (handoff communication): a structured, acknowledged shift handoff. The industry pattern is SBAR.
- Pain assessment and reassessment after intervention (TJC PC.01.02.07).

The Clinical Workspace already has a Nursing tab with a shift note form and an SBAR handover form, and the chart has a full Braden / Morse / GCS / pain scoring page, but all of them post to routes that do not exist (`/api/inpatient/clinical/nursing-notes`, `/handover`, `/api/RiskAssessment/*`). Nurses can type, nothing is saved.

## 2. Current status (verified 2026-11-13)

| Area | Evidence |
|---|---|
| Nursing notes UI | `ClinicalWorkflowsPage.tsx:788-870` shift (morning/evening/night) + free text; `clinicalApi.ts:40-49` posts to a 404 (BUG-03) |
| SBAR handover UI | same page, `createHandover` with `toNurseId`, `shift`, `sbar{situation,background,assessment,recommendation}`; 404 |
| Risk assessments UI | `pages/patient/RiskAssessments.tsx` (1042 lines): Braden (6 sub-scores), Morse (6), GCS (3), pain (NRS/FLACC/CPOT/Wong-Baker, location, character, intervention, response, reassessment due); `api.ts:848-850` posts to `/api/RiskAssessment/save` and `/latest/:encounterId` — no router (SAF-09); errors swallowed |
| Flowsheets | `inpatientDocs.js:271-366` — `signedBy/signedByName/signedAt` taken from the body (SAF-05); `amended` can be reverted to draft; `shiftInfo` dropped (BUG-11); versions table keeps a summary only |
| Vitals tab in Clinical Workspace | calls `/api/inpatient/clinical/vitals` (404) although `health_metrics` CRUD exists in `patientData.js` |
| Dashboards | no nursing worklist; IPD dashboard is bed-centric |
| Reference implementation | EMR-Backend `nursing_notes` (patientId, encounterId, nurseId, shift ∈ morning/evening/night, notes, vitalsSnapshot, alerts) and `handover_notes` (fromNurseId, toNurseId, shift, sbar, status pending/acknowledged, acknowledgedAt, wardId, pendingItems{orders,unsignedNotes,dueMeds}); `handoverService.acknowledge` only the addressed recipient may acknowledge. Shapes below match these so the existing frontend types (`NursingNoteRow`) need no remapping |

Issue IDs closed by this proposal: SAF-05, SAF-09, BUG-03, BUG-11, SEC-09 (flowsheet draft in localStorage) and the "Initial assessments / Nursing notes" rows of the inventory (#18, #20, #22).

## 3. Scope

In scope:
1. Nursing shift notes (create, list, sign, addendum) — same draft→sign→addendum discipline as physician notes.
2. SBAR handoff with recipient acknowledgement and an auto-computed "pending items" snapshot.
3. Risk assessments persisted per encounter: Braden, Morse, GCS, pain, plus a nursing admission assessment header; reassessment intervals and overdue computation.
4. Flowsheet signature integrity: signer/timestamp from the session, `amended` locked, `shiftInfo` persisted, full prior content retained per version.
5. Nursing worklist (dashboard tile + page): due reassessments, unsigned notes, pending handoffs, H&P overdue (reuses the CMS flag).
6. Clinical Workspace: Vitals tab pointed at the real `health_metrics` endpoints; Orders tab at `/api/encounters/:id/orders`; Alerts tab removed (no backend, no proposal).

Out of scope (later proposals): wound-care photo documentation, restraint records, nursing care plan linkage changes, early-warning score (EWS) escalation, voice/dictation.

## 4. Database changes (migration `026_nursing_documentation.sql`)

```sql
CREATE TABLE nursing_notes (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id  TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    nurse_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shift         TEXT NOT NULL CHECK (shift IN ('morning','evening','night')),
    note_type     TEXT NOT NULL DEFAULT 'shift' CHECK (note_type IN ('shift','admission_assessment','event','education')),
    notes         TEXT NOT NULL DEFAULT '',
    vitals_snapshot JSONB,                       -- copied from latest health_metrics at save time
    alerts        JSONB NOT NULL DEFAULT '[]'::jsonb,
    status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed')),
    signed_at     TIMESTAMPTZ, signed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    addenda       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nursing_notes_encounter_idx ON nursing_notes (encounter_id, created_at DESC);

CREATE TABLE handoffs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    from_nurse_id   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_nurse_id     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shift           TEXT NOT NULL CHECK (shift IN ('morning','evening','night')),
    ward_id         TEXT REFERENCES wards(id) ON DELETE SET NULL,
    sbar            JSONB NOT NULL,                -- {situation, background, assessment, recommendation}
    pending_items   JSONB NOT NULL DEFAULT '{}'::jsonb, -- {orders, unsignedNotes, dueMeds, overdueAssessments} computed server-side
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged')),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX handoffs_to_nurse_idx ON handoffs (tenant_id, to_nurse_id, status);

CREATE TABLE risk_assessments (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id   TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    tool           TEXT NOT NULL CHECK (tool IN ('braden','morse','gcs','pain','nutrition','admission')),
    scores         JSONB NOT NULL,                 -- the sub-scores exactly as RiskAssessments.tsx holds them
    total          NUMERIC,
    risk_level     TEXT,                           -- e.g. braden: 'high' (<=12) / 'moderate' (13-14) / 'mild' (15-18) / 'none'
    interventions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    assessed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    assessed_by    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reassess_due_at TIMESTAMPTZ,                   -- computed from tool + risk level (table below)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX risk_assessments_encounter_idx ON risk_assessments (encounter_id, tool, assessed_at DESC);
CREATE INDEX risk_assessments_due_idx ON risk_assessments (tenant_id, reassess_due_at) WHERE reassess_due_at IS NOT NULL;

-- flowsheet integrity
ALTER TABLE nursing_flowsheets
  ADD COLUMN signed_by TEXT REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN signed_at TIMESTAMPTZ,
  ADD COLUMN amended_by TEXT REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN amended_at TIMESTAMPTZ, ADD COLUMN amendment_reason TEXT,
  ADD COLUMN shift_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT flowsheet_status_chk CHECK (chart_status IN ('draft','signed','amended'));
ALTER TABLE nursing_flowsheet_versions ADD COLUMN data JSONB, ADD COLUMN saved_by TEXT REFERENCES users(id) ON DELETE SET NULL;
```

Reassessment intervals (defaults, tenant-configurable later, clinical reviewer sign-off): Braden daily (q12h when total ≤ 12), Morse every shift and after a fall, GCS per order / q4h when < 15, pain q4h and 30–60 min after an intervention, nutrition weekly. Score bands: Braden ≤12 high / 13–14 moderate / 15–18 mild; Morse ≥45 high / 25–44 moderate / <25 low; GCS 3–8 severe / 9–12 moderate / 13–15 mild — these are the published cut-offs used by the existing UI.

## 5. API changes

Prefix `/api/inpatient/clinical` (exactly what `clinicalApi.ts` already calls), new router `routes/nursingDocs.js`, mounted in the `app.js` protected array, per-route gates only.

| Method / path | Role | Behaviour |
|---|---|---|
| `POST /nursing-notes` | nurse, physician (clinical) | create draft; `nurse_id = req.user.id`; `vitals_snapshot` copied from the latest `health_metrics` server-side |
| `GET /nursing-notes/patient/:patientId?encounterId=` | clinical roles | newest first; envelope `{status, message, data}` to match the physician-note client |
| `PUT /nursing-notes/:id`, `POST /nursing-notes/:id/sign`, `POST /nursing-notes/:id/addendum` | author / clinical | same immutability rules as `clinicalNotes.js` |
| `POST /handover` | nurse, physician | validates `toNurseId` is an active nurse of the tenant; computes `pending_items` (active orders, unsigned notes, due/late MAR doses, overdue assessments) at save time |
| `GET /handover/patient/:patientId`, `GET /handover?toNurseId=me&status=pending` | clinical | inbox for the receiving nurse |
| `POST /handover/:id/acknowledge` | the addressed nurse only (403 otherwise, as in the reference) | sets `acknowledged_at` |
| `POST /api/risk-assessments` | nurse, physician | `{encounterId, tool, scores, interventions}` → total, risk level and `reassess_due_at` computed server-side (pure `lib/riskScoring.js`) |
| `GET /api/risk-assessments/latest/:encounterId` | clinical | latest per tool (the shape `RiskAssessments.tsx` expects) |
| `GET /api/risk-assessments/:encounterId/history?tool=` | clinical | trend |
| `GET /api/nursing/worklist?unitId=` | nurse, physician | overdue reassessments, unsigned nursing notes, pending handoffs, H&P overdue, late/missed doses (from the MAR proposal when present) |
| Flowsheet `POST /api/NursingFlowsheet/save` | nurse | ignores client `signedBy/signedAt`; sets them from `req.user` when `sign=true`; `amended` requires reason and stays locked; `shiftInfo` whitelisted; full `data` stored on the version row |
| `api.ts` `patientDataAPI.saveRiskAssessment / getLatestRiskAssessment` | — | repointed to the new routes |

Every write produces an `audit_events` row via the existing middleware.

## 6. UI changes

| Screen | Change |
|---|---|
| Clinical Workspace → Nursing tab | note type selector (shift / admission assessment / event / education), save → sign → addendum like the Physician tab, vitals snapshot preview; SBAR form gains a recipient picker (active nurses) and shows the computed pending-items card; "Handoffs addressed to me" list with Acknowledge |
| Clinical Workspace → Vitals / Orders tabs | wired to `health_metrics` and `/api/encounters/:id/orders`; Alerts tab removed |
| Chart → Risk Assessments | saves persist; shows last score, risk band, next reassessment due, and a history sparkline per tool; errors surfaced (no more swallowed 404) |
| Nursing flowsheet | lock only after the server confirms the signed row; amended state read-only; shift info restored on reload; localStorage draft removed (SEC-09) |
| Dashboard | "Nursing worklist" tile (overdue reassessments, unsigned notes, pending handoffs) linking to a `/app/inpatient/nursing-worklist` page |
| Facesheet → Notes tab | lists nursing notes alongside physician notes with a type filter |

## 7. Files

Backend: `db/migrations/026_nursing_documentation.sql`, new `routes/nursingDocs.js`, new `lib/riskScoring.js` (pure scoring + intervals), `routes/inpatientDocs.js` (flowsheet signature, versions), `routes/dashboard.js` (nursing tile), `routes/clinicalNotes.js` (shared list for the facesheet, optional), `app.js` (mount), `db/seed.js`.
Frontend: `features/clinical-workflows/api/clinicalApi.ts`, `features/clinical-workflows/types.ts`, `pages/inpatient/ClinicalWorkflowsPage.tsx`, `pages/patient/RiskAssessments.tsx`, `services/api.ts` (risk assessment calls), `features/nursing-flowsheet/state/NursingFlowsheetContext.tsx`, new `pages/inpatient/NursingWorklistPage.tsx`, `pages/Dashboard.tsx` + `types/ipdDashboard.ts`, `pages/patient/Notes.tsx`, `router/routes.tsx`, `components/Layouts/mainNavConfig.ts`.
Shared files touched (cross-module impact stated): `pages/Dashboard.tsx` and `routes/dashboard.js` (Dashboard module), `ClinicalWorkflowsPage.tsx` (Physician notes module — physician tab untouched), `db/seed.js`.

## 8. Risks and mitigations

- `RiskAssessments.tsx` is 1,042 lines with its own state model; the backend stores `scores` exactly as the component holds them so the change is limited to the save/load calls and error display.
- Reassessment intervals and risk bands are clinical content: isolated in `lib/riskScoring.js` with a test table, flagged for clinical review before use with real patients.
- Flowsheet signature change alters an existing contract: the frontend currently sends `signedBy`; the server will ignore it rather than reject it, so an older client keeps working.
- Handoff recipient list needs a "nurse" role listing: uses `GET /tenants/users?role=nurse` (exists, admin-gated today) — the proposal adds a clinical-readable `GET /api/staff/nurses` (id, name, ward) instead of loosening the admin route.
- RBAC in flight: all write routes use `requireClinicalRole`; the RBAC module must finish first.

## 9. Tests

- Unit: `tests/riskScoring.unit.test.js` — Braden/Morse/GCS totals and bands at every boundary, pain reassessment due after intervention, interval table.
- Integration (`api.test.js` new block): nurse creates shift note → signs → PUT rejected 409 → addendum; billing role 403 on read; SBAR to nurse B → `pending_items` counts match fixtures → nurse A cannot acknowledge (403) → nurse B acknowledges → inbox empty; Braden 11 → `risk_level=high`, `reassess_due_at` = +12 h → latest/history endpoints; flowsheet sign ignores body signer, amended locked, `shiftInfo` round-trips, version row carries full data; worklist counts; tenant isolation.
- Browser walkthrough: Clinical Workspace Nursing tab end to end, Risk Assessments save/reload, flowsheet sign, dashboard tile.

## 10. Effort

Backend 4 days, frontend 5 days (risk assessment wiring, worklist page, flowsheet), tests + walkthrough 2 days. One approval; the two shared-file touches are listed above.
