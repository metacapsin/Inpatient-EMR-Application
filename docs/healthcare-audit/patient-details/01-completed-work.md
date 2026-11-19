# Patient Details Module: Completed Work

Date: 2026-11-12. Approved scope from the module change proposal was implemented in full, except items explicitly deferred below. Frontend only; no database or API changes.

## Summary for stakeholders

The patient chart (facesheet) is now safe to demonstrate on any device: the mobile layout bug that hid the top of every tab is fixed, no tab shows another patient's or invented data, the chart header carries allergy and isolation alerts, bed moves go through the real ADT transfer path, and the pop-up dialogs are keyboard and screen-reader accessible. Dead "AI explain" buttons that always failed were removed.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Mobile chart clipping fixed | UI-01 | Drawer now sits fully off-screen when closed (`left: -260px`), header name and content start at the left edge; drawer opens to `left: 0` from the menu button |
| 2 | Dietary tab no longer shows a demo patient | UI-02 / SAF-07 | Dummy data file deleted; tab is an empty state bound to the chart's patient and is hidden unless a preview flag is set |
| 3 | Preview-only tabs hidden by default | UI-04, UI-05 | Dietary, Prior Auth, Invoices and Preventive Screening are removed from navigation and routing unless `VITE_FACESHEET_PREVIEW_TABS=true`; direct URLs redirect to Demographics |
| 4 | Previously hidden real tabs exposed | UI-12 | Vitals, Location, History, Prescriptions and Immunizations now appear in the chart rail and mobile strip (they are backed by real data) |
| 5 | Location tab rewritten | UI-03 / SAF-08 | Reads the current bed from the active admission; "Transfer bed" calls `POST /api/transfers` through the shared ADT workflow (EVS job, HL7 A02, bed board refresh all happen server-side). The client-side bed store that wrote to `localStorage` was deleted. Validation runs on submit only |
| 6 | Allergy and isolation banners in the header | UI-11 | Active allergies (with severity) and active isolation precautions appear under the encounter header; a failed lookup shows "unknown" rather than nothing |
| 7 | Accessible dialogs | UI-07 | Documents preview and notes, Medications view and detail, History detail now have `role="dialog"`, `aria-modal`, labelled titles, Escape to close, focus trap and focus restore. The shared `AppModal` got the same behaviour |
| 8 | Inline error states with Retry | UI-10 | Documents, History, Immunizations, Medications, Prescriptions and Labs show an error panel with a Retry button when loading fails, instead of a toast that disappears |
| 9 | Search inputs labelled | UI-08 | 12 chart search fields now have `aria-label`s |
| 10 | Demographics loading state | UI-09 | No longer forces a full-viewport blank block inside the module card |
| 11 | Dead AI buttons removed | UI-17 | Labs, Lab Orders, Notes and Documents no longer render buttons that called non-existent `/ai/health-insights/*` endpoints |
| 12 | Header fetch failure handling | UI-15 | If the patient record cannot be loaded, chart modules are not rendered; the user gets a Retry button and a link back to the patient list |
| 13 | Header bed-list refetch | UI-16 | Bed list no longer refetches on every window focus |

## Deferred (outside this module or needs another decision)

- Code-status banner: there is no code-status field on the patient yet (belongs to Admission / Registration proposals).
- Medications tab Gemini sidebar (SEC-01): still present; third-party integration work was excluded from this pass. It must be removed or proxied in the AI assistant module.
- Diagnoses vs History inconsistency (UI-06): product decision pending on merging history conditions into the problem list.
- Dashboard "Prior auth expiring" from mock data (BUG-07): dashboard module.

## Files

Changed (24): `tailwind.css`, `facesheet/facesheetModules.ts`, `pages/facesheet/FacesheetPage.tsx`, `pages/facesheet/DietaryTab.tsx`, `modules/facesheet/location/PatientLocationPage.tsx`, `services/rooms.service.ts`, `features/nursing-flowsheet/components/NursingFlowsheetWorksurface.tsx`, `components/facesheet/EncounterHeader.tsx`, `components/shared/AppModal.tsx`, `pages/patient/{Allergies,Demographic,Diagnoses,Documents,History,Immunizations,LabOrders,Labs,Medications,Notes,Prescriptions,VisitorsContacts,Vitals}.tsx`, `.env.example`.

New (4): `components/facesheet/ChartSafetyBanners.tsx`, `components/facesheet/ModuleErrorState.tsx`, `components/shared/DialogShell.tsx`, `hooks/useDialogA11y.ts`.

Deleted (4): `data/dietaryDummyData.ts`, `services/patientLocation.service.ts`, `components/patient-location/LocationCascadeSelects.tsx`, `modules/facesheet/location/LocationCascadeSelects.tsx`.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | clean |
| `vitest run` | 27/27 |
| `vite build` | see build log in the session report |
| Browser, desktop 1440px | Demographics, Location, Labs, Documents, History, Allergies render; allergy banner shows "Penicillin (Moderate) · Latex (Mild)" for the seeded patient |
| Browser, mobile 375px | Drawer computed `left: -260px` closed and `0px` open; `h1` left edge at 16px; no horizontal scroll |
| Dialog a11y | Documents preview: `role=dialog`, `aria-modal=true`, labelled by its title, focus inside on open, Escape closes, focus returns to the Preview button |
| Route gating | `/dietary` redirects to `/demographic` with the flag unset |

## How to enable the preview tabs for a demo

Add `VITE_FACESHEET_PREVIEW_TABS=true` to `frontend/.env` and restart Vite. They remain clearly empty-state or mock pages; do not use them in front of clinical users.
