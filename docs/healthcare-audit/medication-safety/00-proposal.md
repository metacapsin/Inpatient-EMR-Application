# Module Change Proposal — Medication Safety: single order path + electronic MAR

Status: ⬜ proposed, awaiting approval. Date: 2026-11-13. Owner: Dev 4 (Meds). Depends on the in-flight RBAC change being finished first (see `verification-2026-11-13.md`).

## 1. Why this module, why now

Every US inpatient EMR has an electronic Medication Administration Record. It is the artefact that proves the "five rights" at the bedside and the one surveyors ask for first:

- CMS CoP 42 CFR 482.23(c): drugs administered only on the order of a practitioner, each administration documented with time, dose, route and the person administering.
- CMS CoP 42 CFR 482.24(c)(1): entries authenticated, dated and timed by the author — the signer must come from the session, never from the request body.
- TJC NPSG.03.06.01 (medication reconciliation, already built) feeds the MAR; without a scheduled MAR the reconciled list never becomes administrations.
- ISMP / ASHP guidance: scheduled doses generated from the order frequency, hold/refuse with reason codes, late and missed doses visible, high-alert drugs flagged, duplicate administrations impossible.

Today the app shows a MAR tab (`pages/inpatient/medication-management/MarTab.tsx`) but nothing produces due doses, the status column is free text, `given_by` is whatever the client sends, and two of the three medication write paths skip drug-interaction and allergy checking. On a fresh tenant the Give button can never be reached.

## 2. Current status (verified 2026-11-13)

| Area | Evidence |
|---|---|
| `mar_entries` table | `001_init.sql:298-311` — `medication_id` has no FK, `status` free text default `due`, no unique index, `given_by TEXT` |
| MAR routes | `medication.js:72-98` — `GET /api/mar/:patientId`, `POST /api/mar` updates a `due` row or inserts a new one from client-supplied `scheduledTime/givenTime/givenBy/status` |
| Schedule generation | none; `medications.next_scheduled_time` is a single timestamp, never expanded |
| CPOE medication order | `orders.js:35-45, 113-137` — CDS check (`lib/cds/check.js`) + RxNorm, inserts `medications` row, ledger row |
| Legacy order paths | `medication.js:38` (`POST /api/patients/:id/medications`), `medication.js:128` (`POST /api/prn-stat`) — no CDS, no RxNorm (SAF-04) |
| Discontinue | `orders.js:226-236` flips only `orders.status`; `medications.is_active` stays true (SAF-03) |
| CDS ledger | `cds_alerts.outcome='blocked'` never written (SAF-17); allergy class free text vs enum (SAF-16) |
| Module gate | med-rec routes outside `moduleGate.js` rules (SAF-23); `medRecComplete` not tenant-scoped |
| Reference implementation | EMR-Backend `api/services/clinical/marScheduleService.js` (frequency → scheduled dose rows, 24 h rolling window, idempotent top-up) and `marService.js` (`scheduled → given/held/refused`; `due/late/missed` derived on read at −30/+30/+120 min; `administeredBy` from session; `witnessBy`; PRN give) — the shapes below mirror it so the two products stay aligned |

Issue IDs closed by this proposal: SAF-02, SAF-03, SAF-04, SAF-16, SAF-17, SAF-18, SAF-23, SAF-27, BUG-15.

## 3. Scope

In scope (Phase A, this proposal):
1. One medication write path with CDS and RxNorm on every order.
2. Scheduled MAR generated from order frequency, with statuses, reason codes, server-side attribution, witness field, duplicate prevention, void/amend.
3. Discontinue/hold propagation between the orders ledger, the medication row and future MAR rows.
4. CDS ledger completeness (`blocked` persisted), allergy class enum enforced.
5. e-Rx transmit error status persisted outside the failing transaction.

Out of scope (Phase B, separate proposals): BCMA barcode scanning, pharmacist verification queue, infusion/titration/taper orders, dose-range and duplicate-therapy CDS rules, licensed drug knowledge base.

## 4. Database changes (migration `025_medication_safety.sql`)

```sql
-- medications: order metadata the MAR needs
ALTER TABLE medications
  ADD COLUMN dose_unit TEXT,
  ADD COLUMN indication TEXT,
  ADD COLUMN start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN stop_at TIMESTAMPTZ,
  ADD COLUMN is_prn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN high_alert BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN controlled_schedule TEXT CHECK (controlled_schedule IN ('II','III','IV','V')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','held','discontinued','completed')),
  ADD COLUMN discontinued_at TIMESTAMPTZ, ADD COLUMN discontinued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN discontinue_reason TEXT,
  ADD COLUMN ordered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN order_id TEXT;                      -- orders.id (ledger) when placed via CPOE
UPDATE medications SET status = CASE WHEN is_active THEN 'active' ELSE 'discontinued' END;

-- mar_entries: becomes the dose table (mirrors EMR-Backend MedicationAdministration)
ALTER TABLE mar_entries
  ADD COLUMN encounter_id TEXT REFERENCES encounters(id) ON DELETE CASCADE,
  ADD COLUMN dose TEXT, ADD COLUMN route TEXT,
  ADD COLUMN given_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN witness_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reason_code TEXT,                   -- held / refused / not_given reason
  ADD COLUMN is_prn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN high_alert BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'schedule' CHECK (source IN ('schedule','prn','legacy')),
  ADD COLUMN voided_at TIMESTAMPTZ, ADD COLUMN voided_by TEXT REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN void_reason TEXT,
  ADD COLUMN amended_from TEXT REFERENCES mar_entries(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE mar_entries SET status = 'scheduled' WHERE status = 'due';
ALTER TABLE mar_entries
  ADD CONSTRAINT mar_status_chk CHECK (status IN ('scheduled','given','held','refused','not_given','voided')),
  ADD CONSTRAINT mar_medication_fk FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;
-- one dose slot per order per time, so a double tap cannot create two administrations
CREATE UNIQUE INDEX mar_slot_uq ON mar_entries (medication_id, scheduled_time) WHERE voided_at IS NULL AND source = 'schedule';
CREATE INDEX mar_encounter_idx ON mar_entries (encounter_id, scheduled_time);

-- reason codes are a fixed vocabulary (TJC-style), tenant-extensible later
CREATE TABLE mar_reason_codes (code TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('held','refused','not_given')), label TEXT NOT NULL);
INSERT INTO mar_reason_codes VALUES
 ('npo','held','NPO / procedure'), ('vitals_out_of_range','held','Vital signs outside parameters'), ('md_hold','held','Provider hold order'),
 ('patient_refused','refused','Patient refused'), ('patient_asleep','not_given','Patient asleep'), ('off_unit','not_given','Patient off unit'),
 ('drug_unavailable','not_given','Medication not available'), ('other','not_given','Other (see remarks)');
```

`due`, `late` and `missed` are **derived on read** from `scheduled_time` (−30 min / +30 min / +120 min), exactly as the reference service does; they are never stored, so no background job can disagree with the clock.

Frequency table (pure function, unit-tested, clinical reviewer to sign off): `QD/daily 24h, BID 12h, TID 8h, QID 6h, Q4H, Q6H, Q8H, Q12H, QHS 1×21:00, once 1×, PRN none`. Standard administration times are tenant-configurable later; Phase A uses start-time anchoring like the reference.

## 5. API changes

| Method / path | Role | Behaviour |
|---|---|---|
| `POST /api/orders` (medication variant) | physician (clinical) | gains `doseUnit, indication (required), startAt, stopAt, isPrn, highAlert, controlledSchedule`; after insert calls `generateDoses()` for the first 24 h |
| `POST /api/patients/:id/medications` | — | **removed** as a write path (returns 410 with pointer to `/api/orders`); `GET` keeps working for the facesheet |
| `POST /api/prn-stat` | physician/nurse | rewritten to call the same CPOE handler with `isPrn=true` (CDS + RxNorm apply); response shape unchanged for the PRN tab |
| `PUT /api/orders/:id/status` | physician (clinical) | `discontinued|cancelled|held|active` + required `reason`; in one transaction updates `orders`, `medications.status/is_active`, and voids future `scheduled` MAR rows (held: pauses generation) |
| `GET /api/mar/encounter/:encounterId?from=&to=` | physician, nurse, pharmacist | dose rows with derived status, grouped per medication; lazily tops up the next 24 h for active orders |
| `GET /api/mar/:patientId` | same | kept, now encounter-resolved; same row shape plus `dose, route, isPrn, holdReason, highAlert` |
| `POST /api/mar/doses/:id/administer` | nurse, physician (clinical) | `givenTime` (≤ now, within ±2 h of schedule unless `lateReason`), optional `witnessId` (required when `high_alert` or controlled), `remarks`; sets `given_by_id = req.user.id`, `given_by = req.user.name`; 409 if not `scheduled` |
| `POST /api/mar/doses/:id/hold` / `/refuse` / `/not-given` | same | `reasonCode` (from `mar_reason_codes`) + `remarks` |
| `POST /api/mar/doses/:id/void` | same + pharmacist | `reason` required; row kept, `voided_*` set; a corrected row may reference it via `amended_from` |
| `POST /api/mar/prn` | same | PRN give against an active PRN order: `medicationId, givenTime, dose, indication, witnessId?`; enforces min interval and max-dose text from the order |
| `POST /api/mar` (legacy) | — | **removed**; frontend switched to the dose endpoints |
| `GET /api/mar/worklist?unitId=` | nurse, physician | due / late / missed across the unit for the nursing dashboard tile |
| CDS | — | `cds_alerts.outcome='blocked'` written before the 409; allergy class validated against the enum in `records.js`; `RXNAV_MODE` defaults to `live` when `NODE_ENV=production` |
| e-Rx | — | transmit failure writes `status='error'` in its own statement after rollback (SAF-18) |

All MAR writes produce an `audit_events` row through the existing middleware; the audit `action` carries the dose status transition.

## 6. UI changes

| Screen | Change |
|---|---|
| Medication Management → MAR tab | Per-medication grid by time slot for the shift (06–14, 14–22, 22–06), colour by derived status (scheduled / due / late / missed / given / held / refused), Give dialog (time, witness picker when high-alert, remarks), Hold/Refuse/Not given dialog with reason code, Void with reason, PRN give. "Given by" field removed — shows the session user |
| CPOE New Order (medication) | dose unit, indication (required), start/stop, PRN toggle, high-alert and controlled flags; existing CDS override dialog unchanged |
| Orders timeline / Order dashboard | Discontinue / Hold require a reason; status mirrors `medications.status` |
| PRN / STAT tab | posts through the shared order path; list unchanged |
| Nursing dashboard tile (shared with the nursing proposal) | due / late / missed counts for the unit |
| Facesheet → Medications tab | shows order status and stop date |

## 7. Files

Backend: `db/migrations/025_medication_safety.sql`, new `lib/marSchedule.js` (pure `computeScheduleTimes` + `generateDoses`/`topUp`), new `routes/mar.js` (mounted in the `app.js` protected array, per-route gates only), `routes/medication.js` (remove `POST …/medications` and `POST /api/mar`, PRN adapter), `routes/orders.js` (fields, status transaction, `blocked` outcome), `lib/cds/schemas.js`, `routes/records.js` (allergy enum), `lib/rxnav.js`, `middleware/moduleGate.js` (med-rec + MAR rules), `lib/medRec.js` (tenant predicate), `db/seed.js` (MAR demo data).
Frontend: `services/medicationManagement.service.ts`, `types/medicationManagement.ts`, `pages/inpatient/medication-management/{MarTab,PrnStatTab,MedicationManagementPage}.tsx`, `features/cpoe/components/NewOrderForm.tsx`, `features/cpoe/components/OrdersTimeline.tsx`, `types/cpoeOrders.ts`, `pages/patient/Medications.tsx`.
Shared files touched (cross-module impact stated): `routes/orders.js` (CPOE module, Dev 3), `middleware/moduleGate.js` (platform), `db/seed.js`.

## 8. Risks and mitigations

- Removing the legacy `POST /api/patients/:id/medications` breaks any caller still using it: grep shows only the facesheet Medications tab (read) and `medicationManagement.service.ts`; both switched in the same change.
- Schedule anchoring on order time rather than hospital standard times may differ from the client's policy: table is isolated in `lib/marSchedule.js` and flagged for clinical review.
- Historical `mar_entries` rows have no `encounter_id`: backfilled from the patient's encounter active at `scheduled_time`, else left null and shown under "unlinked".
- RBAC in flight: this module uses `requireClinicalRole` for give/hold/void; the RBAC module must finish first or the suite stays red for two reasons at once.

## 9. Tests

- Unit: `tests/marSchedule.unit.test.js` — every frequency, window edge exclusivity, PRN yields none, `stopAt` truncation, idempotent top-up.
- Integration (`api.test.js` new block): order BID → 2 doses in 24 h → give one (signer = session user, client `givenBy` ignored) → second give on same slot 409 → hold with reason → discontinue voids future rows and flips `medications.status` → PRN give enforces interval → high-alert give without witness 400 → legacy POST returns 410 → CDS blocked outcome persisted → nurse can read MAR, billing cannot.
- Update existing tests that still call `POST /api/patients/:id/medications` (tests 9, 1711 setup) to use `/api/orders`.
- Browser walkthrough: Medication Management → MAR on a fresh encounter shows due doses; give/hold/void cycle; dashboard tile count.

## 10. Effort

Backend 5 days, frontend 4 days, tests + walkthrough 2 days. One approval; CPOE field additions are listed above as the only cross-module change.
