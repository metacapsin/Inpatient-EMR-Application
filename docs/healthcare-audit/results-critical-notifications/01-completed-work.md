# Results / Critical Notifications: Completed Work

Date: 2026-11-13. Phase 1, module 6. Approved scope implemented with the agreed defaults (30-minute escalation window, final+acknowledged portal release hold, day/evening/night shift boundaries at 07:00/15:00/23:00); no external blocker.

## Summary for stakeholders

A critical lab value used to page every physician and nurse in the hospital with that patient's name and MRN, no matter which ward they worked on — alarm fatigue by design. It now goes to the clinician who ordered the test, the encounter's attending physician, and whichever nurse is assigned to the patient's bed this shift; if none of those can be identified (an unstaffed ward, missing attending), it still falls back to the old broadcast rather than risk notifying no one. Acknowledging a critical result now requires reading the value back — the system checks it against what's on file and rejects a mismatch, so "acknowledged" means someone actually confirmed the right number, not just clicked a button. If nothing acknowledges it within 30 minutes, the ward's charge nurse gets escalated to automatically. A critical imaging finding used to only leave a free-text note saying who was told — it now creates a real in-app alert the same way a critical lab does. Correcting an already-acknowledged critical result to a *different* critical value no longer keeps the stale "acknowledged" status — it's treated as a new critical finding requiring its own acknowledgement. A radiology order that's finalized or cancelled now properly closes out on the CPOE order dashboard instead of sitting there forever. The patient portal now holds back preliminary and not-yet-acknowledged-critical lab results until they're final and safe to release. And the "Unacknowledged critical results" dashboard tile's patient link, which pointed at a page that didn't exist, now goes to the right place.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Critical lab notification routing | SAF-06 | `notifyCritical()` targets the ordering clinician (`lab_orders.created_by`), the encounter's attending physician, and the nurse assigned to the patient's bed for today's shift (`lib/criticalNotify.js`, new). Falls back to the previous tenant-wide physician/nurse broadcast only when nothing resolves |
| 2 | Read-back on acknowledge | SAF-06 | `POST /lab-results/:rid/acknowledge` requires `readBackValue`, checked against the stored value; a mismatch is rejected (400). Frontend: new `ReadBackAcknowledgeDialog` wired into both the dashboard critical-results strip and the lab-order results panel — the Acknowledge button is disabled until something is typed, and the server does the actual verification |
| 3 | Escalation job | SAF-06 | New `critical-result-escalation` pg-boss job (every 5 min, same pattern as `bed-reservation-expiry`): unacknowledged criticals past 30 minutes (`CRITICAL_RESULT_ESCALATION_MINUTES`, configurable) notify the ward's charge nurse, marked via a new `escalated_at` column so it only fires once per result |
| 4 | Imaging criticals create real notifications | SAF-06 | `PUT /api/Radiology/order/:orderId/critical` now inserts an actual `notifications` row (same routing as #1) in addition to keeping the existing free-text `criticalValueNotifiedTo` field |
| 5 | Stale-ack bug fixed | SAF-06 | A correction that keeps a result critical but changes the *value* now clears the acknowledgement and fires a fresh notification — previously only a newly-critical result cleared the ack, so a correction from one critical value to another kept showing "acknowledged" for a value nobody had actually seen |
| 6 | Radiology CPOE ledger closure | SAF-19 | `result` (Final/Amended) and `cancel` now update the linked `orders` row to `completed`/`cancelled` — previously never touched, so a resulted or cancelled radiology order stayed "active" on the order dashboard indefinitely |
| 7 | Portal release hold | SAF-11 | Both the FHIR single-resource read and the search/bundle path for lab Observations now withhold a result until `status <> 'preliminary'` and, if it was ever critical, until acknowledged |
| 8 | BUG-08 link fix | BUG-08 | `IpdCriticalResultsStrip.tsx`'s patient link now points at `/app/facesheet/:id/lab-orders` (the actual registered nested route) instead of a dead `/app/patients/:id/lab-orders` |
| 9 | Tests | — | New `backend/tests/criticalResults.test.js` (8 tests): targeted routing vs. an uninvolved physician getting nothing, broadcast fallback when nothing resolves, read-back mismatch/match, stale-ack-to-fresh-ack on a value change, imaging critical creating a real notification, radiology result/cancel closing the ledger, escalation firing once (not twice) and reaching the charge nurse, and the full portal release-hold lifecycle (held → released on ack+final) through an actual SMART PKCE flow. Full backend suite: **106/106** |

## Files

Backend new: `src/lib/criticalNotify.js`, `src/jobs/criticalResultEscalation.js`, `src/db/migrations/026_critical_notifications.sql`, `tests/criticalResults.test.js`.
Backend changed: `src/routes/labs.js`, `src/routes/clinicalOps.js`, `src/routes/fhir.js`, `src/db/queue.js`, `src/server.js`, `src/config.js`, `.env.example` (`CRITICAL_RESULT_ESCALATION_MINUTES`), `tests/api.test.js` (acknowledge calls updated for the new read-back requirement).

Frontend new: `src/components/labs/ReadBackAcknowledgeDialog.tsx`. Frontend changed: `src/components/ipd/IpdCriticalResultsStrip.tsx`, `src/components/labs/LabOrderResultsPanel.tsx`, `src/services/labs.service.ts`.

## Verification

Full backend suite **106/106** (`npm test`), backend `tsc` clean, frontend `tsc` clean, `vite build` clean. Live-verified against the shared dev server using a real pre-existing unacknowledged critical result: logged in as the physician who wasn't able to see an Acknowledge control as admin (SEC-17 still correctly blocks that), opened the read-back dialog, submitted a wrong value and confirmed the server rejected it (400, verified via the network log), then submitted the correct value and confirmed the result cleared from the dashboard's critical-results tile and count. Also confirmed the dashboard's critical-result patient link now resolves to the facesheet lab-orders tab rather than a dead route.
