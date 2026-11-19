# Discharge Workspace Module: Completed Work

Date: 2026-11-12. Issue IDs closed: SAF-10. Also closes the Dashboard item BUG-07 (documented below).

## Summary for stakeholders

The discharge readiness page no longer invents financial data or blocks discharge on rules the server does not have. Before: the browser seeded $12,260 of sample charges into every encounter, let a user "submit a claim" that produced a random payer claim number, and refused to finalize discharge until mock charges, a mock prior authorization and a 24-hour eligibility rule were satisfied, while hiding the server's real medication-reconciliation gate. Now: the only gates shown and enforced are the server's four (signed discharge summary, completed discharge medication reconciliation, blocking nursing checklist tasks, encounter status), the Charges and Billing tabs state honestly that those capabilities are not built yet, and finalize follows the server's encounter status.

## What changed

| Area | Before | After |
|---|---|---|
| `services/dischargeReadiness.service.ts` | In-memory charge/claim store, `CHARGE_CAPTURE_MOCK` flag, fake `submitClaimPrep`, five dead endpoints | Readiness, summary save/sign, checklist, eligibility only. Parses the server's `gates[]`, `sections.*.available`, `encounterStatus`. `charges`/`claimPrep` are `null` when the server says unavailable |
| `utils/dischargeReadinessValidation.ts` | Eleven client gates incl. charges, claim routing, UB-04 context, principal dx, eligibility 24h, prior auth (mock store) | Three client gates kept only as form preconditions for signing (summary fields, summary signed, nursing checklist). New `serverGateBlockingMessages()`. Prior-auth mock import removed; claim-submit validators removed |
| `hooks/useDischargeFinalizeFlow.ts` | Blocked on client gates; decided initiate from Redux | `canFinalize` = server `blocked === false`; initiate only when `encounterStatus !== 'discharge_initiated'`; surfaces the server's `DISCHARGE_BLOCKED` gate list on failure |
| Blocking alert | Mixed client gates | Server gates in red ("the server will refuse discharge until…"); care-plan and consent checks shown in amber as advisory |
| Header / command strip / tab strip | "Bill / claim: Not ready", progress over three client flags, Charges/Billing marked pending | "Bill / claim: Not available"; progress = resolved server gates; Charges/Billing marked "Not available in this version"; Insurance marked informational |
| `ChargeCaptureTab`, `BillingTab` | 627 lines of mock charge grid and claim form | Small "not available" panels using the server's `sections.*.reason` |
| Context | Carried a claim-prep draft | Summary draft only |
| `.env.example`, nav | `VITE_CHARGE_CAPTURE_MOCK` documented; nav said "charges, claim prep" | Flag removed; nav copy corrected |

Dashboard (BUG-07): `IpdPriorAuthExpiringStrip` deleted and removed from `pages/Dashboard.tsx`; the dashboard no longer shows "Prior auth expiring" from the prior-auth mock store.

## Files

Changed: `src/services/dischargeReadiness.service.ts`, `src/utils/dischargeReadinessValidation.ts`, `src/utils/dischargeReadinessUi.ts`, `src/hooks/useDischargeFinalizeFlow.ts`, `src/contexts/DischargeReadinessContext.tsx`, `src/types/dischargeReadiness.ts`, `src/pages/inpatient/DischargeReadinessPage.tsx`, `src/components/ipd/discharge/{BillingTab,ChargeCaptureTab,DischargeReadinessBlockingAlert,DischargeReadinessCommandStrip,DischargeReadinessHeader,DischargeReadinessTabStrip}.tsx`, `src/components/Layouts/mainNavConfig.ts`, `src/pages/Dashboard.tsx`, `.env.example`. Deleted: `src/components/ipd/IpdPriorAuthExpiringStrip.tsx`.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit`, vitest, `vite build` | clean, 27/27, built |
| Browser: readiness page for the seeded admitted encounter | `GET /api/encounters/:id/discharge-readiness` and `GET /api/discharges/readiness/:id` are the only readiness calls; "Discharge ready", progress 100% (all four server gates resolved), Charges tab shows "Charges are not available", header shows "Bill / claim: Not available", advisory care-plan/consent lines in amber |
| Browser: dashboard | no "Prior auth" element present |
| grep | no `CHARGE_CAPTURE_MOCK`, `submitClaimPrep`, `priorAuthMockStore` reference remains in the discharge or dashboard code |

## Still open (other modules)

- The server does not gate discharge on consent completeness or care-plan status; the page shows them as advisory. Making them real gates is an ADT/Discharge decision (see `next-module-plan.md`, item 7).
- A physician-only discharge order, AMA and deceased workflows remain unbuilt (SAF-12, Discharge module).
