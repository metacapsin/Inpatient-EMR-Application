# Patient Portal / SMART: Completed Work

Date: 2026-11-13. Phase 1, module 4. Approved scope implemented (invite access kept at admin+physician+nurse per your call, not narrowed to admin-only); no external blocker.

## Summary for stakeholders

A real account-takeover hole is closed: sending a patient a portal invite could previously be redirected to any email address typed into a form field, and doing so on a patient who already had an active account **silently deleted that patient's password** and handed a fresh one to whoever controlled the new address. Portal invites now always go to the email already on file for that patient, and an active account can no longer be reset this way at all — the patient uses the existing self-service "Forgot password" instead. Separately, a patient logging in or requesting a password reset with an email that happens to exist at more than one healthcare organization using this system could get a confusing failure or (for password reset) a link sent for the wrong organization's account; both are now resolved correctly regardless of which organization's account the email belongs to. Finally, the SMART-on-FHIR integration (the API third-party apps like a patient's own medication-tracking app would use) now follows the spec correctly: discovery is served where integrators expect it, every endpoint URL is a real absolute link instead of a relative path, apps must declare which server they intend to call and get rejected if it doesn't match, and revoking an authorization can no longer reach across to a different connected app's grant.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Portal-invite email can't be overridden | SEC-06 | `POST /api/patients/:id/portal-invite` always uses `patients.email`; a caller-supplied `email` is ignored entirely. No email on file → clear 409 telling staff to add one in Demographics first |
| 2 | Active accounts can't be reset via invite | SEC-06 | Re-inviting an account that already has a password now returns 409 ("use Forgot password instead") rather than nulling the password and re-sending to whatever email was given. Re-inviting a *not-yet-activated* invite is unaffected (unchanged behavior, no risk there) |
| 3 | Audit trail | SEC-06 | Every invite attempt — created, resent, or blocked because the account is active — now writes an explicit `audit_events` row (`resource: patient_account`) in addition to the generic per-request log every route already gets |
| 4 | UI | SEC-06 | Portal-invite email field is now a read-only display of the patient's email (not an editable input); "Resend invite" is hidden once the account is active, replaced with guidance to use the patient's own "Forgot password" |
| 5 | Cross-tenant login ambiguity | SEC-14 | `/patient-auth/login`, when no `tenantId` is given, now tries every account matching that email (across tenants) and logs in to whichever one's password actually matches, instead of only ever trying "the oldest account" and failing a correct password on a newer one |
| 6 | Cross-tenant forgot-password ambiguity | SEC-14 | `/patient-auth/forgot-password` now sends a correctly-scoped reset link to *every* matching active account across tenants, not just one picked arbitrarily — same inbox either way, so nothing new is disclosed |
| 7 | SMART discovery path | SEC-15 | Served at the spec-correct `/fhir/.well-known/smart-configuration` (relative to the FHIR base, not the app root); the old `/.well-known/smart-configuration` now 301-redirects there |
| 8 | Absolute discovery URLs | SEC-15 | New `BACKEND_URL` config used to build `authorization_endpoint`/`token_endpoint`/`revocation_endpoint` as real absolute URLs instead of bare paths |
| 9 | `aud` validated | SEC-15 | `/oauth/authorize` now requires `aud` and rejects (redirect with `error=invalid_request`) if it doesn't match `${BACKEND_URL}/fhir` |
| 10 | Revoke scoped to the owning client | SEC-15 | `/oauth/revoke`'s update now also filters by `client_id` when one is presented, so a client can only revoke its own grants |
| 11 | Tests | — | New `backend/tests/patientPortal.test.js` (9 tests): override ignored, no-email-on-file rejected, active-account reinvite blocked + original password still works, resend-while-pending unaffected, cross-tenant login resolves correctly both directions, cross-tenant forgot-password issues a fresh token per account, discovery path + absolute URLs + old-path redirect, `aud` required/mismatch/match, revoke doesn't cross client boundaries. Full backend suite: **89/89** (the previously-flaky "Patient Access #64" test now passes cleanly too — it needs the frontend dev server reachable, which is now actually running) |

## Files

Backend changed: `src/routes/patientAccounts.js`, `src/routes/smartAuth.js`, `src/config.js`, `.env.example`, `.env`, `tests/api.test.js` (updated the existing SMART integration test for the new `aud` requirement and dropped its now-ignored `email` override), `tests/authHardening.test.js` (dev-token test now sets the patient's email directly instead of overriding it in the request), `tests/patientPortal.test.js` (new), `package.json` (test script).

Frontend changed: `src/components/patient-access/PatientPortalAccessBlock.tsx`, `src/services/patientAccess.service.ts`.

## Verification

Full backend suite **89/89** (`npm test`), backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server: sent a portal invite with an attacker-controlled `email` in the request body to a patient with a real email on file — the invite went to the patient's actual email, confirmed via the API response; the Demographics → Patient portal access card now shows the email as read-only text with a "can't be redirected elsewhere" note and no editable field; `/fhir/.well-known/smart-configuration` returns absolute URLs; the old `/.well-known/smart-configuration` path 301-redirects to it.

## A process note, not a code issue

While finishing this module, a second concurrent Claude Code session on this same project restarted the backend dev server independently (grabbing port 4000 with a plain, non-watching `node src/server.js` that was serving stale pre-fix code). Caught via `ss -ltnp` showing an unexpected PID/start-time on port 4000; resolved by killing it and restarting cleanly through `npm run dev`. See the `concurrent_sessions_gotcha` memory — this is now the second time it's happened.
