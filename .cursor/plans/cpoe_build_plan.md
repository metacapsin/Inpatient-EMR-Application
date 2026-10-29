# CPOE Build Plan — Unified Order Entry

## STATUS as of 2026-10-27: built and passing tests, but uncommitted

This plan originally described CPOE as upcoming work. It no longer is — the unified orders ledger described below has actually been implemented and independently verified this session, not just read and assumed correct:

- **Migration** `backend/src/db/migrations/006_cpoe_orders.sql` exists and is **applied** — `npm run db:migrate` against the dev Postgres reported "up to date."
- **Route** `backend/src/routes/orders.js` (347 lines) exists, is mounted in `app.js` correctly (after `requireAuth`/module gate, consistent with the `backend_router_middleware_gotcha` memory), and implements not just the three endpoints originally planned but two more that integrate with the pre-existing `frontend/src/features/order-dashboard`: `PUT /api/orders/:id/status` and a `GET /api/inpatient/orders` + `POST /api/inpatient/orders/:id/cancel` pair.
- **Tests** — `backend/tests/api.test.js:935-1017` has a dedicated CPOE block (all 4 order types, the radiology-by-nurse 403 case, timeline aggregation, status-flip + terminal-conflict rejection, dashboard filters/pagination/cancel, tenant isolation). Run for real against the embedded dev Postgres this session: **18/18 passing.**
- **Frontend** — `frontend/src/features/cpoe/components/{NewOrderForm,OrdersTimeline}.tsx` and `frontend/src/pages/patient/UnifiedOrders.tsx` (mounted in `FacesheetPage.tsx`, route `clinical/unified-orders`) call the real endpoints with no mock flag. The pre-existing Order Dashboard now also hits `GET /api/inpatient/orders` for real (`VITE_UNIFIED_ORDERS_MOCK=false`). `tsc --noEmit` is clean.
- **Not committed.** Every file above is untracked/modified per `git status` — the most recent commit (`07fb8ab "backend done"`) predates all of it. This is real, verified work sitting in the working tree with zero commits protecting it. **Recommend committing it before doing anything else** — ask the user first, since commits are the user's call, but flag the risk plainly: uncommitted work this size is one bad `git clean`/`checkout` away from being lost.

The rest of this document is kept for the schema/endpoint reference it still provides, plus (below) the real remaining gaps against ONC's certification requirements and real-world CPOE practice — this is now a gap-closure plan, not a from-scratch build plan.

---

## A latent bug found, not yet fixed

`frontend/src/services/unifiedOrders.service.ts`'s `acknowledgeUnifiedOrder()` posts to `/api/inpatient/orders/:id/acknowledge` when not in mock mode — **`orders.js` never defines this route.** It's currently harmless only because `toDashboardRow()` (`orders.js` line 257) hardcodes `canAcknowledge: false` on every row, so the dashboard UI never renders a button that would trigger the call. The moment someone wires up an "Acknowledge" action (a reasonable next step — see gap list below), this becomes a live 404. Worth fixing alongside whichever gap below adds acknowledgement semantics, not left for someone to rediscover later.

---

## Industry grounding (confirmed via direct ONC source lookup this session)

- **§170.315(a)(1)/(a)(2)/(a)(3)** are three parallel, independent ONC certification criteria — CPOE for Medications / Laboratory / Diagnostic Imaging. Each only requires that a user can **record, change, and access** orders of that type, with an *optional* reason-for-order field; neither mandates a specific coding standard. The existing four order-entry endpoints (now unified under this ledger) effectively cover all three — this is the right shape for a real inpatient product.
- **§170.315(a)(4) "Drug-drug, drug-allergy interaction checks for CPOE"** is a separate, narrower criterion, explicitly scoped by ONC as "separate and distinct" from general CDS: automatic contraindication alerts **at the moment of order entry**, from structured medication/allergy lists, with alert severity adjustable by an authorized user. This is the natural next module after CPOE, and the orders ledger exists specifically to give it one interception point — but right now, **no such interception point exists even as a stub** inside `POST /api/orders`'s transaction. Worth adding a no-op hook there now rather than retrofitting one later.
- **§170.315(a)(9) Clinical Decision Support** is broader still — interventions keyed on 6 data categories (problems, meds, allergies, demographics, labs, vitals), HL7 Infobutton lookups, source attribution, role-based configuration. Note: ONC's own site marks this specific 2015-Edition criterion number as expired January 1, 2025 — reconfirm the current edition's numbering before building the deferred CDS module. The three-way scope boundary (CPOE vs. (a)(4) vs. broader CDS) is stable regardless of renumbering, and is exactly the line this project's plan already draws.
- **Verbal orders / co-signature**: Joint Commission requires verbal orders to be dated, timed, and authenticated, but leaves the countersignature *window* to hospital policy and state law — the old blanket CMS 48-hour rule lapsed in January 2012. Standard real-world pattern: a nurse transcribes with read-back, the order is flagged pending, and the ordering (or covering) physician authenticates within the facility's own policy window.
- **Order sets / quick-order bundles**: built per department with safe defaults, periodically reviewed (commonly every 6 months) against current evidence — standard practice for reducing CPOE cognitive load, not implemented here yet.

---

## Remaining gaps (real, verified against the live code — not from the original plan's assumptions)

**Against the ONC 3-part requirement:**
1. No "reason for order" field on the **medication** or **lab** order-type variants in `orders.js` (radiology already has a required `clinicalIndication`; `prn_stat` already has a required `indication`). Inherited from the original four endpoints this ledger reused — not a regression, but the cheapest, most directly-named gap against all three ONC criteria.
2. "Change" (amending an already-placed order's clinical detail, not just its status) isn't implemented — only terminal status transitions exist via `PUT /api/orders/:id/status`.
3. No interception point for (a)(4) drug-interaction checking exists inside `POST /api/orders`'s transaction — not even a stub before the medication/`prn_stat` insert. Add one now (even as a no-op) so the CDS module doesn't have to retrofit the transaction boundary later.

**Against real-world CPOE practice, deliberately deferred by the original plan:**
4. Order sets/quick-order templates — zero code, as originally disclosed.
5. Verbal-order/co-sign workflow — only scaffolding exists (the unused `'draft'` status in the `orders` CHECK constraint, and `prn_stat_orders.given_by`/`doctor_approval` as free text). Nothing sets or reads `'draft'`; there are no `cosigned_by`/`cosigned_at`/`ordered_via` columns.
6. Discontinue/cancel takes no reason — both `PUT /api/orders/:id/status` and `POST /api/inpatient/orders/:id/cancel` accept a bare status with no audit-comment field.
7. **The acknowledge-endpoint bug above** — fix when adding acknowledgement semantics to the ledger.

---

## Recommended sequencing for closing these gaps

1. **Commit the existing verified work first** (ask the user explicitly — this is their call, not an autonomous action) before touching anything else; there's no reason to layer new work on top of 18/18-passing, uncommitted code.
2. Add `reasonForOrder` to the medication/lab variants (gap 1) — smallest, most directly ONC-aligned fix.
3. Add the no-op (a)(4) interception stub inside the transaction (gap 3) — cheap now, expensive to retrofit later.
4. Add a `reason`/`comment` field to the two cancel/status-change endpoints (gap 6) — small, improves audit trail immediately.
5. Fix the acknowledge-endpoint bug (the latent 404) at the same time as deciding whether/how acknowledgement becomes a real dashboard action (gap 7).
6. Verbal-order/co-sign (gap 5) and order sets (gap 4) are real but larger features — sequence after the above, each probably deserving its own short plan once picked up.

---

## Original Phase 0–4 reference (what was planned, now built — kept for schema/endpoint detail)

<details>
<summary>Expand for the original build plan, preserved for reference</summary>

**The original finding that shaped this plan**: there was no single "orders" concept in this codebase — four independent, already-working endpoints each wrote to their own table, with their own role gate, and nothing connected them (`medications`, `prn_stat_orders`, `lab_orders`, `radiology_orders`). The job was to connect them, not replace them — and that's exactly what shipped:

1. `encounter_id` was backfilled onto `medications` and `prn_stat_orders` so every order type is consistently encounter-scoped, matching lab/radiology.
2. A unified `orders` ledger table — one row per order regardless of type, pointing at whichever detail table actually holds it (`ref_table`/`ref_id`), indexed on `(encounter_id, ordered_at DESC)`.
3. One write path, `POST /api/orders`, that in a single transaction inserts both the ledger row and the correct detail-table row.

The four original endpoints were kept — nothing that called them broke. `POST /api/orders` is the new primary path going forward, and `frontend/src/features/order-dashboard` (flagged in the original plan as mock-only) now consumes the real `GET /api/inpatient/orders` aggregate instead.

</details>

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md`, `problem_list_icd10_build_plan.md`, `physician_hp_build_plan.md`, `settings_module_backend_build_plan.md`, and `bed_booking_build_plan.md` are its siblings in this same directory.*
