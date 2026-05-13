# MD Care Inpatient EMR — Phase 1 Complete UI/UX Design
**Date:** May 2026  
**Designed By:** Medical Expert & Senior UI/UX Designer  
**Benchmarked Against:** Epic EpicCare Inpatient · Oracle Health Cerner Millennium  
**Regulatory Standards:** ONC 21st Century Cures Act · CMS Conditions of Participation · HIPAA §164.312 · DEA EPCS

---

## Overview

### Phase 1 Scope — Compliance & Revenue (0–6 Months)
- **16 modules** across 6 clinical domains
- **4 federal mandates** addressed: ONC 21st Century Cures, CMS CoP, HIPAA §164.312, DEA EPCS
- **7 quick-win stubs** already exist in codebase — ready to activate

---

## Design System

### Clinical Status & Alert Color System

| Level | Color | Trigger | Behavior |
|-------|-------|---------|----------|
| **HARD STOP** | Red / Danger | Drug-allergy contradiction, critical lab, identity mismatch | Modal blocks workflow — cannot proceed without resolution |
| **ADVISORY** | Orange / Warning | Drug-drug interaction, dosing adjustment, duplicate order | Override available — reason captured, logged for QA |
| **INFORMATIONAL** | Neutral | Best practice reminders, preventive care gaps | Non-interrupting inline banner — no workflow block |

### Patient-Level Badges (Always Visible in Header)

| Badge | Meaning | Color |
|-------|---------|-------|
| ALLERGY | Documented drug/food allergy — blocks contraindicated orders | Red / Danger |
| ISO TYPE | Contact / Droplet / Airborne / Neutropenic precautions | Orange / Warning |
| CODE STATUS | Full Code / DNR / DNI / Comfort Care only | Red / Danger |
| FALL RISK | Morse Fall Score >= 45 or clinical judgment | Orange / Warning |
| ELOPEMENT | Behavioral health — at risk of leaving AMA | Red / Danger |

### 5 Core UX Principles for Clinical Software

| # | Principle | Clinical Rationale | Implementation |
|---|-----------|-------------------|----------------|
| 1 | Minimal clicks to critical actions | Alert fatigue increases with friction; slow workflows can cost lives | Primary actions always surface-level; no modals deeper than 2 levels; keyboard shortcuts for orders |
| 2 | Information density over white space | Clinicians need full patient context on a single screen — Epic/Cerner both prioritize density | Patient header always visible; compact data grids; collapsible sections instead of pagination |
| 3 | Progressive disclosure of risk | Hard stops must be rare and meaningful to avoid fatigue-driven override | Tiered: info (banner) → advisory (inline + override) → critical (hard-stop modal) |
| 4 | Contextual data, not raw numbers | A value means nothing without trend, baseline, and reference range | Trend arrows, delta flags, reference ranges inline, color coding for deviation from baseline |
| 5 | Audit-first architecture | Every clinical action is a legal record under HIPAA and state law | Non-editable timestamps; signature capture on all orders and notes; PHI access logged automatically |

---

## Information Architecture — Phase 1 Sidebar Navigation

```
CLINICAL
├── Nursing Flowsheets
├── CPOE — Order Entry
├── CDS Alerts Inbox
├── Sepsis / Early Warning
└── Infection Control

REVENUE CYCLE
├── Charge Capture & CDM
├── Claims (837I / 835)
├── Prior Auth & Eligibility
└── Denial Workqueue

INTEROPERABILITY
├── e-Prescribing — SureScripts
├── PDMP Query (DEA)
├── HL7 FHIR R4 API
└── HL7 v2 Interface Engine

OPERATIONS
├── Case Management & UR
├── Patient Flow Board
└── Transfer Center

COMPLIANCE
├── HIPAA PHI Audit Log
├── Infection Surveillance
└── Quality Measures (eCQM)

PATIENT ENGAGEMENT
├── Patient Portal (MyChart-equiv)
├── Secure Messaging
└── Patient Education
```

---

## Patient Context Banner (Universal — All Clinical Screens)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ MARTINEZ, John A.          Room: 4B-12 · Med/Surg    Attending: Dr. Sarah Chen, MD  │
│ 68M · MRN 00483921         Admitted: 05/06/26          Primary Dx: Sepsis / CHF      │
│ DOB 02/14/1958             LOS: 1d 22h                                               │
│ [PCN ALLERGY] [CONTACT ISO] [FULL CODE] [FALL RISK]                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 1 — CLINICAL SCREENS (5 Screens)

---

### Screen 1.1 — Nursing Assessment Flowsheet
**Epic Equivalent:** FlowSheets | **Cerner Equivalent:** PowerChart Nursing

**Key Design Elements:**
- Time-based documentation grid (every 2–4 hours per shift)
- Critical values auto-trigger CDS alerts within 2 minutes
- All cells timestamped and attributed to charting nurse
- Color coding: Red = critical, Orange = abnormal, Default = within range

**Stats Bar:**
- Last Charted (This Shift)
- Overdue Assessments (with urgency countdown)
- Assessment Sections Complete (x of 8)
- Current Nurse Assignment

**Vital Signs Grid — Current Shift (07:00–19:00)**

| Parameter | Ref Range | 07:00 | 09:00 | 11:00 | 13:00 | 15:00 | 17:00 |
|-----------|-----------|-------|-------|-------|-------|-------|-------|
| Temp (°F) | 97.0–99.5 | 101.2 H | 101.8 H | 102.1 H | 101.4 H | 100.6 H | — |
| Heart Rate (bpm) | 60–100 | 118 H | 114 H | 108 H | 104 H | 98 | — |
| BP (mmHg) | 90–140 / 60–90 | 88/56 L | 92/60 | 98/64 | 104/68 | 106/70 | — |
| RR (/min) | 12–20 | 24 H | 22 H | 20 | 18 | 18 | — |
| SpO2 (%) | >= 94% | 91 L | 93 L | 95 | 96 | 97 | — |
| Pain Score (0–10) | Goal < 4 | 7 H | 6 H | 5 H | 4 | 3 | — |
| GCS Total | 15 (normal) | 14 | 14 | 15 | 15 | 15 | — |

**Intake & Output (I/O):**
- IV intake, oral intake, urine output (Foley), drain output, net balance

**Systems-Based Assessment Tracker:**
- Neurological, Cardiovascular, Respiratory, GI/Nutrition, GU/Renal, Skin/Wounds (Braden), Pain/Comfort, Lines/Tubes/Drains
- Status: Complete / Partial / OVERDUE (with timer)

---

### Screen 1.2 — CPOE — Computerized Physician Order Entry
**Epic Equivalent:** Orders | **Cerner Equivalent:** PowerOrders

**Key Design Elements:**
- Evidence-based order sets (one-click load, customize before signing)
- Active orders table with pharmacist verification states
- Priority selector: Routine / Urgent / STAT
- Co-signature workflow for residents

**Order Sets Available:**

| Order Set | Order Count | Guideline |
|-----------|-------------|-----------|
| Sepsis Bundle (SEP-1) | 8 orders | CMS Core Measure |
| CHF Admission Protocol | 14 orders | AHA/ACC Guideline |
| DVT Prophylaxis | 3 orders | SCIP / ACCP Standard |
| Community-Acquired Pneumonia | 11 orders | CMS PN Core |
| Post-Op General Surgery | 17 orders | Facility Standard |
| Alcohol Withdrawal (CIWA-Ar) | 6 orders | ASAM Protocol |

**Active Order Statuses:**
- Active, Pending Pharmacist Verification, Completed, Resulted, Pending Co-Signature (DANGER)

**Order Entry Fields:**
- Medication/lab/imaging search bar
- Priority (Routine / Urgent / STAT)
- Start date/time (Now or Scheduled)
- Sign Order / Sign & Next actions

---

### Screen 1.3 — CDS Alerts & Best Practice Advisories (BPAs)
**Epic Equivalent:** Best Practice Advisories | **Cerner Equivalent:** CDS Hooks

**Key Design Elements:**
- Tiered alert system (Hard Stop > Advisory > Informational)
- Override reasons captured via checkbox selection
- 30-day alert fatigue metrics bar chart
- Override rate KPI tracked (target < 60%)

**Hard Stop — Drug-Allergy Example:**
> Ordered: Ampicillin-Sulbactam 3g IV. Patient has PENICILLIN ALLERGY — Anaphylaxis (Severe, confirmed 03/2019). Cannot sign without allergy reconciliation + pharmacist co-sign.

**Advisory Alert Examples:**
1. Duplicate antibiotic gram-positive coverage (Vancomycin + Linezolid)
2. Renal dose adjustment required (Pip-Tazo, eGFR 28)

**Override Reason Options (checkboxes):**
- Clinical indication documented
- Consult ordered
- Dose adjusted per recommendation
- Clinical judgment — override accepted

**Alert Log Fields:** Alert type, trigger, action taken, provider, timestamp

---

### Screen 1.4 — Sepsis & Early Warning Score Dashboard
**Epic Equivalent:** Deterioration Index | **Cerner Equivalent:** Sepsis Advisor

**Key Design Elements:**
- NEWS2 + qSOFA auto-calculated from vitals documentation
- Alerts fire within 2 minutes of qualifying vitals
- CMS SEP-1 bundle countdown timer
- Unit-wide risk board with sortable columns

**Unit Risk Board Columns:**
Patient | Room | NEWS2 | qSOFA | HR | RR | SpO2 | Temp | SBP | SEP-1 Bundle (x/6) | Status

**NEWS2 Risk Thresholds:**
- 0–4: Low Risk (green)
- 5–6: Moderate Risk (orange) — urgent review
- 7–8: High Risk (red) — emergency response
- 9+: Critical (red) — immediate RRT activation

**SEP-1 Bundle Elements (6/6 required within 3 hours):**
1. Blood cultures x2 (before antibiotics)
2. Lactic acid level drawn
3. Broad-spectrum antibiotics administered
4. 30 mL/kg IV crystalloid (if lactate >= 4.0)
5. Vasopressors if MAP < 65 after resuscitation
6. Repeat lactate if initial >= 2.0 mmol/L

**NEWS2 Trend Chart:** Line chart over 24 hours per patient

---

### Screen 1.5 — Infection Control & Isolation Management
**Epic Equivalent:** Infection Control | **Cerner Equivalent:** Infection Surveillance

**Key Design Elements:**
- Isolation order auto-updates bed board and patient header banner
- Isolation type selector: Contact / Droplet / Airborne / Neutropenic / Enhanced Barrier
- HAI surveillance table vs NHSN benchmarks
- Isolation placed → housekeeping alert auto-triggered

**Active Isolation Types:**
- Contact + Droplet: MRSA wound
- Contact: VRE urine
- Airborne (N95 required): TB rule-out
- Neutropenic/Reverse: ANC < 500 (oncology)

**HAI Surveillance Table:**

| Infection Type | Rate per 1,000 Days | NHSN Benchmark |
|----------------|--------------------|----|
| CLABSI | 0.0 | < 1.0 |
| CAUTI | 1.2 | < 1.5 |
| SSI | 0.0 | < 2.0 |
| C. difficile | 0.8 | < 0.5 ⚠ |
| VAP | 0.0 | < 1.0 |
| MRSA Bacteremia | 0.4 | < 0.3 ⚠ |

---

## TAB 2 — REVENUE CYCLE SCREENS (3 Screens)

---

### Screen 2.1 — Charge Capture & CDM
**Epic Equivalent:** Charge Router | **Cerner Equivalent:** Revenue Cycle

**Key Design Elements:**
- Automated charge generation from clinical orders and nursing documentation
- ICD-10-CM/PCS diagnosis coding with POA (Present on Admission) flags
- MS-DRG grouping via DRG v41.0 (FY2026)
- Charges reviewed before claim generation

**Encounter Summary KPIs:**
- Gross Charges for Encounter
- Assigned MS-DRG (e.g., MS-DRG 871 — Septicemia w/ MCC)
- Estimated Reimbursement (Medicare)
- Charges Pending Clinical Review

**Charge Table Columns:**
Description | Rev Code / CPT | Units | Unit Charge | Total | Status (Posted / Pending Review)

**ICD-10 Diagnosis Table Columns:**
Sequence | ICD-10-CM Code | Description | POA (Y/N) | Type (PDX / Secondary / CC / MCC)

**DRG Summary Panel:**
- Assigned MS-DRG, Description, Relative Weight, Geometric Mean LOS, Arithmetic Mean LOS, Payer, Estimated Reimbursement

---

### Screen 2.2 — Claims Management (837I / 835)
**Epic Equivalent:** Resolute | **Cerner Equivalent:** RevElate

**Key Design Elements:**
- End-to-end institutional claim lifecycle
- EDI via Availity/Waystar clearinghouse (ANSI X12 5010A2)
- Real-time claim status via 277CA transactions
- Denial management with appeal deadline countdown

**Claims Pipeline Stats:**
Draft | Submitted | Accepted/Paid | Denied | Total AR Balance

**Filter Options:** All / Draft / Submitted / Accepted / Denied / Paid / Appeal Pending

**Claims Worklist Columns:**
Claim ID | Patient | Payer | Admit Date | Discharge Date | Gross Charges | Status | Denial Reason Code

**Common Denial Codes to Handle:**
- M51 — Missing/invalid revenue code
- CO-4 — Service requires prior authorization
- CO-50 — Not medically necessary
- CO-97 — Benefit included in payment for another service

---

### Screen 2.3 — Prior Authorization & Eligibility Verification
**Epic Equivalent:** Benefits Engine | **Cerner Equivalent:** HealtheRegistries

**Key Design Elements:**
- X12 270/271 for real-time eligibility at admission
- X12 278 for prior authorization requests
- Integrated with Availity payer portal
- Reduces avoidable denials from auth failures

**Eligibility Results Panel:**
- Primary/secondary insurance, member ID, coverage type
- Deductible status (met / unmet / amount remaining)
- Coinsurance per day, co-pay, authorization required (Y/N)
- Verification timestamp and status badge

**Prior Auth Tracker Columns:**
Patient | Payer | Service | Submitted Date | Payer Deadline | Status (Pending / Approved / Denied / Under Review)

---

## TAB 3 — INTEROPERABILITY SCREENS (2 Screens)

---

### Screen 3.1 — e-Prescribing (SureScripts) & PDMP
**Epic Equivalent:** e-Prescribing | **Cerner Equivalent:** eRx + PDMP

**Key Design Elements:**
- SureScripts network for all outpatient/discharge medications
- DEA-compliant EPCS with 2-factor authentication for Schedule II–V
- PDMP query mandatory before any controlled substance (40+ state laws)
- High-risk PDMP flags: multiple prescribers, multiple pharmacies, excess MME

**Prescription Entry Fields:**
- Medication (with schedule indicator)
- Sig / Patient directions
- Quantity, days supply, refills (0 for Schedule II)
- DAW (dispense as written)
- Prescriber DEA # and NPI
- Target pharmacy (NCPDP ID)

**EPCS Identity Verification:**
> Schedule II requires 2-factor authentication (DEA token app or biometric) before electronic transmission. Federal law — no exceptions.

**PDMP Risk Flags:**
- Multiple prescribers (>2 in 90 days)
- Multiple pharmacies (>2 in 90 days)
- Total MME/day > 90 for consecutive months
- Concurrent opioid + benzodiazepine prescriptions

**PDMP Query Table Columns:**
Date Filled | Drug + Schedule | Quantity | Days Supply | MME/Day | Prescriber | Pharmacy

---

### Screen 3.2 — HL7 FHIR R4 API & HL7 v2 Interface Engine
**Epic Equivalent:** FHIR APIs + Bridges | **Cerner Equivalent:** Ignite APIs + Millennium Interfaces

**FHIR R4 Base URL:** `https://api.mdcareproviders.com/fhir/r4`  
**Standard:** US Core Implementation Guide v5.0  
**Authorization:** SMART on FHIR (OAuth2 + PKCE)

**FHIR Resources Supported (USCDI v3):**

| Resource | USCDI Required | Read | Write | Search |
|----------|---------------|------|-------|--------|
| Patient | Yes | Yes | Yes | name, identifier, birthdate |
| Encounter | Yes | Yes | Yes | patient, date, status |
| Condition | Yes | Yes | Yes | patient, clinical-status |
| MedicationRequest | Yes | Yes | Yes | patient, status, intent |
| AllergyIntolerance | Yes | Yes | Yes | patient, clinical-status |
| Observation | Yes | Yes | Yes | patient, code, date |
| DiagnosticReport | Yes | Yes | No | patient, category, date |
| DocumentReference | Yes | Yes | Yes | patient, type, date |
| Immunization | Yes | Yes | Yes | patient, date |
| Coverage | No | Yes | Yes | patient, payor |

**Active HL7 v2 Interfaces:**

| Interface | Message Type | Direction | Partner |
|-----------|-------------|-----------|---------|
| ADT Feed — CMS / Public Health | ADT A01/A03/A08 | Outbound | TN DoH / CMS |
| Lab Orders & Results | ORM O01 / ORU R01 | Bidirectional | Sunquest LIS |
| Radiology (PACS/RIS) | ORM O01 / ORU R01 | Bidirectional | GE Centricity RIS |
| Pharmacy (eRx confirmation) | RDE O11 / RDS O13 | Bidirectional | SureScripts |

**SMART on FHIR App Registry:**
- Patient Portal (MD Care web/mobile)
- Doximity eRx
- UpToDate Clinical Decision Support
- Nuance DAX AI Scribe

---

## TAB 4 — OPERATIONS SCREENS (3 Screens)

---

### Screen 4.1 — Case Management & Utilization Review
**Epic Equivalent:** Case Management | **Cerner Equivalent:** Care Management

**Key Design Elements:**
- Insurance UR criteria via InterQual / MCG
- CMS Two-Midnight Rule compliance tracking
- Medicare/Medicaid admission status determination
- Payer peer-to-peer request workflow

**Census Worklist Columns:**
Patient | Room | Payer | Primary Dx | Actual LOS | DRG Benchmark LOS | CM Assigned | UR Status | Discharge Plan

**InterQual Criteria Checklist (per patient):**
- Acute procedure/surgery documented (Y/N)
- Active IV medications required (Y/N)
- Daily skilled nursing assessment needed (Y/N)
- PT/OT goals unachievable at lower level (Y/N/Partial)
- Acute medical comorbidity preventing discharge (Y/N)

**LOS Management Bar Chart:**
- Actual LOS vs DRG Geometric Mean LOS per patient
- Patients exceeding benchmark highlighted in red

---

### Screen 4.2 — Patient Flow Board & Transfer Center
**Epic Equivalent:** Capacity Management Suite | **Cerner Equivalent:** Bed Management + TeleTracking**

**Key Design Elements:**
- Real-time bed status from ADT (updates within 5 minutes of order)
- Facility capacity map by unit with all bed states
- Transfer queue with priority levels
- 7-day occupancy trend line chart

**Bed Status Categories:**
- Occupied
- Available (Clean)
- Dirty (needs housekeeping)
- Out of Service (maintenance)

**Facility Capacity Map Columns:**
Unit | Licensed Beds | Occupied | Avail (Clean) | Dirty | Out of Svc | Pending Admit | Pending DC | Occupancy %

**Transfer Queue Priority:**
- STAT — immediate life threat
- URGENT — clinical deterioration, requires action in 1 hour
- Routine — planned transfer, scheduled within shift

**Transfer Request Fields:**
Request ID | Patient | Transfer Type (upgrade/step-down/external) | From | To | Priority | Requested Time | Status

---

### Screen 4.3 — HIPAA PHI Access Audit Log
**Epic Equivalent:** Security Audit | **Cerner Equivalent:** Audit Trail

**Key Design Elements:**
- Immutable access log — cannot be edited or deleted
- AI-assisted anomaly detection (unusual access patterns)
- Supports Accounting of Disclosures (§164.528)
- Privacy Officer alert workflow for flagged events
- Retention: 6 years (HIPAA minimum)

**PHI Access Log Columns:**
Timestamp (UTC) | User (NPI + username) | Role | Patient MRN | Record Type | Action | IP Address | Clinical Context

**Anomaly Detection Rules:**
1. User accessed >20 records in 2 hours (baseline deviation)
2. Non-care-team member accesses sensitive patient (VIP, employee, minor)
3. After-hours access from unrecognized IP
4. Bulk export of patient data without authorization

**Accounting of Disclosures Columns:**
Date | Recipient | Legal Basis | PHI Disclosed

**Legal Bases for Non-Treatment Disclosures:**
- Public health reporting exception (§164.512b)
- Treatment operations — CMS quality reporting
- Court order / law enforcement
- Patient right of access (§164.524) — requires patient authorization

---

## TAB 5 — PATIENT PORTAL

---

### Screen 5.1 — Patient Portal (MyChart-Equivalent)
**Epic Equivalent:** MyChart | **Cerner Equivalent:** HealtheLife

**ONC 21st Century Cures Compliance:**
- All 8 USCDI v3 data classes accessible to patient within 24 hours
- Zero information blocking exceptions invoked
- SMART on FHIR app integration (third-party patient apps)

**USCDI v3 Data Classes Exposed to Patient:**
1. Patient demographics
2. Allergies & intolerances
3. Clinical notes (physician, nursing, discharge)
4. Diagnostic imaging reports
5. Laboratory results
6. Medications
7. Medical problems / conditions
8. Procedures

**My Medications Table:** Medication | Dose | Frequency | Prescribing Provider

**My Conditions (Problem List):** Condition | ICD-10 | Status | Since

**My Lab Results:** Test | Result | Normal Range | Date | Flag (with plain-language column headers for non-clinical patients)

**Secure Messaging:**
- Message threads by sender (Attending MD, Nursing Team, Case Management)
- Unread message badges
- Reply to care team
- Request medical records button

**Design Note — Plain Language for Patients:**
Column headers use patient-friendly terms, e.g.:
- "Kidney function test" instead of "eGFR"
- "Bloodstream infection marker" instead of "Lactic Acid"
- "Heart rate medication" instead of "Metoprolol Tartrate"

---

## Sample Patient Data Used in Designs

**Demo Patient — MARTINEZ, John A.**
- **MRN:** 00483921
- **Age/Sex:** 68M, DOB 02/14/1958
- **Room:** 4B-12, Med/Surg
- **Attending:** Dr. Sarah Chen, MD (NPI 1234567890, DEA BC1234563)
- **Admitted:** 05/06/2026, LOS 1d 22h
- **Primary Dx:** Sepsis (A41.9) / CHF (I50.9)
- **Active Alerts:** PCN Allergy, Contact + Droplet Isolation (MRSA), Full Code, Fall Risk
- **Insurance:** Medicare Part A & B (Member ID 1EG4-TE5-MK72), AARP MedSupp Plan G
- **Key Labs:** WBC 14.2 H, Creatinine 2.4 H, eGFR 28 L, Lactate 3.1 H (Critical)
- **Assigned DRG:** MS-DRG 871 (Septicemia/Severe Sepsis w/ MCC), RW 2.0841
- **SEP-1 Status:** 3/6 elements complete, 18 minutes to deadline

---

## Key Regulatory Compliance Points

| Regulation | Requirement | Module That Addresses It |
|-----------|-------------|-------------------------|
| ONC 21st Century Cures (45 CFR §170.404) | FHIR R4 API, no information blocking, 8 USCDI classes to patient | FHIR Engine + Patient Portal |
| CMS CoP (42 CFR §482) | Nursing assessments, clinical documentation | Nursing Flowsheet, CPOE |
| HIPAA §164.312(b) | PHI audit controls, access logging | HIPAA Audit Log |
| HIPAA §164.528 | Accounting of disclosures to patient on request | Audit Log — Disclosures tab |
| DEA 21 CFR §1300 (EPCS) | 2FA for Schedule II controlled substance e-prescribing | e-Rx + EPCS module |
| State PDMP Laws (40+ states) | Query PDMP before prescribing Schedule II–V | PDMP Integration |
| CMS SEP-1 Core Measure | Sepsis bundle completion within 3 hours | Sepsis Dashboard |
| CMS HRRP | Readmission risk tracking and reduction | Case Management + Risk module |
| Joint Commission IC.02 | Infection control surveillance and isolation | Infection Control module |
| CMS ACA §6401 | Real-time eligibility verification at point of service | Prior Auth & Eligibility |
