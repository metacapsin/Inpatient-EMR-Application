# Security Hardening: Completed Work

Date: 2026-11-13. Phase 1, module 5. Approved scope implemented in full; no external blocker.

## Summary for stakeholders

Three gaps closed. First, transport/at-rest security: TLS to Postgres is now required in production (was entirely unconfigured — relied on whatever happened to be in the connection string, which was nothing); outbound email now actually verifies the mail server's certificate instead of accepting any certificate at all; a webhook recipient's `Authorization` secret is now encrypted in the database instead of stored as plain text, and ADT webhook endpoints must be `https://` (plain `http://` is rejected) since they carry patient name/MRN/diagnosis in the request body; MLLP (the raw HL7 interface protocol some hospital systems use) now supports an encrypted `mllps://` option, with the existing unencrypted `mllp://` still available but off by default unless explicitly enabled for a link that's already private. Second, document handling: deleting a patient document is now a soft delete (recoverable, not gone) instead of a hard delete; uploads are checked against an allowlist of real clinical document types and the actual file bytes are checked against the claimed type, closing a bug where a file's type could be fully spoofed by whatever was declared in a `data:` URL prefix. Third, a flowsheet signature screen that claimed "co-sign and break-glass policies are enforced server-side in production" — neither exists in the backend — now says so accurately.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | DB TLS | SEC-12 | `db/pool.js` passes an explicit `ssl` option, required in production (`DATABASE_SSL=require` is the default there; `=disable` is the explicit opt-out), off by default outside it so local/CI Postgres keeps working unchanged |
| 2 | SMTP certificate verification | SEC-12 | Removed `tls: { rejectUnauthorized: false }` from the outbound mail transport — real cert validation, nodemailer's own default |
| 3 | Webhook secret encrypted at rest | SEC-12 | New `lib/crypto.js` (AES-256-GCM, zero new dependencies); `notification_recipients.auth_header_secret` is encrypted on every create/update and decrypted only at send time in `adtTransport.js`. A value saved before this change is still readable (transparently treated as legacy plaintext) and gets encrypted the next time that recipient is saved — no migration script or downtime needed |
| 4 | HTTPS-only webhooks | SEC-12 | Endpoint validation narrowed to `https://` only for `https_webhook`, enforced again at send time as defense in depth |
| 5 | MLLP encryption option | SEC-12 | `mllps://host:port` now connects via TLS (`node:tls`); plain `mllp://` still works but throws unless `ALLOW_PLAINTEXT_MLLP=true` is set (same opt-in pattern as `ALLOW_DEV_TOKENS`) |
| 6 | Soft-deleted documents | SEC-18 | Migration 025 adds `deleted_at`/`deleted_by` to `patient_documents`; `deleteDocumentById` is now an `UPDATE`, not a `DELETE`; every read/list/download query excludes soft-deleted rows |
| 7 | Document mime allowlist + magic bytes | SEC-18 | New `lib/documentSecurity.js`: an allowlist of real clinical document types (PDF, JPEG, PNG, TIFF, plain text, Word/Excel, DICOM) plus a check that the first bytes of the uploaded content actually match the claimed type. The *resolved* mime (after extracting a `data:` URL's own embedded type, which is what previously silently overrode the declared field with nothing validating either) is what gets checked — closing that bypass, not just adding a check next to it |
| 8 | SEC-22 UI text | SEC-22 | `NursingFlowsheetWorksurface.tsx`'s false "enforced server-side in production" claim replaced with an accurate one — neither co-sign nor break-glass exists in the backend yet |
| 9 | Tests | — | New `backend/tests/securityHardening.test.js` (9 tests): crypto round-trip + tamper rejection, webhook secret never echoed back and verified encrypted in the DB directly, `http://` webhook rejected, plaintext MLLP blocked unless the flag is set (and `mllps://` is exempt from that gate), soft-deleted document disappears from reads but the row and its content survive, disallowed mime rejected, magic-bytes mismatch rejected, the `data:` URL override bypass closed, and two config-boot tests (subprocess, same pattern as the existing `PLATFORM_JWT_SECRET` prod-boot test) confirming `ENCRYPTION_KEY` is required in production and `DATABASE_SSL` defaults to required there. Full backend suite: **98/98** |

## Explicitly out of scope (as flagged in the proposal)

Antivirus/malware scanning on uploads (needs a real AV engine or cloud scanning API — a provider decision, not a code fix), moving document storage out of Postgres into object storage (an architecture change, not a bug fix), and full-disk/TDE database encryption (an infrastructure/hosting setting, not application code). None of these were implemented, and none were silently skipped — they're the three items the proposal named as out of scope going in.

## Verification

Full backend suite **98/98** (`npm test`), backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server: an `http://` webhook recipient creation attempt returns 400 with the expected message; an `https://` one with a secret succeeds and the DB row's `auth_header_secret` is confirmed to be the encrypted `iv:tag:ciphertext` format, not the plaintext; a `.exe` disguised as a mime-allowed upload is rejected both for the disallowed mime and (separately) for a magic-bytes mismatch on a fake PDF; a real PDF uploads and downloads fine, then a delete leaves the row in place with `deleted_at` set and content still intact while the read/download/list endpoints all correctly report it gone; the flowsheet's corrected signature text is confirmed rendered in the browser.

## Files

Backend new: `src/lib/crypto.js`, `src/lib/documentSecurity.js`, `src/db/migrations/025_security_hardening.sql`, `tests/securityHardening.test.js`. Backend changed: `src/db/pool.js`, `src/lib/email.js`, `src/lib/adtTransport.js`, `src/routes/adtNotifications.js`, `src/routes/records.js`, `src/config.js`, `.env.example`, `.env`, `tests/api.test.js` (one existing ADT test's `http://` test endpoint updated to `https://`), `package.json` (test script).

Frontend changed: `src/features/nursing-flowsheet/components/NursingFlowsheetWorksurface.tsx`.
