# CI Module: Completed Work

Date: 2026-11-12. Issue IDs closed: BUG-01 (allergy status), plus the testing-strategy items "no CI" and "broken npm test glob".

## Summary for stakeholders

Every push to `main` and every pull request now runs the full backend integration suite against a real PostgreSQL, the frontend type check, unit tests and production build, and a secret scan. The one failing backend test was a genuine bug (an allergy could not be marked inactive through the legacy flag) and is fixed; the suite is 50/50 green.

## What changed

| Item | Detail |
|---|---|
| `.github/workflows/ci.yml` | Three jobs: **backend** (Postgres 16 service, `npm ci`, `node src/db/migrate.js`, `npm test` with `NODE_ENV=test` and CI-only dummy secrets), **frontend** (`npm ci`, `tsc --noEmit`, `vitest run`, `vite build`), **secrets** (gitleaks on the pushed commits). Node 20, npm cache, cancel-in-progress per branch |
| `backend/package.json` `test` script | Explicit file list instead of a quoted glob that Linux shells never expanded; still uses `cross-env` for Windows |
| `backend/src/routes/records.js` | `clinicalStatus` no longer defaults to `'active'` in the allergy schema, so a `status: false` update is honoured (root cause of BUG-01) |
| `backend/.env.example` | CI note; no secrets added anywhere |

The historical Gemini key in commit `07fb8ab` will be reported by gitleaks if it ever scans full history; the workflow scans only the pushed range. The key is revoked; rewriting history remains a separate decision.

## Verification

| Check | Result |
|---|---|
| `cd backend && npm test` | 50/50 (api 35, ai 1, cds 5, contracts 1, eligibility mapper 7, icd10 parser 1) |
| Frontend `tsc`, vitest, build | clean, 27/27, built |
| Workflow | will execute on the next push to GitHub (`metacapsin/Inpatient-EMR-Application`); Actions must be enabled on the repository |

## Local note

`backend/node_modules` was missing dev dependencies (`cross-env`) on this machine; `npm install --include=dev` restored them. CI uses `npm ci`, which installs them by default.
