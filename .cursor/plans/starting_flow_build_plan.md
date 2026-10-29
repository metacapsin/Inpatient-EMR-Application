# Starting Flow Build Plan — Tenant Onboarding → Patient Registration → ADT Admission

**For a fresh Claude Code session in this repo.** This is a standalone, implementation-ready spec for the first three connected flows a real deployment needs: a hospital gets onboarded, its staff register a patient, and that patient gets admitted. Everything else in the full 72-module plan (medications, billing, the rest) is out of scope here — this is specifically "can a new tenant stand itself up and get its first patient admitted."

Read Phase 0 before writing any code — it's the actual conventions this codebase already uses, verified against the live files, not assumed.

---

## Phase 0 — Orientation (read first)

Repo root: `/home/jatin/Desktop/EMR/Inpatient-EMR-Application`. Backend: `backend/src` — Node/Express 5, raw `pg` (no ORM), PostgreSQL. Frontend: `frontend/src` — React + Vite + TypeScript + Tailwind.

Conventions confirmed from the live code (match these, don't invent new ones):

- **Routes**: one `Router()` per file in `backend/src/routes/`, exported as `<name>Router`, mounted in `backend/src/app.js`. Some existing paths are legacy-shaped (e.g. `/Patient/createPatient`) to match a contract the frontend already expects — don't rename those. New endpoints you add can use clean REST paths; there's no legacy contract to match for things that don't exist yet.
- **Response envelope**: `{status: 'success', data, ...extra}`, via `ok()` / `created()` in `backend/src/lib/http.js`, or a file-local `success(res, message, data, code)` helper (see `adt.js`). Match whichever pattern the file you're extending already uses.
- **DB rows → JSON**: snake_case columns in Postgres; `row()` / `rows()` in `lib/http.js` convert to camelCase and mirror `id` as `_id` (the frontend's normalizers expect both).
- **Validation**: Zod schemas via `parse(schema, req.body)` from `lib/http.js`.
- **Auth**: `requireAuth` middleware sets `req.user = {id, tenantId, role, name, email}` from the JWT (`tid` claim → `tenantId`). `requireRole(...roles)` gates routes; `'admin'` always passes regardless of the list.
- **Transactions**: `withTx(async (db) => {...})` from `db/pool.js`; use `SELECT ... FOR UPDATE` for rows with concurrent-write risk (see `adt.js`'s bed-locking in `lockBed`/`assertBedFree`).
- **Best-effort side effects**: wrapped in their own try/catch, logged on failure, never thrown — they must never fail the main request. See `notifyStaff()` in `adt.js`. Follow this same pattern for the new async hooks below (Rcopia sync, ADT notification).
- **Migrations**: numbered SQL files in `backend/src/db/migrations/`, auto-applied in order and tracked in a `schema_migrations` table by `db/migrate.js`. Current files: `001_init.sql`, `002_notifications.sql`, `003_scheduling_records_ops.sql`. Your new migration is `004_...`.

**A real gap, found while writing this plan, not a design choice**: `users.tenant_id` is `TEXT NOT NULL REFERENCES tenants(id)`, and `users.role` is `CHECK (role IN ('admin','physician','nurse','pharmacist','billing','staff'))`. There is currently no way to represent a Super Admin in this schema — a platform-level admin cannot be a row in `users` as it stands, because every user is required to belong to exactly one tenant. This has to be solved with a separate table and a separate auth path (Phase 1), not a role-string hack bolted onto `users` — bolting it on would mean every tenant-scoped query in the codebase needs to start worrying about rows that don't actually belong to a tenant.

---

## Phase 1 — Platform Admin foundation (blocks everything else)

Goal: a Super Admin can exist and authenticate, entirely separate from any tenant.

**New migration `004_platform_admin.sql`**:
- `platform_admins` table: own `id`, `email`, `password_hash`, `is_active`, timestamps. No `tenant_id` column — deliberately. This is a separate credential space from `users`, not a role within it.
- New columns on `tenants`: `status` (`'trial' | 'active' | 'suspended'`, default `'trial'`), `plan` (text), `stripe_subscription_id` (text, nullable), `enabled_modules` (jsonb array, default `'[]'`), `onboarding_status` (text, default `'provisioned'`).

**New `backend/src/middleware/platformAuth.js`**: a `requirePlatformAuth` middleware, structurally parallel to `requireAuth`, but verifying a token issued only by a platform-admin login — use a distinct `typ` claim (e.g. `'platform'` vs the existing `'access'`) or a separate signing secret, so a leaked tenant-scoped token can never be replayed as a platform token, and vice versa.

**New `backend/src/routes/platformAuth.js`**: `POST /api/platform/login` (public) — issues the platform JWT against `platform_admins`.

**New `backend/src/routes/platformAdmin.js`**, mounted in `app.js` on its own branch, behind `requirePlatformAuth` — NOT behind the existing `requireAuth`:
- `GET /api/platform/tenants` — list all tenants
- `POST /api/platform/tenants` — create a tenant (this is Tenant Onboarding step 1 from the flow diagram already in the main plan doc): insert the `tenants` row, create the Stripe subscription, set `enabled_modules` from the request. **Stub the Stripe call** — no live keys yet (see Third-Party Dependencies in the main plan doc).
- `POST /api/platform/tenants/:id/invite-admin` — creates the first `users` row for that tenant with `role='admin'`, sends an invite email. **Stub the email send.**
- `PATCH /api/platform/tenants/:id` — update status/plan/`enabled_modules`.

---

## Phase 2 — Tenant Onboarding frontend

- A new route tree under `frontend/src/` for the Super Admin Console — its own layout shell, gated on the platform JWT (not the tenant one). Two screens to start: Tenant Directory (list + status) and Tenant Provisioning (the create-tenant form, calling Phase 1's `POST /api/platform/tenants`).
- Tenant Onboarding Wizard — tenant-facing, not platform-facing. Shown to a brand-new tenant's first Admin on login while `onboarding_status !== 'complete'`: a guided multi-step form covering facility setup (wards/rooms/beds — **check `routes/facility.js` first**, this may already exist and just need wiring into the wizard) and staff invites (new `users` rows via the existing role enum). On completion, `PATCH` `onboarding_status` to `'complete'`.

---

## Phase 3 — Patient Registration hooks

Two additions to the existing flow in `patients.js` — extend it, don't rewrite it:

- **Eligibility check hook**: after `POST /Patient/createPatient` succeeds, call an eligibility-check function. Stub it to return `{eligible: true}` for now — the real payer API integration is a separate, later piece. Build it so the stub and the real call share the same function signature, so swapping one for the other later doesn't touch calling code.
- **Rcopia sync job**: needs a job queue first.
  - Add `pg-boss` as a dependency; initialize it in a new `backend/src/db/queue.js` alongside the existing `pool`.
  - On patient creation, enqueue a `rcopia-patient-sync` job carrying the patient's demographics.
  - Worker in `backend/src/jobs/rcopiaSync.js`: for now, log the payload instead of calling a real Rcopia endpoint (no DrFirst credentials yet). Structure it so the only change later is swapping the log line for a real `fetch()` call.

---

## Phase 4 — ADT Admission hook

One addition to the existing `POST /api/admissions` handler in `adt.js`:

- After the transaction commits — same place `notifyStaff` already runs, same best-effort try/catch pattern — enqueue an `adt-notification` job on the same pg-boss queue from Phase 3.
- Worker in `backend/src/jobs/adtNotification.js`: builds the HL7/C-CDA-lite payload per CMS CoP. Stub the actual delivery (no real post-acute/PCP recipient directory integration yet); log it instead.

---

## Phase 5 — End-to-end check

Before calling this done, walk the full path once: platform login → create tenant → invite that tenant's admin → admin logs in → completes the onboarding wizard → registers a patient (confirm the Rcopia job got enqueued) → admits that patient (confirm the ADT-notification job got enqueued). Extend `backend/tests/api.test.js` for this — it already uses Node's native `node --test`; don't introduce a second test framework for one more flow.

---

## Explicitly stubbed in this pass, not built

Each of these needs a real vendor relationship or credentials that don't exist yet. They're written as isolated, swappable stubs on purpose — closing any one of them later should mean changing one function, not re-architecting the flow around it.

- Real Rcopia/DrFirst API calls — needs DrFirst's partner API documentation
- Real Stripe subscription creation — needs live Stripe keys
- Real eligibility-check payer API — needs a clearinghouse contract
- Real ADT notification delivery — needs the actual HL7 transport/recipient-directory integration

---

*Context this plan assumes but doesn't repeat: the full 72-module scope, team structure, timeline, and the Patient Registration / Rcopia / Tenant Onboarding flow diagrams live in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc built earlier in this project's planning. This file is deliberately self-contained so a new session can start from it without needing that doc open.*
