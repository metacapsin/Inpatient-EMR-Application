# UI plan: Live Bed Board & active encounters

This document describes how to implement inpatient **Live Bed Board** and **active encounters** views in this app (`src/`), aligned with the EMR-Backend APIs and existing ADT patterns.

## Goals

- **Live Bed Board:** At-a-glance grid (or table) of every bed with ward/room context, bed status, and the current admission + patient when occupied.
- **Active encounters:** A list (or secondary panel) of all `in-progress` admissions for the tenant, sortable and filterable, with paths into chart/ADT workflows.

Both features are **read-heavy** operational dashboards; ADT actions (admit / transfer / discharge) can reuse the existing **ADT workspace** (`/app/adt`) and facesheet ADT tab.

---

## Backend APIs (reference)

| Feature | Method & path | Query params |
|--------|----------------|--------------|
| Live Bed Board | `GET /Beds/getLiveBedBoard` | `roomId`, `wardId`, `bedStatus` (optional) |
| Active encounters | `GET /api/admissions/active` | `patientId`, `bedId` (optional) |

**Live Bed Board success shape** (`data`):

- `rows[]`: `{ bed, room, ward, encounter, patient }` (each nullable except `bed`).
- `summary`: `{ totalBeds, byStatus, withActiveEncounter, occupiedWithoutEncounter }`.

**Active encounters success shape** (`data`): array of encounter documents plus `id` string; `status === 'in-progress'`, newest `admissionTimestamp` first.

**Auth:** Bed board uses the same session as other `/Beds/*` routes. Active encounters require **PATIENT_RW**-class permissions (same policy family as `POST /api/admissions`). Handle `401` / `403` with the same messaging patterns as `adt.service.ts` (`formatAdtUserMessage` or a shared helper).

---

## Suggested placement under `src/`

```
src/
├── types/
                ├── adt.ts                    # extend: ActiveEncounterListItem, ListActiveEncountersResponse
                └── liveBedBoard.ts           # NEW: LiveBedBoardRow, LiveBedBoardSummary, LiveBedBoardPayload
├── services/
                ├── liveBedBoard.service.ts   # NEW: fetchLiveBedBoard(params?)
                └── adt.service.ts            # extend: listActiveEncounters(params?) — GET, not adtPost
├── pages/
                └── bed-board/
                        └── LiveBedBoardPage.tsx    # NEW: route shell + layout
├── modules/
                └── bed-board/                # NEW (optional): keep page thin
                        ├── LiveBedBoardSummaryBar.tsx
                        ├── LiveBedBoardFilters.tsx
                        ├── LiveBedBoardGrid.tsx   # or LiveBedBoardTable.tsx
                        └── ActiveEncountersPanel.tsx
├── router/
                └── routes.tsx                # add /app/bed-board (and optional /app/admissions/active)
```

Use **lazy** imports in `routes.tsx` like other pages.

---

## Types (`src/types/liveBedBoard.ts`)

Define interfaces that mirror the API (snake_case on wire is already camelCase in backend JSON). Include:

- `LiveBedBoardSummary`
- `LiveBedBoardRow` (`bed`, `room`, `ward`, `encounter`, `patient`)
- Narrow `patient` to fields the UI displays (PHI awareness: treat like other patient lists).

Extend `src/types/adt.ts` with a **`ActiveEncounterRow`** type: base encounter fields your UI needs + required `id: string`.

---

## Services

### `src/services/liveBedBoard.service.ts`

- Call `api.get('/Beds/getLiveBedBoard', { params })`.
- Parse envelope: `{ status: 'success', data: { rows, summary } }`.
- **Do not** use `unwrapList` alone on the top-level response; `data` is an object with `rows` and `summary`. Either:
  - read `asRecord(data).data` then validate `rows` / `summary`, or
  - add a small helper in `lib/apiPayload.ts` (e.g. `unwrapObjectPayload`) if you reuse this pattern elsewhere.
- On `status === 'error'`, throw with backend `message` (same pattern as `emrBeds.service.ts` + `getApiErrorMessage`).

### `src/services/adt.service.ts` (or `encounters.service.ts`)

- Add **`listActiveEncounters`**: `api.get('/api/admissions/active', { params })`.
- Normalize to `AdtPostResult`-style **or** a dedicated `{ ok, data, message }` for GET — keep consistent with how other GET ADT-adjacent calls are handled in this codebase.
- Optional query: `patientId`, `bedId` for drill-down from the bed board row.

---

## Routing & navigation

1. **New route:** e.g. `path: '/app/bed-board'`, `element: guard(<LiveBedBoardPage />)`, `layout: 'default'`.
2. **Navigation:** Add a sidebar / menu entry next to **ADT workspace** (`/app/adt`) — wherever inpatient links are defined (layout/shell component). Label ideas: **“Bed board”** or **“Census / beds”**.
3. **Deep links:**
   - From a row with `patient.id` → `/app/facesheet/:id/adt` or `/app/facesheet/:id/...` as appropriate.
   - From a row with `encounter.id` → store encounter id in Redux (`adtEncounterSlice`) only if you already persist per-patient ADT state; otherwise pass `patientId` via URL and let ADT module load encounter from server later if you add that API.

---

## Page layout (`LiveBedBoardPage.tsx`)

Recommended single page with two regions (desktop: summary + filters on top; main grid; optional right drawer for “Active encounters”):

1. **Header** — title, short description, **Refresh** control.
2. **Summary bar** — use `summary.byStatus`, `summary.withActiveEncounter`, `summary.occupiedWithoutEncounter` (flag unexpected **occupied** beds with no encounter).
3. **Filters** — ward dropdown (reuse ward list API if already in `FacilitySettingsPage` / rooms service), optional room, optional bed status chips (`available` | `occupied` | `hold` | `maintenance`). Sync with query params via `useSearchParams` if you want shareable URLs.
4. **Main grid/table**
   - Columns (example): Ward, Room, Bed label, Status, Patient name, MRN/display id, Admission time, Encounter id (abbrev), Actions (“Open chart”, “ADT”).
   - **Row visual:** color/badge by `bed.bedStatus` — align with `bedStatusIndicatorClass` in `lib/adtBedPicker.ts` if possible.
5. **Active encounters** — either:
   - **Tab B** on the same page (“Board” | “Encounters”), or
   - a **collapsible panel** fed by `GET /api/admissions/active`, or
   - a separate route `/app/admissions/active` that reuses the same table.

Pick one pattern to avoid duplicating data-fetch; if the board already shows admitted patients, the encounters list is still valuable as a **patient-centric** sorted list independent of bed layout.

---

## Data loading (TanStack Query)

Match `AdtModulePage` (`useQuery` / `useMutation`):

| Query key | API | Refetch |
|-----------|-----|---------|
| `['liveBedBoard', filters]` | `GET /Beds/getLiveBedBoard` | Manual refresh + optional interval (e.g. 30–60s) when the tab is visible (`refetchInterval`, `document.visibilityState`) |
| `['activeEncounters', optionalFilters]` | `GET /api/admissions/active` | Same; invalidate after successful `adtApi.admit` / `transfer` / `dischargeConfirm` if those mutations run from this app |

After ADT mutations elsewhere, `queryClient.invalidateQueries({ queryKey: ['liveBedBoard'] })` from a central place (or duplicate invalidations in `AdtModulePage` once bed board exists).

---

## Components (behaviors)

- **LiveBedBoardSummaryBar** — renders `summary`; shows a warning when `occupiedWithoutEncounter > 0`.
- **LiveBedBoardFilters** — controlled props or URL-synced; ward options from existing `GET /Wards/...` if available in `src/services`.
- **LiveBedBoardGrid** — responsive: cards on small screens, table on `md+`. Ensure keyboard focus order and aria labels on status badges.
- **ActiveEncountersPanel** — table: Patient (resolve from `GET /Patient/getPatientByID` only if list API does not embed patient — active API returns encounter only; you may need to batch patient fetches or extend backend later). For v1, if `listActiveEncounters` rows lack names, show `patientId` truncated and link to chart.
- **Empty / error states** — empty board vs “no beds configured”; permission denied vs network error.

---

## PHI & audit

- Responses include patient names and DOB: treat like other authenticated clinical views (no extra logging on client).
- Follow existing `phiAuditLog` expectations: no change on the frontend beyond using the same authenticated `api` instance.

---

## Implementation checklist

1. [ ] Add TypeScript types (`liveBedBoard.ts`, extend `adt.ts`).
2. [ ] Implement `liveBedBoard.service.ts` and `listActiveEncounters` GET helper.
3. [ ] Add `LiveBedBoardPage` and route; add nav link.
4. [ ] Build summary + filters + grid; wire React Query + optional polling.
5. [ ] Add active encounters tab/panel; link rows to facesheet/ADT.
6. [ ] Invalidate/refetch bed board after ADT operations from `AdtModulePage` (shared `queryClient`).
7. [ ] UX polish: loading skeletons, last-updated timestamp, manual refresh button.

---

## Out of scope (later)

- WebSocket push for real-time census (polling is enough for v1).
- Server-side pagination (board is typically one facility’s inventory; if row count grows huge, add `wardId` default filter).
- Editing bed status from the board (would use existing `PUT /Beds/updateBedById`).

---

## Related existing files

- `src/modules/facesheet/adt/AdtModulePage.tsx` — ADT UX and bed picker patterns.
- `src/services/emrBeds.service.ts` — `GET /Beds/getBedList` normalization.
- `src/services/adt.service.ts` — ADT POSTs and error formatting.
- `src/lib/apiPayload.ts` — response parsing helpers.
- `src/router/routes.tsx` — route registration.
