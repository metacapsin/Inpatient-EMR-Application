# Bed Booking / Bed Management Build Plan

**For a fresh Claude Code session in this repo.** Standalone and implementation-ready, same shape as `starting_flow_build_plan.md` and `cpoe_build_plan.md`. Last in this research batch's sequence.

Read Phase 0 before writing code.

---

## Phase 0 — Orientation (read first)

Repo conventions are unchanged from the other plans in this batch. Full detail in `starting_flow_build_plan.md` Phase 0.

**Migration numbering note**: this plan proposes two new migrations after whatever this batch's others claim — check `backend/src/db/migrations/` at build time and number sequentially; don't assume a fixed number here.

**The framing that matters**: this module's job is mostly **"finish what the schema already started,"** not greenfield design. `backend/src/routes/facility.js` (212 lines) already has full Ward/Room/Bed CRUD and a live bed board. The `beds` table's status CHECK (`001_init.sql` line 67) already has **six** values: `'available','occupied','hold','maintenance','blocked','dirty'`. `'hold'` and `'dirty'` already exist in the schema — they're just never actually used correctly. The gap is behavior, not structure.

---

## Current capability (verified, read from the live file)

- **Wards**: full CRUD, admin-gated writes, blocked from deletion if any active encounter sits under the ward.
- **Rooms**: full CRUD; `room_type` is free text with **no CHECK constraint** (`001_init.sql` lines 50-58) — no isolation/negative-pressure concept today.
- **Beds**: full CRUD; `updateBedById`'s Zod schema is `['available','hold','maintenance','blocked','dirty']` — deliberately omitting `'occupied'`, since that's ADT-derived, not manually set.
- **Live bed board**: `GET /Beds/getLiveBedBoard` joins beds→rooms→wards, LEFT JOINs active encounters+patients, returns per-bed detail plus a status-count summary. This is solid and doesn't need rework.
- **Only two code paths ever touch `beds.status`**: the admin `updateBedById` above (manual override, no link to any patient/encounter/reason), and `adt.js`, which toggles strictly `occupied`/`available` on admit/transfer/discharge. **Discharge sets the freed bed straight to `'available'`, skipping `'dirty'` entirely** — the schema's own intended cleaning step is bypassed by the one piece of code that should trigger it.

---

## Confirmed gaps, in priority order

### 1. Bed reservation/hold — the core gap, and it's "inert," not "absent"

`'hold'` is a live value in the DB CHECK, in the admin Zod schema, and the frontend already has UI affordances for it (`LiveBedBoardFilters.tsx` has a Hold filter; `adtBedPicker.ts`/`liveBedBoard.service.ts` special-case the string). But **nothing in the codebase ever sets a bed to `'hold'`** — no reservation metadata exists (no held-for-patient, no reserved-by, no expiry), and critically, `assertBedFree` (`adt.js` line 72) only blocks `['maintenance','blocked','dirty']` — it doesn't check `'hold'` at all, so even a manually-held bed isn't actually protected from being admitted into by someone else. It's scaffolding with no enforced meaning yet.

Industry bed-management products implement this as a **timed hold** tied to a specific scheduled admission/transfer, auto-expiring if unused — that's the model this plan builds.

### 2. EVS (housekeeping) backend — zero, against a fully-designed frontend

`backend/src` has no `evs`/`housekeep` reference anywhere. The frontend (`components/evs/*` — 11 files, `evsMockService.ts`, `types/evs.ts`, `constants/evs.ts`, `EVSQueuePage.tsx`) is a **complete, well-designed state machine** — `dirty → in_cleaning → pending_inspection → clean` — with housekeeper assignment, inspection sign-off, and real KPIs (turnaround time, beds dirty/in-cleaning/available), running entirely on an in-memory array. Every mutating function is already commented with its intended real endpoint (`/** Future: POST /api/evs/queue/:id/... */`), and the empty-state UI tells the user outright that data is mock until EVS APIs exist. **This is the single highest-leverage item in this plan** — the frontend design work is already done; it just needs the backend it was designed for.

### 3. Isolation-aware assignment — real but smaller

`infection_control_events` (tracked in `inpatientDocs.js`, types include `isolation_started`/`infection_resolved`) is never consulted during bed assignment. `room_type` has no isolation flag. Also found in passing: `staffing.js` line 300 **hardcodes `isolation: false`** for every row on the staffing board rather than deriving it from real data — worth fixing while in this area.

### 4. Gender/acuity/specialty-aware placement — real but lowest severity

`patients.sex` (CHECK `IN ('M','F','O','U')`) exists but is never cross-checked against roommates. Note: same-sex-accommodation as a hard rule is an NHS England policy, **not** a US federal mandate — frame this as hospital-policy/best-practice UX (a soft warning), not a regulatory requirement, so nobody later over-cites it.

### 5. Waitlist/transfer-request queue — confirmed absent

`dashboard.js`'s `/dashboard/ipd` response hardcodes `transferRequests: []` and `criticalPatients: []`, with a comment admitting "no acuity scoring is stored yet." No code anywhere models a bed-request queue distinct from the EVS cleaning queue.

### Regulatory angle — genuinely thin, stated plainly

No ONC certification criterion or CMS Condition of Participation mandates reservation, housekeeping-turnover, or isolation-aware bed assignment as product features. The only tangential thread is CMS's aggregate hospital-capacity *reporting* duty (42 CFR 482.42(e)/485.640(d), continued via NHSN reporting per QSO-21-03) — aggregate bed counts, not bed-level workflow. The existing `getLiveBedBoard` summary shape happens to be structurally close to what such reporting would consume, but that's incidental, not a compliance driver. Don't oversell this module's regulatory grounding — its value case is operational efficiency, not certification.

---

## The real job

1. Give `'hold'` real, enforced reservation semantics.
2. Build the EVS backend the frontend already specifies.
3. Fix discharge to route through `'dirty'` instead of skipping straight to `'available'`.
4. Smaller: isolation-aware soft warnings, a real transfer-request queue.

---

## Phase 1 — Schema

Two new tables (number sequentially after whatever else in this batch lands first):

```sql
CREATE TABLE bed_reservations (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bed_id        TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
    encounter_id  TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    reserved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','expired','cancelled')),
    notes         TEXT
);

CREATE TABLE evs_queue (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bed_id        TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'dirty' CHECK (status IN ('dirty','in_cleaning','pending_inspection','clean')),
    assigned_to   TEXT REFERENCES users(id) ON DELETE SET NULL,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    inspected_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    inspected_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A reservation is its own table (not columns on `beds`) because history matters here — a cancelled or expired hold is worth keeping, and a mutable column on `beds` would lose that.

---

## Phase 2 — Backend

**Reservations** — new `backend/src/routes/bedReservations.js`:
- `POST /api/beds/:bedId/reserve` — create a reservation, flip `beds.status` → `'hold'` (reuse the existing enum value, don't add a new one).
- `POST /api/bed-reservations/:id/cancel` — status → `'cancelled'`, bed reverts to `'available'` if nothing has since overridden it.
- An expiry sweep via `pg-boss` (already in the stack — `db/queue.js`): a recurring job that reverts any `active` reservation past its `expires_at` back to `'available'`.
- **Fix `assertBedFree` in `adt.js`**: add `'hold'` to the blocked-status list, *unless* the admission being performed is the one fulfilling that exact reservation (match on the reservation's `patient_id`/`encounter_id`). This is the line that makes the existing `'hold'` enum value finally mean something.
- **Fix discharge in `adt.js`**: set the freed bed to `'dirty'`, not `'available'` — and best-effort-enqueue a new `evs_queue` row for it (same try/catch pattern as `notifyStaff`).

**EVS** — new `backend/src/routes/evs.js`, matching the exact sub-paths the frontend already names in its own code comments (minimizes frontend changes to swapping `evsMockService.ts`'s in-memory array for real fetches): `GET /api/evs/queue`, `POST /api/evs/queue/:id/assign`, `/start`, `/complete`, `/inspect`, `/approve`. On `approve`, flip the bed back to `'available'`.

---

## Phase 3 — Smaller items

- Add nullable `isolation_required`/`isolation_type` to `rooms` (room-level, not per-bed — isolation is typically a room property). Surface it on the live bed board; show a **soft warning** (not a hard block) in the bed-picker when the patient being placed has an active isolation precaution per `infection_control_events`.
- Fix `staffing.js` line 300's hardcoded `isolation: false` to derive from real data while in this area.
- Soft gender/roommate warning in shared rooms, explicitly commented as hospital-policy UX, not a regulatory requirement.
- New `transfer_requests` table (`patient_id, requested_ward_id, requested_at, requested_by, priority, status, fulfilled_bed_id`) to replace `dashboard.js`'s hardcoded `transferRequests: []`. Priority is a simple manually-entered field — **not** a real acuity-scoring algorithm, which is a separate, much larger clinical-informatics problem this plan doesn't attempt.

---

## Phase 4 — End-to-end check

Extend `backend/tests/api.test.js`: reserve a bed, confirm `assertBedFree` rejects a *different* patient's admission into it, confirm the reservation's own patient *can* be admitted into it, confirm discharge sets `'dirty'` not `'available'`, confirm the EVS clean+inspect flow returns the bed to `'available'`, confirm an expired reservation auto-reverts (manipulate `expires_at` directly in the test rather than waiting in real time).

---

## Explicitly out of scope for this pass

- Real acuity-scoring methodology (the transfer-request queue uses a simple manual priority field instead).
- Hard gender-segregation enforcement (soft warning only — not a US federal mandate).
- Negative-pressure/room-engineering tracking beyond a boolean isolation flag.
- Predictive bed-demand forecasting.
- Linking reservations/EVS to the CPOE orders ledger (e.g., a transfer order auto-creating a reservation) — a reasonable future connection once both modules are stable, not built here.

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md` and `cpoe_build_plan.md` are its siblings in this same directory.*
