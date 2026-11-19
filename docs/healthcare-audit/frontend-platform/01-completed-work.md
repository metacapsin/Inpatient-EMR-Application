# Frontend Platform Module: Completed Work (mock flags and fallbacks)

Date: 2026-11-12. Issue IDs closed: SAF-01, BUG-05.

## Summary for stakeholders

Before this change, eleven feature areas showed invented data unless an engineer had set a flag to turn mocks off, and five of them silently swapped to invented data whenever the server was slow or returned an error. Now every module talks to the real backend by default, mocks are strictly opt-in per environment, and any screen that runs on sample data carries a visible "Demo data" banner. Server failures are shown as errors instead of being hidden behind fabricated records.

## What changed

| Area | Before | After |
|---|---|---|
| Flags (`VITE_*_MOCK`) | Mock unless explicitly `false` | Real backend unless explicitly `true` (care plan, I/O, code events, radiology, staffing board, staff scheduling, CDI, denials, HAI, unified orders, consent) |
| `frontend/.env` | `VITE_USE_MOCK_API=true` (consent on mock) | `false`; no mock flags set |
| Fallback wrappers (care plan, I/O, code events, radiology, staffing board) | API with 4–5 s timeout → on timeout/error silently use in-memory mock and pin the session to mock | Pure switch on the flag; no timeout, no error fallback; data-source helpers report `api` unless the flag is on |
| Quality measures | Mock by default (no backend exists) | Unchanged data source, but the page always shows the Demo-data banner (including in its error state); `VITE_QUALITY_MEASURE_MOCK=false` is reserved for when a backend exists |
| Screens with no backend (quality measures, prior auth, allied-health notes, invoices) | No indicator | `DemoDataBanner` ("no server-side implementation yet") at the top |
| Screens whose mock can be enabled (care plan, code events, orders dashboard, denials, CDI, staff scheduling, consents, radiology, infection analytics, infection control tab) | No indicator | `MockFlagBanner` renders the banner only when that module's flag is `true` |

Explicitly unchanged: `VITE_CHARGE_CAPTURE_MOCK` (its real endpoints do not exist; handled by the Discharge workspace module), `VITE_MEDICATION_API_MOCK` and `VITE_USE_MOCK_FACILITY` (already opt-in).

## Files

New: `src/components/shared/DemoDataBanner.tsx`, `src/components/shared/MockFlagBanner.tsx`.
Changed: `.env`, `.env.example`, `src/features/{care-plan,io-tracking,code-event,radiology}/config/*Mock.config.ts`, `src/features/staff-scheduling/live-assignments/config/staffingMock.config.ts`, `src/features/{care-plan,io-tracking,code-event,radiology}/api/*WithFallback.ts`, `src/features/staff-scheduling/live-assignments/api/staffingWithFallback.ts`, `src/features/{cdi,denial-management}/services/*.service.ts`, `src/services/{unifiedOrders,staffScheduling,haiEvent}.service.ts`, `src/services/quality/qualityMeasure.service.ts`, `src/components/hai/HAIEncounterTimeline.tsx`, `src/pages/reports/QualityMeasuresPage.tsx`, `src/features/prior-auth/components/PriorAuthModule.tsx`, `src/features/allied-health-notes/components/AlliedHealthNotesTab.tsx`, `src/pages/patient/{Invoices,Consents,Radiology}.tsx`, `src/pages/inpatient/{CarePlanPage,CodeEventPage,OrderDashboardPage}.tsx`, `src/pages/billing/{DenialWorklistPage,CDIWorklistPage}.tsx`, `src/pages/staff-scheduling/StaffSchedulingPage.tsx`, `src/pages/quality/InfectionDashboardPage.tsx`, `src/pages/facesheet/InfectionControlTab.tsx`.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit`, vitest, `vite build` | clean, 27/27, built |
| Browser: Denials, CDI worklist, Care plan, Consents, Staff scheduling | real API requests observed (`/api/Denial/*`, `/api/CDI/*`, `/api/CarePlan/*`, `/api/Consent/*`, `/api/inpatient/staff-scheduling/*`), no banner |
| Browser: Quality measures | sample data with the "Demo data — Quality measures" banner |
| grep | no `VITE_*_MOCK !== 'false'` pattern remains except the excluded charge-capture flag |

## How to run a mock-backed demo

Set the specific flag to `true` in `frontend/.env` (see `.env.example`). The affected screens will show the amber banner. Never do this in an environment with real patients.
