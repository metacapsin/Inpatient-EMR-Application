# AI Assistant Module: Completed Work

Date: 2026-11-12. Phase 0 bundle, first module. Approved scope implemented; one external blocker remains (see "Action required").

## Summary for stakeholders

All AI calls now run on the server. The browser no longer holds an AI key or sends patient data to Google directly. Every AI request is role-gated, rate-limited per user, logged for audit without storing prompt text, and uses a minimised patient context (clinical facts only, no name, MRN, date of birth or contact details). The medication explanation sidebar and the chart assistant chat both work through the new backend endpoints.

## Action required before AI works

The Gemini key that was embedded in the frontend has been **revoked by Google** ("Your API key was reported as leaked"). It was moved into `backend/.env` as requested, but every call now returns `AI_PROVIDER_ERROR`. To enable AI:

1. Create a new key in Google AI Studio (or a Vertex AI service account if a BAA-covered endpoint is required for PHI; see the compliance note below).
2. Put it in `backend/.env` as `GEMINI_API_KEY=` and restart the backend. Optionally set `GEMINI_MODEL` (default `gemini-2.0-flash`).
3. Confirm `GET /api/ai/status` returns `enabled: true` and that a medication explanation succeeds.

Compliance note: Google's consumer Gemini API is not covered by a Business Associate Agreement. The new endpoints send de-identified clinical facts, but a privacy/legal reviewer should confirm this is acceptable or direct the team to a BAA-covered provider (Vertex AI, Azure OpenAI, Bedrock). The provider is isolated in one file (`backend/src/lib/gemini.js`) so switching is a contained change.

Git history still contains the old key in commit `07fb8ab`. It is revoked, so it is no longer usable, but a history rewrite remains a separate decision.

## What changed

| # | Item | Issue IDs | Result |
|---|---|---|---|
| 1 | Browser-side Gemini client removed | SEC-01 | `services/geminiApi.ts` deleted; `@google/generative-ai` removed from `package.json`; no `AIza…` literal anywhere in `frontend/` or `backend/src` |
| 2 | Server-side provider | SEC-01 | `backend/src/lib/gemini.js`: REST `generateContent`, key from env, 20s timeout, JSON mode, provider errors mapped to `AI_PROVIDER_ERROR` / `AI_TIMEOUT` / `AI_UNREACHABLE` / `AI_EMPTY` / `AI_BAD_JSON`, never forwards raw provider payloads; disabled under test |
| 3 | New endpoints | — | `GET /api/ai/status`, `POST /api/ai/medication-explanation`, `POST /api/ai/chatbot` in `backend/src/routes/ai.js` |
| 4 | Access control | SEC-01, SEC-04 | Clinical roles only (physician, nurse, pharmacist; admin bypass as elsewhere); 30 requests/min/user in production; tenant module `ai` toggle enforced by `moduleGate.js` |
| 5 | Audit | SEC-02 (partial) | `ai_requests` table (migration 022): tenant, user, patient, endpoint, model, prompt SHA-256, status, error code, latency, token counts. No prompt or response text |
| 6 | PHI minimisation | — | Medication prompt contains only drug facts. Chat context is built server-side: sex and age, current encounter type/diagnosis/status, problems, allergies, active meds, latest vitals, last 30 labs. Name, MRN, DOB, address, phones, insurance are never included (asserted by test) |
| 7 | Frontend | — | `services/ai.service.ts`; Medications sidebar calls the backend and shows a disclaimer; `AIAssistantPage` is now a staff chart assistant driven by `?patientId=` (header sparkle button carries the open chart's patient), shows status/disclaimer, and handles disabled/unavailable states; chat input sends on Enter; quick questions reworded for clinicians |
| 8 | Dead surfaces removed | BUG-04 | `aiHealthInsightsAPI` and `aiChatbotAPI` client blocks, `LabAIHighlightsSidebar.tsx`, `NextVisitPrepCard.tsx`, unused `AIChatAssistant.tsx`; Preventive Screening's "Get AI Suggestions" no longer calls a dead endpoint |
| 9 | Tenant module | — | `ai` added to the default module list and to all existing tenants by migration; Super Admin pickers include it |

## Files

Backend new: `src/lib/gemini.js`, `src/routes/ai.js`, `src/db/migrations/022_ai_requests.sql`, `tests/ai.test.js`. Backend changed: `src/app.js`, `src/config.js`, `src/middleware/moduleGate.js`, `src/routes/platformAdmin.js`, `.env`, `.env.example`.

Frontend new: `src/services/ai.service.ts`. Changed: `pages/AIAssistantPage.tsx`, `pages/patient/Medications.tsx`, `pages/patient/PreventiveScreening.tsx`, `components/MedicationAIExplanationSidebar.tsx`, `components/AIChatAssistant/{ChatInput,QuickQuestions,index}.tsx`, `components/Layouts/Header.tsx`, `hooks/useTenantModules.ts`, `pages/platform/{TenantDirectoryPage,TenantProvisioningPage}.tsx`, `services/api.ts`, `package.json`, `package-lock.json`. Deleted: `services/geminiApi.ts`, `components/LabAIHighlightsSidebar.tsx`, `components/NextVisitPrepCard.tsx`, `components/AIChatAssistant/AIChatAssistant.tsx`.

## Verification

| Check | Result |
|---|---|
| `backend tests/ai.test.js` | pass: disabled→503 `AI_DISABLED`; billing role→403; validation→400; stubbed provider happy paths for both endpoints; chat prompt contains allergy and medication facts but not name/email/MRN; audit rows `[error AI_DISABLED, ok, ok]`; cross-tenant patient→404; module disabled→403 |
| Full backend suite | 47/48 (only the pre-existing allergy-shape failure, BUG-01) |
| `tsc --noEmit`, `vitest` | clean, 27/27 |
| `vite build` | succeeded |
| Live (revoked key) | `GET /api/ai/status` → `enabled: true`; both POST endpoints → `502 AI_PROVIDER_ERROR`; backend log shows Google's "reported as leaked" message; `ai_requests` rows written with `error_code = AI_PROVIDER_ERROR`; chat page shows the error inline |

## Deferred

- Key rotation and git-history purge (your action; see above).
- BAA-covered provider decision.
- Consent capture per patient for AI processing, if the privacy review requires it.
- Reading the `ai_requests` log in the Settings UI (belongs to the audit-log module).
