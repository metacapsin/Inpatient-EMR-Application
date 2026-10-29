# Settings Module Backend Build Plan

**For a fresh Claude Code session in this repo.** Standalone and implementation-ready, same shape as `starting_flow_build_plan.md` and `cpoe_build_plan.md`. Independent track — nothing else in this batch depends on it, so it can run whenever convenient.

Read Phase 0 before writing code.

---

## Phase 0 — Orientation (read first)

Repo conventions are unchanged from the other plans in this batch. Full detail in `starting_flow_build_plan.md` Phase 0.

**Migration numbering note**: this plan proposes `007_tenant_profile.sql`. Other plans in this batch each independently propose their own "007" — renumber at actual build time to whatever's next in `backend/src/db/migrations/`.

**Scope correction, read before doing anything else**: the obvious-looking candidate for "the gap" is *not* the gap. `frontend/src/modules/settings/components/FacilityManagementCard.tsx` → `FacilitySettingsPage.tsx` → `rooms.service.ts` already calls the real, fully-wired `/Wards`, `/Rooms`, `/Beds` endpoints in `backend/src/routes/facility.js` (tenant-scoped, admin-gated writes). Despite some leftover `mockCreateWard`-named exports in `rooms.service.ts` (lines 802-811, explicitly `@deprecated` aliases), the actual functions in use hit real endpoints. **Don't build backend for Facility Management — it's done.** (`useFacilityMetrics.ts` is dead/unused code, not wired into anything — flag for cleanup, not a build target.)

**The real, total gap is Practice Information.** `practiceAPI`/`commonAPI`/`settingsAPI` in `frontend/src/services/api.ts` (lines 606-631) call `/PracticeInformation/getPracticeInformationList`, `/PracticeInformation/getPracticeInformationById/:id`, `/PracticeInformation/updatePracticeInformationById/:id`, `/Common/getStates/:countryCode`, `/setting/getRaceCodes|getEthnicityCodes|getPreferredLanguageCodes`. **None exist anywhere** — not in the active Postgres backend, not even in the legacy Mongo `api/` folder (which never had a Practice/Organization/Common concept at all). This is orphaned frontend scaffolding with no legacy implementation to port; it has to be built from nothing.

---

## Exact fields the frontend already expects (read from the real component, not guessed)

`PracticeInformationCard.tsx` treats practice info as a Mongo-style singleton list (`getList()` → takes `list[0]`, keyed by `_id`): `name`, `type`/`practiceType` (display-only, no edit input), `address`, `address2`, `city`, `state` (dropdown sourced from `commonAPI.getStates('US')`), `zip`, `phone`, `fax`, `ein`, `groupNpi`.

Client-side validation already encodes real-world rules worth preserving server-side too: name 3-35 chars; address 5-250 chars, charset `[A-Za-z0-9,.\/\-#]`; city 3-50 chars; zip `^\d{5}(-\d{4})?$`; phone `(\d{3}) \d{3}-\d{4}` with area/exchange first-digit ≠ 0/1; EIN `^\d{2}-\d{7}$`; NPI `^[1-9]\d{9}$` (**format only — no checksum today**). `practiceFormatters.ts` has matching input masks.

The `tenants` table (`001_init.sql`) has only `id, name, created_at`; migrations 004/005 added only *platform-lifecycle* columns (`status, plan, stripe_subscription_id, enabled_modules, onboarding_status`). Zero self-service profile columns exist today.

---

## Industry grounding

- Real multi-tenant healthcare SaaS products (Tebra, athenahealth, SimplePractice) consistently separate four things under "Settings": basic practice info, **service locations/departments**, **user roles & permissions**, and **notification preferences**. This codebase currently has only the first, and even that one's unbuilt.
- **NPI is a real, checkable identifier**: CMS-issued, 10 digits, the last digit is a Luhn (ISO/IEC 7812) check digit computed by prefixing the first 9 digits with `80840` (the US health-industry issuer prefix) before standard Luhn doubling. The current regex checks shape only — adding the real checksum (client `.refine()` + server Zod `.refine()`) is a small, legitimate, citable compliance improvement, not gold-plating.
- **HIPAA's automatic-logoff rule** (45 CFR §164.312(a)(2)(iii)) is "addressable," not a fixed number — a covered entity must pick and document a *reasonable* idle timeout. A tenant-configurable session-timeout setting is a defensible real feature, grounded in an actual regulation, not generic UI filler.
- `users.preferences JSONB` (`001_init.sql` line 19) already exists and is unused — a ready hook for per-user notification settings rather than a new column.

---

## The real job

1. A real backend for Practice Information (the actual gap).
2. A couple of small, cheap wins alongside it (states as a static list; NPI checksum).
3. A clearly-scoped set of net-new, lower-priority additions (departments, notification prefs, security policy, branding, billing defaults) that are genuinely useful but shouldn't block shipping Practice Information itself.

---

## Phase 1 — Schema

New migration `007_tenant_profile.sql` (renumber per Phase 0's note):

```sql
CREATE TABLE tenant_profile (
    tenant_id      TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    address1       TEXT,
    address2       TEXT,
    city           TEXT,
    state          TEXT,
    zip            TEXT,
    phone          TEXT,
    fax            TEXT,
    practice_type  TEXT,
    npi            TEXT,
    ein            TEXT,
    logo_url       TEXT,
    timezone       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A separate 1:1 table, not new columns on `tenants` — keeps platform-lifecycle data (status/plan/stripe) architecturally distinct from self-service tenant profile data, matching the separation the codebase already has between `platformAdmin.js` (platform-level) and tenant-scoped routes.

Zod validators for the new router should port the frontend's exact regexes (zip/phone/EIN) so client and server agree, plus a **real NPI Luhn check** (not just the shape regex).

---

## Phase 2 — Backend

New `backend/src/routes/tenantProfile.js`:

- **`GET /api/tenant/profile`** — singleton fetch scoped to `req.user.tenantId`.
- **`PUT /api/tenant/profile`** — `requireRole('admin')` (admin always passes anyway; stated for clarity). Upsert semantics (row may not exist yet for an older tenant).

Repoint the frontend's `practiceAPI` at these clean new paths rather than preserving the old `/PracticeInformation/*` shape — unlike other legacy-shaped paths elsewhere in this app, there's no real contract to preserve here; those paths never had a working backend to begin with.

---

## Phase 3 — Frontend

- Replace `commonAPI.getStates('US')` with a static frontend constant (50 states + DC) — fixed reference data doesn't need a network round trip or a backend route.
- **Before building** `/setting/getRaceCodes|getEthnicityCodes|getPreferredLanguageCodes`: grep whether anything actually calls them today. They look like patient-demographics reference data, not practice settings — possibly belong to a different module (patient registration) or are dead scaffolding. Don't build unused endpoints; confirm a real caller first.
- Wire `PracticeInformationCard.tsx` to the new endpoints.
- `useFacilityMetrics.ts` is dead code — either wire it into a dashboard widget or delete it. Quick decision, not a build task.

---

## Phase 4 — Net-new additions (lower priority, sequence after Practice Information ships)

Each of these is a real gap with no existing frontend stub at all — don't bundle them into the same PR as Practice Information; list them so they're not forgotten, not so they block the headline deliverable:

1. **Service locations/departments** — new `departments` table + CRUD + settings-nav entry.
2. **Notification preferences** — tenant-wide defaults + per-user override via the existing (currently unused) `users.preferences` JSONB; ties into the existing `notifications` table (`002_notifications.sql`).
3. **Security policy** — `session_timeout_minutes` + password-complexity rule on `tenant_profile`, consumed by `middleware/auth.js`/token issuance. Bigger lift than pure CRUD — touches auth, sequence last.
4. **Logo/branding upload** — needs a file-storage decision (no existing upload infra in this repo); don't build storage ad hoc, decide the approach first.
5. **Billing defaults** — natural extension point is wherever the revenue/billing routes live; confirm the actual file name in the live repo before assuming one.

---

## Phase 5 — End-to-end check

Extend `backend/tests/api.test.js`: GET/PUT tenant profile round-trip, NPI checksum validation (one valid, one invalid-but-correctly-shaped case to prove the checksum actually runs, not just the regex).

---

## Explicitly out of scope for this pass

- File-storage infrastructure design (flagged as a prerequisite decision for logo upload, not solved here).
- A full RBAC/permissions editor — bigger initiative than this pass.
- Departments, notification preferences, and security policy are each separately prioritizable stretch items, not required to call Practice Information done.

---

*Context this plan assumes but doesn't repeat: the full 72-module scope lives in the "Inpatient EMR – Requirement Analysis & Completion Plan" doc; `starting_flow_build_plan.md` and `cpoe_build_plan.md` are its siblings in this same directory.*
