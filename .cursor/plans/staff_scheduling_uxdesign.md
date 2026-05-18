# MD Care Inpatient EMR — Staff Scheduling & Workforce Management
## Enterprise UI/UX Design Document · Workflow Architecture · Screen Layouts

**Version:** 1.0  
**Date:** May 2026  
**Module:** OPERATIONS › Staff Scheduling & Workforce Management  
**Benchmarked Against:** Epic Capacity Management · Cerner Clairvia · Kronos Healthcare Scheduler · Oracle Health Workforce Management  
**Design Standards:** HIPAA §164.312 · Joint Commission Staffing Standards · CMS Conditions of Participation (CoP) §482.23 Nursing Services

---

## 1. Design Philosophy & UX Principles

### 1.1 Workforce-Specific UX Principles

| # | Principle | Rationale | Application |
|---|-----------|-----------|-------------|
| 1 | **Staffing visibility over scheduling complexity** | Charge nurses make real-time decisions every 15 minutes. The current staffing picture must be visible in < 2 seconds | KPI strip always pinned at top — never scrolled away. Color-coded by threshold severity |
| 2 | **Calendar is the primary affordance** | Schedulers think in calendar time, not rows/columns. Calendar-first with table as secondary drill-down | FullCalendar Scheduler as default view; table view toggle is explicit and persistent per user preference |
| 3 | **Conflict prevention over conflict resolution** | Double bookings and understaffed shifts cost lives. Block at entry, not retrospectively | Real-time conflict checks inline during assignment; hard-stop modal prevents save on true conflict |
| 4 | **Role-scoped views** | A staff nurse seeing other nurses' home addresses or HR notes is a HIPAA violation | Role gates enforced at route, component, and field level. Not just hidden — removed from DOM |
| 5 | **Audit-immutable trail** | CMS CoP §482.23 requires documented evidence of adequate nurse-to-patient ratios | Every schedule change, approval, override logged with UTC timestamp, user ID, reason code |
| 6 | **Emergency escalation always reachable** | Coverage emergencies cannot wait for a 3-step workflow | Persistent "Emergency Coverage" floating action in lower-right; opens in < 1 click |

### 1.2 Alert Severity System (Scheduling-Specific)

| Level | Color Token | Trigger | UX Behavior |
|-------|-------------|---------|-------------|
| **CRITICAL** | `#DC2626` / `danger-600` | ICU nurse:patient ratio > 1:3 · 0 staff assigned to active unit | Pulsing red banner top of page · Blocks publish action · Requires supervisor override with reason |
| **SHORTAGE** | `#EA580C` / `warning-600` | Unit staffed below minimum · Shift has open slots 2h before start | Amber banner · Non-blocking · Auto-escalates to supervisor in 30 min if unresolved |
| **ADVISORY** | `#CA8A04` / `caution-500` | Overtime threshold approaching (>36h) · Skill mismatch · Expiring certification | Inline yellow badge on staff row · Tooltip with detail |
| **INFO** | `#2563EB` / `info-600` | Pending leave request awaiting approval · Schedule published · Shift swap requested | Bell notification · Non-interrupting info banner |
| **OK** | `#16A34A` / `success-600` | Fully staffed · Ratios met · No conflicts | Green ratio badges · No banner |

---

## 2. Information Architecture

### 2.1 Sidebar Navigation — OPERATIONS Section

```
OPERATIONS
│
├── 📅  Staff Scheduling          /app/scheduling
│    ├── Schedule Dashboard       /app/scheduling/dashboard
│    ├── Shift Management         /app/scheduling/shifts
│    ├── Staff Assignment         /app/scheduling/assignment
│    ├── Leave Management         /app/scheduling/leave
│    ├── Attendance Tracking      /app/scheduling/attendance
│    ├── Department Roster        /app/scheduling/roster
│    └── Coverage & Replacement   /app/scheduling/coverage
│
├── 🛏️  Patient Flow Board
├── 🔄  Transfer Center
└── 📋  Case Management & UR
```

### 2.2 Module-Level Navigation (Sub-tabs within Staff Scheduling)

The OPERATIONS › Staff Scheduling header persists across all sub-pages. Sub-navigation is rendered as a horizontal pill tab strip directly below the module header, sticky on scroll.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  OPERATIONS › Staff Scheduling & Workforce Management                 [Role: Admin]  │
│  MD Care Regional Medical Center · Unit: All Departments · Week: May 12–18, 2026    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  [Dashboard] [Shift Mgmt] [Assignment] [Leave] [Attendance] [Roster] [Coverage]     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Tokens & Visual System

### 3.1 Shift Color Coding (ClinicalShift Palette)

| Shift Type | Background | Text | Border | Usage |
|------------|-----------|------|--------|-------|
| Morning (06:00–14:00) | `#DBEAFE` | `#1E40AF` | `#BFDBFE` | Blue family |
| Evening (14:00–22:00) | `#FEF9C3` | `#854D0E` | `#FDE68A` | Amber family |
| Night (22:00–06:00) | `#EDE9FE` | `#5B21B6` | `#DDD6FE` | Violet family |
| Rotational | `#DCFCE7` | `#166534` | `#BBF7D0` | Green family |
| On-Call | `#FCE7F3` | `#9D174D` | `#FBCFE8` | Pink family |
| ICU Speciality | `#FEE2E2` | `#991B1B` | `#FECACA` | Red family (criticality signal) |

### 3.2 Staff Status Badges

| Status | Pill Style | Icon |
|--------|-----------|------|
| On Duty | `bg-green-100 text-green-800 ring-1 ring-green-300` | ● (filled dot) |
| On Break | `bg-yellow-100 text-yellow-800` | ◐ (half dot) |
| Off Duty | `bg-gray-100 text-gray-600` | ○ (hollow dot) |
| On Leave | `bg-orange-100 text-orange-800` | 🏖 |
| Absent | `bg-red-100 text-red-800 ring-1 ring-red-300` | ✕ |
| On Call | `bg-purple-100 text-purple-800` | 📞 |
| Overtime | `bg-amber-100 text-amber-900 font-bold` | ⚠ OT |

### 3.3 Certification / Skill Badges (Inline)

```
[ICU-CERT]  [ACLS]  [BLS]  [PICU]  [CHARGE]  [PRECEPTOR]  [TRAVELER]
```
- Rendered as `xs` monospace pill — max 2 visible per row, overflow as `+3 more` tooltip
- ICU-CERT in red — required field for ICU assignment validation

### 3.4 Typography Scale (Clinical Dense)

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Module Header | `16px` | `700` | Page title |
| Section Label | `11px` | `700` | Uppercase, letter-spaced 0.08em |
| Table Header | `11px` | `600` | Uppercase |
| Table Cell Primary | `12px` | `500` | Staff name, shift name |
| Table Cell Secondary | `11px` | `400` | Room, time, metadata |
| KPI Number | `24px` | `700` | Tabular-nums |
| KPI Label | `11px` | `500` | Uppercase |
| Alert Text | `12px` | `500` | Banner messages |

### 3.5 Spacing System (Dense Clinical)

- **Base unit:** 4px  
- **Component internal padding:** `p-2` (8px) for compact rows, `p-3` (12px) for cards  
- **Section gaps:** `gap-3` (12px) between KPI cards, `gap-4` (16px) between major sections  
- **Table row height:** 36px standard, 28px ultra-compact view toggle  
- **Sidebar filter width:** 240px fixed, collapsible to 0 (toggle)  

---

## 4. Screen 1 — Schedule Dashboard

### 4.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STICKY TOP ALERT BANNER (conditional — only when critical/shortage alerts active)             │
│ 🔴 CRITICAL: ICU-A is 1:4 nurse ratio — 2 nurses needed NOW. [Assign Coverage ›]            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ MODULE HEADER BAR                                                                             │
│ Staff Scheduling Dashboard      📅 May 16, 2026 (Friday)     [Refresh ↺] [Publish Schedule] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ SUB-NAV TAB STRIP (sticky)                                                                    │
│ [▶ Dashboard] [Shifts] [Assignment] [Leave] [Attendance] [Roster] [Coverage]                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI WIDGET ROW (6 cards, horizontal scroll on small screens)                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │TOTAL     │ │NURSES    │ │DOCTORS   │ │ICU RATIO │ │PENDING   │ │OPEN      │              │
│ │ON DUTY   │ │ON SHIFT  │ │ON SHIFT  │          │ │LEAVES    │ │SHIFTS    │              │
│ │  247     │ │  184     │ │   63     │ │  1:2.8   │ │   12     │ │    7     │              │
│ │▲ +4 vs   │ │ ● 92%    │ │ ● 100%  │ │ ● SAFE   │ │⚠ 3 URGT │ │🔴 2 CRIT │              │
│ │  yest.   │ │  filled  │ │  filled  │          │ │          │ │          │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
├────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ LEFT: STAFFING TABLE (main)            │ RIGHT: REAL-TIME PANEL (240px fixed)                │
│                                        │                                                      │
│ [FILTER BAR]                           │ ┌─────────────────────────────────────────────────┐ │
│ Dept ▾  Ward ▾  Shift ▾  Status ▾ 🔍  │ │ UNIT STAFFING RATIO MONITOR                     │ │
│                                        │ │─────────────────────────────────────────────────│ │
│ ┌────────────────────────────────────┐ │ │ ICU-A    ████████░░  1:2.8  ● SAFE              │ │
│ │# │ STAFF         │DEPT │SHIFT│WARD│ │ │ ICU-B    █████░░░░░  1:4.1  🔴 CRITICAL          │ │
│ │──┼───────────────┼─────┼─────┼────│ │ │ ER-Main  ████████░░  1:3.2  ● OK                │ │
│ │1 │ Sarah Chen,RN │ ICU │ AM  │4B  │ │ │ OT-Suite ██████░░░░  1:5.0  ⚠ SHORTAGE          │ │
│ │  │ [ICU-CERT][ACLS] ● On Duty    │ │ │ Med/Surg ████████░░  1:4.5  ● OK                │ │
│ │2 │ Mike Torres,RN│ ICU │ AM  │4B  │ │ │ PICU     ████████░░  1:2.1  ● SAFE              │ │
│ │  │ [ICU-CERT]    ● On Duty       │ │ └─────────────────────────────────────────────────┘ │
│ │3 │ James Park,MD │ ER  │ AM  │ER  │ │                                                      │
│ │  │ [TRAUMA] [ACLS] ● On Duty    │ │ ┌─────────────────────────────────────────────────┐ │
│ │4 │ Aisha Patel,RN│ MED │ EVE │5C  │ │ ACTIVE ALERTS (4)                               │ │
│ │  │ [BLS]  ⚠ OT WARNING          │ │ │─────────────────────────────────────────────────│ │
│ │5 │ David Kim,MD  │ OT  │ AM  │OT  │ │ 🔴 ICU-B understaffed — 2h unresolved          │ │
│ │  │ [CHARGE]      ● On Duty       │ │ │ ⚠  Sarah Chen approaching 36h/week             │ │
│ │  │                               │ │ │ ⚠  OT Suite: open shift starts in 1h           │ │
│ │  │ ... 242 more rows ...         │ │ │ 🔵 Dr. Patel leave approved for May 18         │ │
│ └────────────────────────────────────┘ │ └─────────────────────────────────────────────────┘ │
│                                        │                                                      │
│ [← Prev Page]  Page 1 of 13  [Next →] │ ┌─────────────────────────────────────────────────┐ │
│                                        │ │ SHIFT TIMELINE — TODAY                          │ │
│                                        │ │ 06:00──────AM──────14:00──────EVE──────22:00───│ │
│                                        │ │ Night ends ──▶  │  Morning ──▶  │  Evening ──▶ │ │
│                                        │ │ Current time: 14:22 ▲                           │ │
│                                        │ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### 4.2 KPI Card Anatomy

Each KPI card contains these fixed regions (top to bottom):

```
┌──────────────────────────┐
│ SECTION LABEL    [icon]  │  ← 11px uppercase, icon right-aligned
│ PRIMARY NUMBER           │  ← 28px bold, tabular-nums
│ TREND LINE               │  ← Sparkline (7-day), 24px tall
│ STATUS PILL + SUBTEXT    │  ← Status badge + contextual label
└──────────────────────────┘
```

**KPI Card Definitions:**

| Card | Primary | Trend | Status Logic | Alert Threshold |
|------|---------|-------|--------------|-----------------|
| Total On Duty | Count of staff with status=ON_DUTY | 7-day daily count sparkline | Neutral | None |
| Nurses On Shift | Count RN+LPN+CNA on active shift | vs. scheduled count | Green if ≥95% filled | < 85% = amber |
| Doctors On Shift | Count MD+DO+NP+PA on active shift | vs. scheduled | Green if 100% | < 90% = amber |
| ICU Ratio | Calculated: ICU patients ÷ ICU nurses | 24h rolling hourly ratio | ≤1:2 = safe / 1:3 = ok / >1:3 = critical | >1:3 = RED badge |
| Pending Leaves | Count of leave.status = PENDING | 7-day cumulative | Amber if >5 pending >24h | >10 = escalate |
| Open Shifts | Count shifts with no assignment | Count by urgency | Red = starts in <2h | Any = amber |

### 4.3 Staff Table — Column Specification

| Column | Width | Content | Sortable | Filterable |
|--------|-------|---------|----------|------------|
| # | 40px | Row index | No | No |
| Staff | 220px | Name · Credential · Cert badges · Status dot | Yes (name) | Search |
| Employee ID | 90px | EMP-XXXXX monospace | No | Yes |
| Department | 100px | Color-coded dept pill | Yes | Dropdown |
| Shift | 110px | Shift pill (color-coded) + time range | Yes | Dropdown |
| Ward / Room | 80px | Ward code | Yes | Dropdown |
| Role | 100px | RN / MD / CNA / PA etc. | Yes | Dropdown |
| Check-in | 80px | HH:MM or — | Yes | None |
| Overtime | 70px | Hrs this week — amber if >36 | Yes | None |
| Status | 110px | Status badge | Yes | Dropdown |
| Actions | 80px | [Reassign] [Leave] [•••] | No | No |

### 4.4 Sticky Filter Bar Specification

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search staff name or ID...  │ Dept ▾ │ Ward ▾ │ Shift ▾ │ Status ▾ │ [Clear]  │
│                                                    Active filters: Dept: ICU [✕]   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Entire filter bar `position: sticky; top: [module-header-height]px`
- Active filter chips render below the filter bar (not inside it) — no layout shift
- Clear all chips = single "Clear" button far right
- Filter state serialized to URL query params for shareable links

---

## 5. Screen 2 — Shift Management

### 5.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ MODULE HEADER                                                                                  │
│ Shift Management                 Week: May 12–18, 2026 ◀ ▶    [Week ▾]  [+ New Shift]       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ STICKY SUB-NAV + SHIFT TYPE FILTER                                                            │
│ [All Shifts] [Morning] [Evening] [Night] [Rotational] [On-Call]    Dept ▾  Ward ▾  [Publish] │
├───────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ LEFT: FULLCALENDAR SCHEDULER VIEW (70%)       │ RIGHT: SHIFT DETAILS PANEL (30%)             │
│                                               │                                               │
│  ┌─────────────────────────────────────────┐  │ ┌───────────────────────────────────────────┐│
│  │           WEEK VIEW — MAY 12–18         │  │ │ SELECTED SHIFT DETAILS                    ││
│  │  MON 12  TUE 13  WED 14  THU 15  FRI 16│  │ │ ICU Morning Shift                         ││
│  ├──────────────────────────────────────────│  │ │ ─────────────────────────────────────── ││
│  │06:00│ICU AM│ICU AM│ICU AM│ICU AM│ICU AM │  │ │ Time:       06:00 — 14:00 (8h)           ││
│  │     │██████│██████│██████│██████│██████ │  │ │ Break:      30 min unpaid                ││
│  │08:00│ER AM │ER AM │ER AM │ER AM │ER AM  │  │ │ Dept:       ICU                           ││
│  │     │██████│██████│██████│██████│██████ │  │ │ Ward:       4B                            ││
│  │10:00│      │      │      │      │       │  │ │ Capacity:   8 nurses                      ││
│  │12:00│      │      │      │      │       │  │ │ Assigned:   7/8  ⚠ 1 open                ││
│  │14:00│ICU EV│ICU EV│ICU EV│ICU EV│ICU EV│  │ │ Color:      ████ Blue (Morning)           ││
│  │     │██████│██████│██████│██████│██████ │  │ │ Recurring:  Mon–Fri weekly                ││
│  │16:00│      │      │      │      │       │  │ │ Status:     Published                     ││
│  │18:00│ER EVE│ER EVE│ER EVE│ER EVE│ER EVE│  │ │ ─────────────────────────────────────── ││
│  │     │██████│██████│██████│██████│██████ │  │ │ ASSIGNED STAFF (7)                       ││
│  │20:00│      │      │      │      │       │  │ │ • Sarah Chen, RN  [ICU-CERT]  ● On Duty  ││
│  │22:00│ICU NT│ICU NT│ICU NT│ICU NT│ICU NT │  │ │ • Mike Torres, RN [ICU-CERT]  ● On Duty  ││
│  │     │██████│██████│██████│██████│██████ │  │ │ • Amy Wong, RN               ● On Duty  ││
│  │00:00│      │      │      │      │       │  │ │ + 4 more...                               ││
│  └─────────────────────────────────────────┘  │ │                                           ││
│                                               │ │ [Edit Shift]  [Duplicate]  [Delete]       ││
│  ┌─────────────────────────────────────────┐  │ └───────────────────────────────────────────┘│
│  │ SHIFT LEGEND                            │  │                                               │
│  │ ██ Morning  ██ Evening  ██ Night        │  │ ┌───────────────────────────────────────────┐│
│  │ ██ Rotational  ██ On-Call  ██ ICU Spec  │  │ │ SHIFT TEMPLATES                           ││
│  └─────────────────────────────────────────┘  │ │ 📋 ICU Standard Week      [Apply]         ││
│                                               │ │ 📋 ER 3-Shift Rotation    [Apply]         ││
│                                               │ │ 📋 Med/Surg Weekend       [Apply]         ││
│                                               │ │ [+ Save Current as Template]              ││
│                                               │ └───────────────────────────────────────────┘│
└───────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 5.2 Create / Edit Shift Form (Right-Side Panel Drawer, 480px)

```
┌────────────────────────────────────────────────────────────┐
│  ✕  Create New Shift                              [SAVE]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  BASIC INFORMATION                                         │
│  ──────────────────────────────────────────────────────   │
│  Shift Name *                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ICU Morning — Ward 4B                                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Shift Type *                    Shift Color              │
│  ┌────────────────────────┐     ┌─────────────────────┐  │
│  │ Morning (06:00–14:00) ▾│     │ ████  Blue Morning ▾│  │
│  └────────────────────────┘     └─────────────────────┘  │
│                                                            │
│  Start Time *        End Time *       Break Duration      │
│  ┌──────────┐        ┌──────────┐     ┌──────────────┐  │
│  │ 06:00   ▾│        │ 14:00   ▾│     │ 30 min      ▾│  │
│  └──────────┘        └──────────┘     └──────────────┘  │
│                                                            │
│  PLACEMENT                                                 │
│  ──────────────────────────────────────────────────────   │
│  Department *              Ward *                          │
│  ┌──────────────────┐     ┌────────────────────────────┐ │
│  │ ICU             ▾│     │ Ward 4B — Intensive Care  ▾│ │
│  └──────────────────┘     └────────────────────────────┘ │
│                                                            │
│  Max Staff Capacity *                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 8                                            [RN: 6] │ │
│  │                                              [MD: 1] │ │
│  │                                             [CNA: 1] │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⓘ Breakdown by role optional. Total must be ≥ sum.      │
│                                                            │
│  RECURRENCE                                                │
│  ──────────────────────────────────────────────────────   │
│  ┌─ Recurring Shift ─────────────────────────────────┐   │
│  │ ● Weekly   ○ Bi-weekly   ○ Monthly   ○ None       │   │
│  │ Days: [✓Mon] [✓Tue] [✓Wed] [✓Thu] [✓Fri] [ Sat] [ Sun] │
│  │ Until: ┌────────────────┐ ● No end date           │   │
│  │        │ Dec 31, 2026  ▾│                         │   │
│  │        └────────────────┘                         │   │
│  └───────────────────────────────────────────────────┘   │
│                                                            │
│  VALIDATION RULES (auto-applied)                          │
│  ──────────────────────────────────────────────────────   │
│  ☑ Enforce ICU nurse:patient ratio ≤ 1:3                 │
│  ☑ Block assignment if certifications not met            │
│  ☑ Alert when capacity < minimum safe threshold          │
│  ☐ Allow overtime assignment (supervisor only)           │
│                                                            │
│  [Cancel]                    [Save as Draft]   [Publish]  │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Drag & Drop Behavior Specification

- **Draggable units:** Individual shift blocks on the calendar  
- **Drop targets:** Valid calendar cells (same or different day/time) + staff assignment board  
- **Drag ghost:** Semi-transparent copy of shift pill, follows cursor  
- **Conflict detection on hover:** Background of drop target turns red if conflict detected, green if valid  
- **Snap behavior:** Snaps to nearest 30-minute slot  
- **Undo:** Toast appears for 8 seconds with [Undo] button — all drags are reversible  
- **Keyboard fallback:** All drag operations executable via Edit menu for accessibility  

---

## 6. Screen 3 — Staff Assignment

### 6.1 Layout Architecture — Assignment Board

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Staff Assignment                    📅 May 16, 2026      [Bulk Assign ▾]  [Swap Shift]       │
│ Shift: ICU Morning — Ward 4B   Capacity: 7/8   ⚠ 1 open slot            [+ Assign Staff]    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ STICKY FILTER BAR                                                                              │
│ 🔍 Staff name/ID   Role ▾  Dept ▾  Availability ▾  Certifications ▾  [Clear]                │
├───────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ LEFT: SHIFT LANES — ASSIGNMENT BOARD (60%)    │ RIGHT: AVAILABLE STAFF POOL (40%)            │
│                                               │                                               │
│ ┌─────────────────────────────────────────┐   │ ┌───────────────────────────────────────────┐│
│ │ ▸ ICU MORNING   06:00–14:00   [Ward 4B]│   │ │ AVAILABLE STAFF                  (32)     ││
│ │ ────────────────────────────────────── │   │ │ Sorted by: Best Match ▾                   ││
│ │  ┌──────────────────────────────────┐  │   │ ├───────────────────────────────────────────┤│
│ │  │ Sarah Chen, RN     [ICU-CERT]   │  │   │ │ ✦ TOP MATCH                               ││
│ │  │ EMP-10042  ● Assigned  40h/wk  │  │   │ │ ┌─────────────────────────────────────┐   ││
│ │  │ [Reassign ▾]  [Remove]          │  │   │ │ │ Yuki Tanaka, RN    [ICU-CERT][ACLS]│   ││
│ │  └──────────────────────────────────┘  │   │ │ │ EMP-10087 · ICU · 28h this week    │   ││
│ │  ┌──────────────────────────────────┐  │   │ │ │ ● Available  ← Drag or [Assign +]  │   ││
│ │  │ Mike Torres, RN    [ICU-CERT]   │  │   │ │ └─────────────────────────────────────┘   ││
│ │  │ EMP-10055  ● Assigned  38h/wk  │  │   │ │ ┌─────────────────────────────────────┐   ││
│ │  │ ⚠ OT ADVISORY — 38/40h limit   │  │   │ │ │ Tom Bradley, RN    [ICU-CERT]       │   ││
│ │  │ [Reassign ▾]  [Remove]          │  │   │ │ │ EMP-10091 · ICU · 32h this week    │   ││
│ │  └──────────────────────────────────┘  │   │ │ │ ● Available  ← Drag or [Assign +]  │   ││
│ │  ┌──────────────────────────────────┐  │   │ │ └─────────────────────────────────────┘   ││
│ │  │ [OPEN SLOT]  ← Drop here or    │  │   │ │                                            ││
│ │  │ [+ Assign Staff]                │  │   │ │ SKILL MISMATCH — Requires ICU-CERT        ││
│ │  │ 🔴 Shift starts in 2h           │  │   │ │ ┌─────────────────────────────────────┐   ││
│ │  └──────────────────────────────────┘  │   │ │ │ Amy Park, RN       (no ICU cert)    │   ││
│ └─────────────────────────────────────────┘   │ │ │ EMP-10033 · Med/Surg · 20h/week    │   ││
│                                               │ │ │ ⚠ Missing: ICU-CERT  [Assign Anyway]│  ││
│ ┌─────────────────────────────────────────┐   │ │ └─────────────────────────────────────┘   ││
│ │ ▸ ICU EVENING   14:00–22:00   [Ward 4B]│   │ └───────────────────────────────────────────┘│
│ │ ────────────────────────────────────── │   │                                               │
│ │  8/8 assigned ● FULLY STAFFED          │   │ DOUBLE-BOOKING GUARD — ACTIVE                │
│ │  [Collapse ▸]                          │   │ Any staff already assigned to an              │
│ └─────────────────────────────────────────┘   │ overlapping shift is greyed out with          │
│                                               │ reason tooltip on hover.                      │
│ ┌─────────────────────────────────────────┐   │                                               │
│ │ ▸ ICU NIGHT   22:00–06:00   [Ward 4B]  │   │                                               │
│ │ 5/8  🔴 UNDERSTAFFED                   │   │                                               │
│ └─────────────────────────────────────────┘   │                                               │
└───────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 6.2 Assign Staff Drawer (Triggered by "+ Assign Staff")

```
┌────────────────────────────────────────────────────────────┐
│  ✕  Assign Staff to Shift                        [ASSIGN]  │
│  ICU Morning · Ward 4B · May 16, 2026 06:00–14:00         │
├────────────────────────────────────────────────────────────┤
│  Staff Member *                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔍 Search by name, ID, or certification...           │ │
│  └──────────────────────────────────────────────────────┘ │
│  ╔══════════════════════════════════════════════════════╗ │
│  ║ ✦ RECOMMENDED (skill-matched + available)            ║ │
│  ║  ● Yuki Tanaka, RN   [ICU-CERT][ACLS]   28h/wk     ║ │
│  ║  ● Tom Bradley, RN   [ICU-CERT]          32h/wk     ║ │
│  ╚══════════════════════════════════════════════════════╝ │
│                                                            │
│  Role *                    Priority                        │
│  ┌────────────────────┐   ┌────────────────────────────┐ │
│  │ Registered Nurse ▾ │   │ ● Normal  ○ High  ○ Float  │ │
│  └────────────────────┘   └────────────────────────────┘ │
│                                                            │
│  Assigned Date *                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 📅 May 16, 2026                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Notes (optional)                                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Covering for Sara Lee leave                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  VALIDATION CHECKS (real-time)                            │
│  ✅ Staff available (no overlapping shift)                │
│  ✅ ICU-CERT certification valid (exp. 12/2026)          │
│  ✅ Weekly hours: 28h + 8h = 36h (within 40h limit)     │
│  ⚠️  Shift swap request pending from this staff          │
│                                                            │
│  [Cancel]                              [Assign to Shift]  │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Swap Shift Workflow

**Trigger:** Staff clicks "Request Swap" or supervisor opens "Swap Shift" dialog

```
Step 1 — SELECT SWAP INITIATOR
  Staff A: [Search staff] → Mike Torres, RN · ICU Morning May 16

Step 2 — SELECT SWAP TARGET  
  Staff B: [Search staff] → Amy Wong, RN · ICU Evening May 16
  System auto-validates: same dept? ✅ · certifications match? ✅ · no double-booking? ✅

Step 3 — CONFIRM & REASON
  Reason: [Dropdown] Personal / Medical / Schedule Conflict / Coverage Request
  Notes: [Text field]
  Approval required: ✅ (from: Nursing Supervisor)

Step 4 — NOTIFICATION
  → Email + in-app notification sent to both staff + supervisor
  → Timeline event logged in audit trail

Step 5 — APPROVAL  
  Supervisor sees swap request in Leave/Coverage queue
  [Approve] [Reject with comment]
```

---

## 7. Screen 4 — Leave Management

### 7.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Leave Management                                         [+ Apply Leave]   [Export ▾]        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ LEAVE BALANCE SUMMARY CARDS (horizontal)                                                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Annual Leave │ │  Sick Leave  │ │ Personal Days│ │  Emergency   │ │ Comp Off     │        │
│ │    18 days   │ │   10 days    │ │   3 days     │ │   2 days     │ │   1 day      │        │
│ │  ▓▓▓▓▓▓░░░░ │ │  ▓▓▓▓▓▓▓░░░ │ │  ▓▓░░░░░░░░ │ │  ▓▓░░░░░░░░ │ │  ▓░░░░░░░░░ │        │
│ │  12 used     │ │   7 used     │ │   1 used     │ │   0 used     │ │   0 used     │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
├────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ LEFT: LEAVE REQUEST TABLE (60%)        │ RIGHT: APPROVAL TIMELINE + CALENDAR (40%)           │
│                                        │                                                      │
│ [Filter: All Requests ▾] [Status ▾]   │ ┌─────────────────────────────────────────────────┐ │
│                                        │ │ APPROVAL WORKFLOW TIMELINE                      │ │
│ ┌────────────────────────────────────┐ │ │ Leave: Vacation · May 20–22 · Sarah Chen       │ │
│ │ STAFF       TYPE   FROM   TO  STAT│ │ │ ─────────────────────────────────────────────  │ │
│ │ Sarah Chen  VAC    5/20  5/22  ⏳ │ │ │ ✅ May 15 09:14  Applied by Sarah Chen         │ │
│ │ [ICU-CERT]  3 days    ⚠ ICU cover │ │ │ ✅ May 15 11:32  Coverage impact checked       │ │
│ │ [View] [Approve] [Reject]          │ │ │    ICU-A: 1 open slot created May 20–22       │ │
│ ├────────────────────────────────────┤ │ │ ⏳ May 15 12:00  Pending: Supervisor Review   │ │
│ │ James Park  SICK   5/16  5/16  ⏳ │ │ │    Assigned to: Nancy Foster, Nursing Sup.    │ │
│ │ [Emergency] Today   🔴 ICU impact  │ │ │ ○ Pending: HR Approval                        │ │
│ │ [View] [Approve] [Reject]          │ │ │ ○ Pending: Replacement Assignment             │ │
│ ├────────────────────────────────────┤ │ └─────────────────────────────────────────────────┘ │
│ │ David Kim   COMP   5/18  5/18  ✅ │ │                                                      │
│ │             1 day  ● Approved      │ │ ┌─────────────────────────────────────────────────┐ │
│ ├────────────────────────────────────┤ │ │ LEAVE CALENDAR OVERLAY — MAY 2026               │ │
│ │ Amy Patel   EMRG   5/16  5/16  🔴 │ │ │  M   T   W   T   F   S   S                      │ │
│ │ [EMERGENCY] Hospitalized family    │ │ │              1   2   3                           │ │
│ │ [Approve Immediately]              │ │ │  4   5   6   7   8   9  10                       │ │
│ └────────────────────────────────────┘ │ │ 11  12  13  14  15  16  17                       │ │
│                                        │ │ 18  19 ░20 ░21 ░22  23  24  ← Sarah on leave    │ │
│                                        │ │ 25  26  27  28  29  30  31                       │ │
│                                        │ │                                                  │ │
│                                        │ │ Legend: ░ Leave  🔴 Emergency  ⚠ Overlap         │ │
│                                        │ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### 7.2 Apply Leave Form

```
┌────────────────────────────────────────────────────────────┐
│  ✕  Apply for Leave                              [SUBMIT]  │
├────────────────────────────────────────────────────────────┤
│  Employee *                                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Sarah Chen, RN — EMP-10042 — ICU                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Leave Type *                                             │
│  ○ Annual Leave    ○ Sick Leave    ○ Personal Day         │
│  ○ Emergency Leave ● Comp Off      ○ Maternity/Paternity  │
│  ○ FMLA                                                   │
│  [🔴 Tag as Emergency] — Flags for immediate supervisor   │
│                                                            │
│  From Date *            To Date *           Total Days    │
│  ┌──────────────┐       ┌──────────────┐    ┌──────────┐ │
│  │ 📅 May 20   │       │ 📅 May 22   │    │  3 days  │ │
│  └──────────────┘       └──────────────┘    └──────────┘ │
│                                                            │
│  ⚠ Coverage Impact Alert                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ICU-A will have 1 open slot on May 20–22.           │ │
│  │ Auto-coverage search will be triggered on approval.  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Reason *                                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Family vacation — pre-planned                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Supporting Document (optional)                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📎 Upload file (PDF, JPG — max 5MB)                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Approval Route                                           │
│  Supervisor → HR → Done (2-step approval required)       │
│                                                            │
│  [Cancel]                           [Save Draft] [Submit] │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Leave Overlap Detection Rules

| Scenario | System Response | Override? |
|----------|-----------------|-----------|
| Same shift has ≥ 2 leaves on same date | ADVISORY warning with coverage gap count | Yes — with reason |
| ICU leaves that drop ratio below 1:3 | CRITICAL alert — blocks approval until replacement assigned | No — requires coverage first |
| Leave overlaps pending leave of another critical-cert staff | ADVISORY — lists impacted staff | Yes |
| Leave during hospital-flagged blackout period (holidays, JC survey) | HARD STOP — requires Admin override | Yes — Admin only |
| FMLA request | Auto-routes to HR, bypasses supervisor, starts FMLA timer | No |

---

## 8. Screen 5 — Attendance Tracking

### 8.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Attendance Tracking                   📅 May 16, 2026    [Biometric Sync ↺]  [Export]        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ SUMMARY STRIP                                                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │SCHEDULED │ │ PRESENT  │ │  LATE    │ │  ABSENT  │ │ HALF-DAY │ │OVERTIME  │              │
│ │   247    │ │ 231 (94%)│ │  11 (4%) │ │   5 (2%) │ │  2 (<1%) │ │  23 hrs  │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
├────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ LEFT: ATTENDANCE TABLE (65%)           │ RIGHT: ANALYTICS PANEL (35%)                        │
│                                        │                                                      │
│ Filter: Dept ▾  Status ▾  Shift ▾     │ ┌─────────────────────────────────────────────────┐ │
│                                        │ │ ATTENDANCE HEATMAP — MAY 2026                   │ │
│ ┌────────────────────────────────────┐ │ │ (Absence frequency per day — darker = more)     │ │
│ │STAFF      CHECK-IN  CHECK-OUT  OT  │ │ │                                                  │ │
│ │Sarah Chen  06:04    14:12    0h   │ │ │  M   T   W   T   F   S   S                      │ │
│ │● Present  On-time                  │ │ │  ░   ░   ░   ▒   ░   —   —                      │ │
│ ├────────────────────────────────────┤ │ │  ░   ░   ▒   ░   ░   —   —                      │ │
│ │Mike Torres 06:31    14:08    0h   │ │ │  ▒   ░   ░   ░   ▓   —   —                      │ │
│ │⚠ Late      31 min late  [Flag]     │ │ │  ░   ░   ░   ░   ░   —   —                      │ │
│ ├────────────────────────────────────┤ │ │  ░   ░   —   —   —   —   —  (current)           │ │
│ │James Park  06:00    18:02    4h   │ │ │                                                  │ │
│ │● Present   OT: 4h  ⚠ OT WARNING  │ │ │  Legend: ░ Low  ▒ Medium  ▓ High  █ Critical    │ │
│ ├────────────────────────────────────┤ │ └─────────────────────────────────────────────────┘ │
│ │David Kim   —        —        —    │ │                                                      │
│ │🔴 Absent   No check-in recorded   │ │ ┌─────────────────────────────────────────────────┐ │
│ │[Mark Sick] [Contact] [Flag Absent] │ │ │ LATE ARRIVAL TREND — LAST 30 DAYS               │ │
│ ├────────────────────────────────────┤ │ │ (Bar chart: late minutes by day)                │ │
│ │Amy Patel   06:55    —        —    │ │ │ Week 1: 2 late  Week 2: 5 late  Week 3: 3 late  │ │
│ │◐ Half Day  Left early (personal)  │ │ │ Trending: ↑ Increasing                           │ │
│ └────────────────────────────────────┘ │ └─────────────────────────────────────────────────┘ │
│                                        │                                                      │
│                                        │ ┌─────────────────────────────────────────────────┐ │
│                                        │ │ OVERTIME ALERTS                                 │ │
│                                        │ │ ⚠ James Park: 40h reached — no more OT today   │ │
│                                        │ │ ⚠ Yuki Tanaka: 38h — 2h remaining              │ │
│                                        │ │ ⚠ Tom Bradley: 36h this week (advisory)        │ │
│                                        │ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### 8.2 Biometric Integration UI

```
┌────────────────────────────────────────────────────────────┐
│  BIOMETRIC SYNC STATUS                    [Sync Now ↺]     │
│  ─────────────────────────────────────────────────────── │
│  Last sync: May 16, 2026 at 14:00:32 UTC                  │
│  Source: ZKTeco BioTime · Devices: 6 online / 6 total     │
│                                                            │
│  Device Status:                                            │
│  ● Main Entrance (BIO-01)     Last ping: 2 min ago        │
│  ● ICU Entry (BIO-02)         Last ping: 1 min ago        │
│  ● ER Entry (BIO-03)          Last ping: 3 min ago        │
│  ⚠ OT Suite (BIO-04)          Last ping: 18 min ago — WARN│
│  ● Staff Lounge (BIO-05)      Last ping: 2 min ago        │
│  ● Admin Block (BIO-06)       Last ping: 4 min ago        │
│                                                            │
│  Records today: 1,847 events  Unmatched: 3  [Review]      │
└────────────────────────────────────────────────────────────┘
```

### 8.3 Attendance Status Logic

| Status | Trigger Condition | Color | Auto-action |
|--------|------------------|-------|-------------|
| Present | Check-in ≤ shift start + 5 min | Green | None |
| Late | Check-in > shift start + 5 min | Amber | Flag in report; notify supervisor if > 15 min |
| Absent | No check-in by shift start + 30 min | Red | Auto-notify supervisor; create coverage request |
| Half Day | Checkout < 50% of shift duration | Orange | Flag; no coverage trigger unless ICU |
| Overtime | Checkout > shift end | Amber/Red | OT log created; alert if > 4h OT |

---

## 9. Screen 6 — Department Roster

### 9.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Department Roster                  View: [Daily] [Weekly ✓] [Monthly]    Dept: ICU ▾        │
│                                                          [Export PDF] [Print Schedule]        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ STICKY FILTER BAR                                                                              │
│ Dept ▾  Role ▾  Ward ▾  Shift Type ▾  Week: May 12–18 ◀ ▶                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│ WEEKLY ROSTER — ICU DEPARTMENT                                                                │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ STAFF              │ MON 12 │ TUE 13 │ WED 14 │ THU 15 │ FRI 16 │ SAT 17 │ SUN 18 │ TOT│ │
│ ├────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤ │
│ │ Sarah Chen, RN     │ ██ AM  │ ██ AM  │ OFF    │ ██ AM  │ ██ AM  │ OFF    │ OFF    │ 32h│ │
│ │ [ICU-CERT][ACLS]   │06–14   │06–14   │        │06–14   │06–14   │        │        │    │ │
│ ├────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤ │
│ │ Mike Torres, RN    │ ██ AM  │ ██ AM  │ ██ AM  │ ██ AM  │ ██ AM  │ OFF    │ OFF    │40h │ │
│ │ [ICU-CERT]         │06–14   │06–14   │06–14   │06–14   │06–14   │        │        │⚠ OT│ │
│ ├────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤ │
│ │ Amy Wong, RN       │ ██ EV  │ ██ EV  │ ██ EV  │ OFF    │ ██ EV  │ ██ EV  │ OFF    │40h │ │
│ │ [ICU-CERT]         │14–22   │14–22   │14–22   │        │14–22   │14–22   │        │    │ │
│ ├────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤ │
│ │ David Kim, MD      │ ████   │ OFF    │ ████   │ ████   │ OFF    │ ████   │ ████   │48h │ │
│ │ [CHARGE]           │06–18   │        │06–18   │06–18   │        │06–18   │06–18   │🔴OT│ │
│ ├────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤ │
│ │ [OPEN SLOT]        │        │        │        │        │ ██ AM  │        │        │    │ │
│ │ Night shift empty  │        │        │        │        │🔴OPEN  │        │        │    │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                │
│ RESOURCE ALLOCATION HEATMAP — MAY 2026                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │     ICU   ER   OT   MED/SURG  BILLING  PHARMACY  LAB  RADIOLOGY                         │ │
│ │ Mon: ▓▓▓  ▓▓▓  ▓▓░  ▓▓▓▓     ▓▓░      ▓▓▓        ▓▓▓  ▓▓░                            │ │
│ │ Tue: ▓▓▓  ▓▓░  ▓▓▓  ▓▓▓▓     ▓▓▓      ▓▓░        ▓▓▓  ▓▓▓                            │ │
│ │ Wed: ▓▓░  ▓▓▓  ▓▓▓  ▓▓▓░     ▓▓░      ▓▓▓        ▓▓░  ▓▓▓                            │ │
│ │ Thu: ▓▓▓  ▓▓▓  ▓░░  ▓▓▓▓     ▓▓▓      ▓▓▓        ▓▓▓  ▓▓░                            │ │
│ │ Fri: ▓░░  ▓▓▓  ▓▓▓  ▓▓░░     ▓▓░      ▓▓░        ▓▓▓  ▓▓▓                            │ │
│ │                                                                                          │ │
│ │ Legend: ▓▓▓ Fully staffed  ▓▓░ Adequate  ▓░░ Understaffed  ░░░ Critical gap             │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Department-Specific Staffing Ratio Requirements

| Department | Minimum Ratio | Optimal | Critical Threshold | Regulatory Basis |
|------------|--------------|---------|-------------------|-----------------|
| ICU | 1 RN : 2 patients | 1:1–1:2 | >1:3 = CRITICAL | CMS CoP §482.23 |
| ER | 1 RN : 4 patients | 1:3 | >1:5 = CRITICAL | ENA Standards |
| OT (active surgery) | 1 Scrub + 1 Circulator per OR | — | Any solo = CRITICAL | AORN Guidelines |
| Med/Surg | 1 RN : 5 patients | 1:4 | >1:6 = SHORTAGE | State Nurse Practice Act |
| PICU | 1 RN : 2 patients | 1:1 | >1:2 = CRITICAL | CMS CoP |
| Pharmacy | 1 RPh : 200 beds | — | < 0.5 RPh/100 = warn | State Board of Pharmacy |
| Lab | 1 MLT : shift | — | 0 MLT on shift = CRITICAL | CLIA regulations |

---

## 10. Screen 7 — Coverage & Replacement

### 10.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Coverage & Replacement                                    [+ Create Coverage Request]         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│  🔴 EMERGENCY BANNER (when active)                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐│
│  │ 🚨 EMERGENCY COVERAGE NEEDED — ICU-B Night Shift — Starts in 47 minutes                  ││
│  │ Original: James Park, RN (Emergency Leave — Family Medical)                               ││
│  │ ICU-CERT required · 2 qualified staff available now · [Assign Immediately]  [Escalate]   ││
│  └──────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                │
├────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ LEFT: COVERAGE REQUESTS TABLE (55%)    │ RIGHT: SMART RECOMMENDATIONS (45%)                  │
│                                        │                                                      │
│ ┌────────────────────────────────────┐ │ ┌───────────────────────────────────────────────────┐│
│ │ ORIGINAL    REPLACE   REASON  STAT │ │ │ 🤖 SMART REPLACEMENT RECOMMENDATIONS              ││
│ │ J.Park,RN   [PENDING] EMRG    🔴  │ │ │ For: ICU Night · May 16 · 22:00–06:00            ││
│ │ ICU Night                          │ │ │ Required: ICU-CERT · RN · Night-eligible          ││
│ │ [Assign ▾] [Escalate]              │ │ ├───────────────────────────────────────────────────┤│
│ ├────────────────────────────────────┤ │ │ RANK 1 — BEST MATCH                               ││
│ │ A.Wong,RN   T.Bradley SICK    ⚠   │ │ │ ┌────────────────────────────────────────────┐   ││
│ │ ICU Eve (Tue 13)                   │ │ │ │ Yuki Tanaka, RN   [ICU-CERT][ACLS][BLS]  │   ││
│ │ ● Approved — T.Bradley assigned    │ │ │ │ EMP-10087 · Available · 28h this week     │   ││
│ ├────────────────────────────────────┤ │ │ │ Distance: 2.1 miles · Est. arrival: 45min │   ││
│ │ D.Kim,MD    [PENDING] SCHED   ℹ   │ │ │ │ ✅ Cert valid · ✅ No conflicts · ✅ Under│   ││
│ │ OT Morning (Wed 14)                │ │ │ │ OT threshold                              │   ││
│ │ [View Details]                     │ │ │ [Assign to Shift]                          │   ││
│ └────────────────────────────────────┘ │ │ └────────────────────────────────────────────┘   ││
│                                        │ │ RANK 2                                            ││
│ APPROVAL CHAIN                         │ │ ┌────────────────────────────────────────────┐   ││
│ ┌────────────────────────────────────┐ │ │ │ Tom Bradley, RN   [ICU-CERT]              │   ││
│ │ Step 1: Charge Nurse      ✅ Done  │ │ │ │ EMP-10091 · 32h this week · Available     │   ││
│ │ Step 2: Nursing Sup.      ⏳ Now   │ │ │ │ ⚠ 32h + 8h = 40h — at OT threshold      │   ││
│ │ Step 3: HR (if FMLA)      ⬜ Later │ │ │ [Assign with OT Warning]                   │   ││
│ └────────────────────────────────────┘ │ │ └────────────────────────────────────────────┘   ││
│                                        │ │                                                   ││
│                                        │ │ RANK 3 — SKILL MISMATCH                          ││
│                                        │ │ ┌────────────────────────────────────────────┐   ││
│                                        │ │ │ Amy Park, RN      (no ICU cert — flagged)  │   ││
│                                        │ │ │ [Assign with Override — Requires Supervisor]│   ││
│                                        │ │ └────────────────────────────────────────────┘   ││
│                                        │ └───────────────────────────────────────────────────┘│
└────────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### 10.2 Coverage Request Form

```
┌────────────────────────────────────────────────────────────┐
│  ✕  Create Coverage Request                      [SUBMIT]  │
├────────────────────────────────────────────────────────────┤
│  Original Staff *                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔍 James Park, RN — EMP-10042 — ICU                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Shift Being Covered *                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ICU Night — May 16, 2026 — 22:00 to 06:00           │ │
│  └──────────────────────────────────────────────────────┘ │
│  ✅ Required certs auto-loaded: ICU-CERT, BLS            │
│                                                            │
│  Reason for Coverage *                                    │
│  ○ Emergency Leave   ● Sick Leave   ○ AWOL               │
│  ○ Shift Swap        ○ FMLA         ○ Schedule Error     │
│  [🔴 Mark as Emergency — escalate immediately]            │
│                                                            │
│  Replacement Staff                                        │
│  ● Auto-Recommend   ○ Manual Select                       │
│  [Recommendation engine will suggest best matches]        │
│                                                            │
│  Effective Date *      Effective Shift *                  │
│  ┌──────────────┐      ┌──────────────────────────────┐  │
│  │ May 16, 2026│      │ Night Shift · 22:00–06:00   │  │
│  └──────────────┘      └──────────────────────────────┘  │
│                                                            │
│  Escalation Timeout (if no replacement found)             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Escalate to Nursing Director after: 30 min ▾         │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [Cancel]                              [Submit Request]   │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Role-Based Access Control — Screen-Level Matrix

| Screen | Admin | HR Manager | Nursing Supervisor | Doctor Lead | Staff (Own) |
|--------|-------|------------|-------------------|-------------|-------------|
| Schedule Dashboard | Full | View only | Nursing staff only | Doctor rows only | Own row only |
| Shift Management → Create/Edit | ✅ | ✅ | Nursing depts only | Doctor schedules | ❌ |
| Shift Management → Publish | ✅ | ✅ | Nursing depts only | ❌ | ❌ |
| Staff Assignment → Assign | ✅ | ✅ | Nursing only | Doctor only | ❌ |
| Staff Assignment → Swap | ✅ | ✅ | ✅ | ✅ | Request only |
| Leave Management → Apply | ✅ | ✅ | ✅ | ✅ | Own only |
| Leave Management → Approve | ✅ | ✅ | Nursing staff | Doctor staff | ❌ |
| Attendance → View | ✅ | ✅ | Nursing only | Doctor only | Own only |
| Attendance → Edit/Override | ✅ | ✅ | ❌ | ❌ | ❌ |
| Department Roster → View | ✅ | ✅ | Own dept | Own dept | Own dept |
| Department Roster → Edit | ✅ | ✅ | Own dept | ❌ | ❌ |
| Coverage & Replacement → Create | ✅ | ✅ | ✅ | ✅ | ❌ |
| Coverage → Emergency Escalate | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit Logs → View | ✅ | ✅ | Own dept | ❌ | ❌ |

**Field-Level Visibility Rules:**
- Staff home address, phone: HR + Admin only
- Salary / pay grade: Admin only  
- Certification expiry dates: Supervisor + HR + Admin
- Leave balance: Own + HR + Admin
- Overtime hours: Own + Supervisor + HR + Admin

---

## 12. Component Hierarchy

```
StaffSchedulingModule (root route layout)
│
├── SchedulingModuleHeader         ← Page title + date + global actions
├── SchedulingAlertBanner          ← Conditional — critical/shortage only
├── SchedulingSubNavTabs           ← Sticky 7-tab pill strip
│
├── ScheduleDashboard
│   ├── KpiWidgetRow
│   │   └── KpiCard (×6)          ← Sparkline + primary number + status
│   ├── StaffingTablePanel
│   │   ├── StickyFilterBar
│   │   ├── StaffDataTable         ← Sortable + filterable + paginated
│   │   │   └── StaffTableRow      ← Cert badges + status dot + actions
│   │   └── TablePagination
│   └── RealtimeSidePanel
│       ├── UnitRatioMonitor       ← Progress bars per unit
│       ├── ActiveAlertsFeed       ← Chronological alert list
│       └── ShiftTimelineBar       ← 24h linear timeline
│
├── ShiftManagement
│   ├── ShiftCalendarView          ← FullCalendar resourceTimeline
│   │   ├── ShiftEventBlock        ← Draggable shift pill
│   │   └── CalendarLegend
│   ├── ShiftDetailPanel           ← Right rail — selected shift
│   │   ├── ShiftInfoSection
│   │   ├── AssignedStaffList
│   │   └── ShiftActions
│   ├── ShiftTemplatePanel
│   └── ShiftFormDrawer            ← Create/Edit side panel
│       ├── BasicInfoSection
│       ├── PlacementSection
│       ├── RecurrenceSection
│       └── ValidationRulesSection
│
├── StaffAssignment
│   ├── AssignmentToolbar          ← Shift selector + bulk actions
│   ├── ShiftLanesBoard            ← Left panel
│   │   └── ShiftLane (per shift)
│   │       ├── AssignedStaffCard  ← Draggable
│   │       └── OpenSlotDropZone   ← Drop target
│   ├── AvailableStaffPool         ← Right panel
│   │   ├── PoolFilterBar
│   │   ├── RecommendedSection
│   │   ├── AvailableStaffCard     ← Draggable source
│   │   └── SkillMismatchSection
│   └── AssignStaffDrawer
│       ├── StaffSearchField
│       ├── RecommendedStaffList
│       └── ValidationChecklist
│
├── LeaveManagement
│   ├── LeaveBalanceCards          ← Per leave type
│   ├── LeaveRequestTable
│   │   └── LeaveRequestRow        ← Approve/Reject inline
│   ├── ApprovalTimelinePanel
│   ├── LeaveCalendarOverlay       ← Mini-calendar with leave markers
│   └── ApplyLeaveDrawer
│       ├── LeaveTypeSelector
│       ├── DateRangePicker
│       ├── CoverageImpactAlert
│       └── AttachmentUploader
│
├── AttendanceTracking
│   ├── AttendanceSummaryStrip     ← 6 count cards
│   ├── AttendanceDataTable
│   │   └── AttendanceRow          ← Check-in/out + OT + status
│   ├── AttendanceHeatmap          ← Monthly calendar grid — absence density
│   ├── LateArrivalTrendChart      ← Bar chart
│   ├── OvertimeAlertPanel
│   └── BiometricSyncStatus
│
├── DepartmentRoster
│   ├── RosterViewToggle           ← Daily / Weekly / Monthly
│   ├── DeptRosterGrid             ← Staff × Day matrix
│   │   ├── RosterCell             ← Shift pill or OFF or OPEN
│   │   └── OvertimeIndicator
│   └── ResourceAllocationHeatmap  ← Dept × Day intensity grid
│
└── CoverageReplacement
    ├── EmergencyCoverageBanner    ← Pulsing red — conditional
    ├── CoverageRequestTable
    │   └── CoverageRequestRow
    ├── SmartRecommendationPanel
    │   └── ReplacementCandidateCard (ranked)
    ├── ApprovalChainTracker       ← Step indicators
    └── CoverageRequestDrawer
```

---

## 13. Enterprise Features — UX Specification

### 13.1 AI-Based Shift Balancing

**Entry Point:** Dashboard KPI bar → "Optimize Schedule" button (Admin/HR only)

```
┌────────────────────────────────────────────────────────────┐
│ 🤖 AI SHIFT OPTIMIZER                             [Run]    │
│ Analyzing: ICU · ER · Med/Surg · Week of May 12–18        │
├────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS (3 found)                                  │
│ ─────────────────────────────────────────────────────────  │
│ 1. Redistribute 2 RNs from Med/Surg Tuesday AM to         │
│    ICU Tuesday AM — brings ICU to full capacity           │
│    Impact: ICU ratio improves 1:3.2 → 1:2.8  ✅ Apply   │
│                                                            │
│ 2. Shift Mike Torres Thursday to ON-CALL instead of       │
│    assigned — he reaches 40h Wed · prevents OT            │
│    Impact: $340 OT cost avoided  ✅ Apply                 │
│                                                            │
│ 3. Suggest float pool nurse Amy Zhang for Sat Night ICU   │
│    — currently unassigned, ICU-certified, 0h this week    │
│    ✅ Apply   ✕ Dismiss                                   │
│                                                            │
│ [Apply All Recommendations]         [Review Individually]  │
└────────────────────────────────────────────────────────────┘
```

### 13.2 Notification & Alert Center

**Notification Types and Delivery:**

| Event | In-App Bell | Email | SMS | Toast |
|-------|-------------|-------|-----|-------|
| Leave approved/rejected | ✅ | ✅ | ✅ | ✅ |
| Shift assigned to me | ✅ | ✅ | ✅ | ✅ |
| Open shift alert (critical) | ✅ | ✅ | ✅ | ✅ pulsing |
| Swap request received | ✅ | ✅ | ❌ | ✅ |
| Schedule published | ✅ | ✅ | ❌ | ✅ |
| OT threshold warning | ✅ | ✅ | ❌ | ✅ |
| ICU ratio breach | ✅ Admin | ✅ Admin | ✅ Supervisor | ✅ pulsing red |
| Certification expiring (30 days) | ✅ | ✅ | ❌ | ❌ |
| Biometric sync failure | ✅ IT | ✅ IT | ❌ | ✅ |

**Notification Panel UI (Bell dropdown — 320px wide):**

```
┌────────────────────────────────────────────────────────────┐
│  Notifications  (4 unread)                    [Mark all ✓] │
├────────────────────────────────────────────────────────────┤
│  🔴 ICU-B understaffed — Night May 16         2 min ago   │
│  Action required: Assign replacement                       │
│  [Assign Coverage ›]                                       │
├────────────────────────────────────────────────────────────┤
│  ⚠ Sarah Chen leave request — awaiting your approval      │
│  May 20–22 · Vacation · 3 days                 1h ago     │
│  [Review ›]                                                │
├────────────────────────────────────────────────────────────┤
│  ✅ Schedule published — Week May 19–25       2h ago       │
│  By: Nancy Foster (HR)                                     │
├────────────────────────────────────────────────────────────┤
│  📋 Mike Torres certification expires in 28 days          │
│  ICU-CERT — Renew before Jun 13                5h ago     │
│  [View Cert ›]                                             │
└────────────────────────────────────────────────────────────┘
```

### 13.3 Audit Trail — HIPAA-Compliant Log

**Location:** Admin → Settings → Audit Logs → Staff Scheduling section

**Audit Log Table:**

| Column | Details |
|--------|---------|
| Timestamp | UTC · ISO 8601 · Non-editable |
| User | Name + EMP-ID + Role |
| Action | CREATE_SHIFT / ASSIGN_STAFF / APPROVE_LEAVE / OVERRIDE_CONFLICT / DELETE_SHIFT / etc. |
| Target | Staff name + ID + Shift/Leave/Assignment ID |
| Before State | JSON diff (collapsed, expandable) |
| After State | JSON diff (collapsed, expandable) |
| IP Address | Masked last octet for privacy |
| Session | Session token prefix |
| Reason Code | Required for overrides — free text captured at action time |

**Immutability guarantee:** Audit records are append-only. No delete, no edit. Displayed with lock icon.

---

## 14. Responsive & Interaction Design

### 14.1 Breakpoint Behavior

| Breakpoint | Layout Change |
|------------|--------------|
| `xl` (1280px+) | Full 3-column layouts. Calendar + table + side panel all visible |
| `lg` (1024px–1279px) | Side panel collapses to overlay drawer (triggered by row click) |
| `md` (768px–1023px) | Table-only view. Calendar accessible via tab toggle. Filters collapse to modal |
| `sm` (< 768px) | Not a primary target (desktop EMR). Shows minimal read-only view with "Use desktop" notice |

### 14.2 Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Alt + S` | Open Shift Management |
| `Alt + A` | Open Staff Assignment |
| `Alt + L` | Open Leave Management |
| `Alt + N` | New shift / new leave (context-sensitive) |
| `Tab / Shift+Tab` | Move through table rows |
| `Enter` | Open detail panel for focused row |
| `Esc` | Close drawer / dismiss modal |
| `Ctrl + Z` | Undo last drag-drop operation |
| `F5` | Refresh dashboard data |

### 14.3 Loading & Empty States

**Loading — Table:**
```
[Skeleton rows — 8 rows × column widths, animated pulse]
```

**Loading — Calendar:**
```
[Grey blocks in calendar cells — same dimensions as shift pills, animated pulse]
```

**Empty — No staff assigned to shift:**
```
┌─────────────────────────────────┐
│  👥  No staff assigned yet      │
│  This shift has no assignments. │
│  [+ Assign Staff]               │
└─────────────────────────────────┘
```

**Empty — No leave requests:**
```
┌─────────────────────────────────┐
│  🏖️  No leave requests found    │
│  Adjust filters or date range.  │
└─────────────────────────────────┘
```

---

## 15. API Integration Structure (Frontend Contracts)

### 15.1 API Endpoint Map

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scheduling/dashboard/summary` | GET | KPI card data + alert feed |
| `/api/scheduling/staff/on-duty` | GET | Real-time on-duty staff list |
| `/api/scheduling/shifts` | GET / POST | List shifts / Create shift |
| `/api/scheduling/shifts/:id` | PUT / DELETE | Edit / Delete shift |
| `/api/scheduling/shifts/:id/publish` | POST | Publish a schedule |
| `/api/scheduling/assignments` | GET / POST | List / Create assignments |
| `/api/scheduling/assignments/:id/swap` | POST | Swap two assignments |
| `/api/scheduling/leave` | GET / POST | Leave requests list / Apply |
| `/api/scheduling/leave/:id/approve` | POST | Approve leave request |
| `/api/scheduling/leave/:id/reject` | POST | Reject with reason |
| `/api/scheduling/attendance` | GET | Attendance records |
| `/api/scheduling/attendance/sync` | POST | Trigger biometric sync |
| `/api/scheduling/roster/:dept` | GET | Department roster grid |
| `/api/scheduling/coverage` | GET / POST | Coverage requests |
| `/api/scheduling/coverage/recommend` | POST | Smart replacement recommendations |
| `/api/scheduling/audit-log` | GET | Audit trail (Admin only) |
| `/api/scheduling/alerts` | GET | Real-time alert feed (WebSocket) |

### 15.2 Real-Time Updates

- **Protocol:** WebSocket connection to `/ws/scheduling/alerts`
- **Heartbeat:** 30-second ping/pong
- **Events pushed:** `UNIT_RATIO_BREACH`, `OPEN_SHIFT_CRITICAL`, `STAFF_ABSENT`, `LEAVE_APPROVED`, `ASSIGNMENT_CHANGED`
- **Fallback:** Polling every 60 seconds if WebSocket disconnects
- **Reconnection:** Exponential backoff — 1s → 2s → 4s → 8s → max 30s

### 15.3 State Management Structure

```
schedulingStore
│
├── dashboard
│   ├── kpiData                    { totalOnDuty, nursesOnShift, ... }
│   ├── staffList                  StaffOnDuty[]
│   ├── activeAlerts               Alert[]
│   └── unitRatios                 UnitRatio[]
│
├── shifts
│   ├── calendarEvents             FullCalendarEvent[]
│   ├── selectedShift              Shift | null
│   ├── shiftFormMode              'create' | 'edit' | null
│   ├── templates                  ShiftTemplate[]
│   └── publishStatus              'draft' | 'published' | 'pending'
│
├── assignment
│   ├── shiftLanes                 ShiftLane[]  (with assigned staff per lane)
│   ├── availablePool              AvailableStaff[]
│   ├── dragState                  DragState | null
│   └── conflicts                  ConflictWarning[]
│
├── leave
│   ├── requests                   LeaveRequest[]
│   ├── selectedRequest            LeaveRequest | null
│   ├── balances                   LeaveBalance[]
│   └── calendarMarkers            LeaveCalendarMarker[]
│
├── attendance
│   ├── records                    AttendanceRecord[]
│   ├── heatmapData                HeatmapCell[][]
│   ├── biometricStatus            BiometricDevice[]
│   └── overtimeWarnings           OvertimeWarning[]
│
├── roster
│   ├── rosterGrid                 RosterRow[]     (staff × day)
│   ├── viewMode                   'daily' | 'weekly' | 'monthly'
│   └── allocationHeatmap          AllocationCell[][]
│
└── coverage
    ├── requests                   CoverageRequest[]
    ├── recommendations            ReplacementCandidate[]
    └── emergencyActive            boolean
```

---

## 16. Implementation Phasing Recommendation

### Phase A — Foundation (Weeks 1–3)

**Priority:** Critical path — without this nothing else works

1. Module routing + sidebar integration
2. Design token setup (shift colors, status badges, spacing)
3. Schedule Dashboard — KPI cards + staff table (read-only)
4. Shift Management — FullCalendar weekly view (read-only calendar)
5. Basic RBAC gates — admin/HR/supervisor/staff

### Phase B — Core Workflows (Weeks 4–7)

**Priority:** Primary value delivery

6. Shift CRUD form (create/edit/delete/duplicate)
7. Shift publish workflow
8. Staff Assignment board (drag-drop)
9. Double-booking prevention + conflict detection
10. Leave Management — apply + approval workflow
11. Leave calendar overlay

### Phase C — Intelligence & Monitoring (Weeks 8–11)

**Priority:** Differentiates from basic scheduler

12. Attendance tracking + biometric sync UI
13. Attendance heatmap + trend chart
14. Department Roster — weekly grid view
15. Coverage & Replacement — smart recommendations
16. Real-time alerts (WebSocket feed)
17. ICU ratio monitoring

### Phase D — Enterprise Hardening (Weeks 12–14)

**Priority:** Production-readiness

18. AI shift optimizer UI
19. Notification center (email/SMS templates)
20. Full audit log
21. Export/Print roster
22. Shift templates library
23. Bulk scheduling
24. HIPAA audit trail

---

*Document End — MD Care Inpatient EMR · Staff Scheduling & Workforce Management · UX Design v1.0*
