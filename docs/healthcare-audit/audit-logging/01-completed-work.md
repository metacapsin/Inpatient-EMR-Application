# Audit Logging Module: Completed Work

Date: 2026-11-12. Phase 1, module 1. Approved scope implemented in full; no external blocker.

## Summary for stakeholders

Every request that reaches a tenant-scoped or platform-admin route is now written to an append-only `audit_events` table — who (staff/patient/platform admin/anonymous), what action, what resource and patient, status, timing, and IP/user-agent. Logins (success and failure), logouts, token refresh, password resets, user management, platform-admin tenant actions, and SMART patient-authorization decisions additionally get a hand-written, higher-detail event. A database trigger makes the table append-only — no row can be edited or deleted except as part of a tenant's own cascade delete. Admins can browse and export their own tenant's trail from Settings → Audit Trail; platform admins have a cross-tenant read endpoint. No free-text PHI is ever stored — only ids, codes, counts, and (for failed logins) a one-way hash of the attempted username/email.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | `audit_events` table | SEC-02 | Migration `023_audit_events.sql`: append-only (BEFORE UPDATE/DELETE trigger raises, except a DELETE nested inside a tenant's own `ON DELETE CASCADE`, detected via `pg_trigger_depth()`); indexed on `(tenant,at)`, `(tenant,patient,at)`, `(tenant,actor,at)` |
| 2 | Generic per-request logger | SEC-02 | `backend/src/middleware/audit.js`: one row per request via `res.on('finish', ...)`, fire-and-forget; mounted once after `requireAuth` in `app.js` and once per-route (never as a blanket `.use()`, see the router-middleware gotcha) in `platformAdminRouter`; skips polling endpoints (`/notifications`, `/tenants/current`, `/api/ai/status`) |
| 3 | Explicit events | SEC-02 | `backend/src/lib/audit.js` `recordAuditEvent()`; wired into `routes/auth.js` (login ok/failed by username hash, logout, refresh, forgot/reset password, user create/update/delete), `routes/platformAdmin.js` (tenant create, invite-admin, status/module update, delete with impact counts), `routes/smartAuth.js` (patient login ok/failed, SMART authorization allow/deny/revoke) |
| 4 | FHIR 401s now logged | SEC-02 | `fhir_access_log.tenant_id` made nullable; a router-level Express error handler added to `fhir.js` (`requireSmartAuth` rejects before any route handler runs, so those errors previously never reached the existing per-route logging) |
| 5 | Read API | — | `GET /api/audit-events` (admin-only, tenant-scoped, filterable by patientId/actorId/action/resource/date range, paginated), `GET /api/audit-events/export.csv`, `GET /api/platform/audit-events` (platform admins, cross-tenant) |
| 6 | AI request ledger exposed | — | `GET /api/ai/requests` (admin-only) surfaces the existing `ai_requests` table (migration 022) as a second tab in the same UI |
| 7 | Frontend | — | `services/auditEvents.service.ts`; Settings → "Audit Trail" card (`modules/settings/components/AuditTrailCard.tsx`) with Audit Events / AI Requests tabs, filters, and CSV export; nav entry in `settingsNav.config.ts`; a "View this patient's audit trail" link on the patient Demographics page, pre-filtering by patient id via `?tab=auditTrail&patientId=` |
| 8 | Tests | — | `backend/tests/audit.test.js` (7 tests): chart read logs the patient id, search query values are never persisted (only key names), a failed login logs with no user, a platform tenant delete logs with impact counts, an unauthenticated FHIR request is logged, the append-only trigger rejects direct UPDATE/DELETE, the read API is admin-only and tenant-scoped. Backend suite: 57/57 |

## A subtlety worth knowing

The append-only trigger initially blocked the tenant-delete cascade itself (`DELETE FROM tenants` cascades to `audit_events` via its FK), which would have made every tenant with audit history undeletable. The trigger function checks `pg_trigger_depth()` so only a direct `DELETE FROM audit_events` is rejected; a cascade from a dropped tenant (depth > 1) is allowed through. Caught by the test suite before this reached review.

## Files

Backend new: `src/db/migrations/023_audit_events.sql`, `src/lib/audit.js`, `src/middleware/audit.js`, `src/routes/auditEvents.js`, `tests/audit.test.js`. Backend changed: `src/app.js`, `src/routes/auth.js`, `src/routes/platformAdmin.js`, `src/routes/smartAuth.js`, `src/routes/fhir.js`, `src/routes/ai.js`, `package.json`.

Frontend new: `src/types/auditEvents.ts`, `src/services/auditEvents.service.ts`, `src/modules/settings/components/AuditTrailCard.tsx`. Frontend changed: `src/pages/Settings.tsx`, `src/modules/settings/config/settingsNav.config.ts`, `src/pages/patient/Demographic.tsx`.
