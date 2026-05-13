# Inpatient EMR — Module Integration Plan
**Date:** May 2026  
**Product:** MD Care Inpatient EMR  
**Benchmarked Against:** Epic EpicCare Inpatient, Oracle Health Cerner Millennium, MEDITECH Expanse, Allscripts Sunrise, CPSI TruBridge  
**Regulatory References:** ONC 21st Century Cures (45 CFR §170.404), CMS CoP (42 CFR §482), HIPAA (45 CFR §164.312), DEA EPCS (21 CFR §1300), CMS IQR/VBP FY2026

---

## Current State — Modules Already Implemented

| # | Module |
|---|--------|
| 1 | IPD Dashboard & KPIs |
| 2 | Live Bed Board |
| 3 | ADT (Admission / Discharge / Transfer) |
| 4 | Patient Facesheet / Chart Shell |
| 5 | Clinical Documentation & Physician Notes |
| 6 | Nursing Notes & Handover |
| 7 | Vital Signs |
| 8 | Medication Management & MAR |
| 9 | CPOE (Orders – partial) |
| 10 | Discharge Readiness & Charge Capture (partial) |
| 11 | Appointments & Scheduling |
| 12 | Lab Orders UI (inactive – commented out in facesheetModules.ts) |
| 13 | Allergy, Immunization, Preventive Screening |
| 14 | Visitors & Family Contacts |
| 15 | Health Monitoring & Symptom Assessment |
| 16 | AI Assistant (Google GenAI) |
| 17 | Subscription & Tenant Management (Stripe) |
| 18 | Multi-language i18n (en, es, others) |

---

## Quick Wins — Activate What Is Already in the Code

These features are partially built or stubbed and can be activated with minimal new development.

| Item | Current State | Action Needed |
|------|--------------|---------------|
| Lab Orders Tab | Route exists; commented out in `facesheetModules.ts` | Uncomment module entry; connect LIS service |
| PatientRiskList Page | Page component built; not in `routes.tsx` | Add route + sidebar link; wire ML risk API |
| Reports Page | Component exists; not routed | Add to router; connect BI service |
| ADT Sidebar Link | Route exists; sidebar link commented out | Uncomment in sidebar config |
| HIPAA Audit Headers | `X-Client-Route` & `X-Tenant-ID` already in Axios interceptors | Add server-side audit log sink; surface UI log viewer |
| Google GenAI (Sepsis Alerts) | SDK in `package.json`; AI assistant page active | Add clinical scoring prompt chain (NEWS2, qSOFA) |
| Triage Service | `triageService` referenced in codebase | Build triage flowsheet UI on top of existing service |

---

## US Regulatory & Compliance Drivers

The following mandates shape integration priority:

- **ONC 21st Century Cures Act** — FHIR R4 API, information blocking rule, USCDI data classes accessible to patients
- **CMS Conditions of Participation (CoP)** — nursing assessments, clinical documentation standards
- **HIPAA Security Rule §164.312** — PHI audit logging, access controls
- **DEA EPCS Rules** — electronic prescribing of controlled substances mandated in most US states
- **CMS IQR / VBP Programs** — Core Measures (SEP-1, etc.), HRRP readmission penalties, HCAHPS
- **Joint Commission Accreditation** — infection control (IC.02), nursing documentation, patient flow
- **State PDMP Laws** — 40+ states mandate PDMP query before prescribing controlled substances
- **ONC TEFCA** — nationwide health information exchange framework

---

## Phase 1 — Compliance & Revenue (0–6 Months)
*Priority: HIGH — legally required or revenue-blocking in the US*

### Clinical Documentation
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| Nursing Assessments & Flowsheets | Epic FlowSheets, Cerner PowerChart Nursing | Required for Joint Commission & CMS CoP | `clinical-workflows` feature; vitals already routed |
| CPOE – Full Order Sets | Epic Orders, Cerner PowerOrders | Reduces medication errors; ONC/CEHRT requirement | Orders API path exists in `clinicalApi.ts` |
| Clinical Decision Support (CDS Hooks) | Epic BPA, Cerner CDS Hooks | Mandatory for 21st Century Cures ONC certification | Alerts service exists; Google GenAI SDK in deps |

### Revenue Cycle
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| Charge Capture & CDM | Epic Charge Router, Cerner Revenue Cycle | Automates billable event capture; tied to DRG & ICD-10 | Discharge billing tabs exist; facesheet diagnoses tab |
| Claims Management (837/835 EDI) | Epic Resolute, Cerner RevElate | Federal/commercial payer submission; required for US billing | Stripe gating present; billing readiness service exists |
| Prior Authorization & Eligibility Verification | Epic Benefits Engine, Waystar/Availity | Reduces denials; CMS requires real-time eligibility (ACA §6401) | Discharge readiness service; eligibility tabs referenced |

### Interoperability
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| HL7 FHIR R4 API (Patient Access & Provider Directory) | Epic FHIR, Cerner Ignite APIs | 21st Century Cures Act / ONC mandate; enables app marketplace | Axios service layer; FHIR resources map to existing types |
| HL7 v2.x Interface Engine (ADT / Lab / Radiology) | Epic Bridges, Cerner Millennium interfaces | ADT feeds to payers, public health reporting, lab/RIS results inbound | ADT service & types well-developed; `adt.service.ts` |
| e-Prescribing & EPCS (SureScripts) | Epic e-Prescribing, Cerner eRx | DEA EPCS mandate for controlled substances in most US states | `medicationManagement` service; discharge meds tab exists |
| PDMP (Prescription Drug Monitoring Program) | Epic PDMP, Cerner PDMP | Mandated in 40+ US states before prescribing controlled substances | Medication management module; can be a CDS hook trigger |

### Operational
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| Case Management & Utilization Review | Epic Case Management, Cerner Care Management | Insurance UR/PA, CM assignments, InterQual/MCG criteria, LOS tracking | Discharge readiness context; bed board; patient location service |
| Patient Flow & Transfer Center | Epic Capacity Management Suite, TeleTracking | Real-time capacity, inter-facility transfers, diversion management | Transfer modal on Dashboard; live bed board module |

### Compliance & Quality
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| HIPAA PHI Audit Log & Access Management | Epic Security, Cerner Audit Trail | HIPAA §164.312(b) technical safeguard; breach detection | `X-Client-Route` & `X-Tenant-ID` audit headers already in Axios |
| Infection Control & Isolation Orders | Epic Infection Control, Cerner Infection Surveillance | HAI prevention; CDC/NHSN reporting; Joint Commission standard IC.02 | Clinical orders module; patient location/bed board |

### Patient Engagement
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| Patient Portal (MyChart-equivalent) | Epic MyChart, Cerner HealtheLife | 21st Century Cures requires 8 USCDI data classes accessible to patient | FHIR API module above; facesheet tabs are chart content |

### Analytics & AI
| Module | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------------|-----------------|--------------------------|
| Sepsis & Early Warning Score Alerts | Epic Deterioration Index, Cerner Sepsis Advisor | CMS SEP-1 Core Measure; reduces mortality; triggers bundle orders | Clinical-workflows alerts API; vitals data; AI SDK in deps |

---

## Phase 2 — Operational Depth (6–14 Months)
*Priority: MEDIUM*

| Module | Category | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------|----------------|-----------------|--------------------------|
| ICU / Critical Care Module | Clinical Documentation | Epic ICIP, Cerner CriticalCare | Continuous vitals, ventilator parameters, APACHE/SOFA scoring | Vitals + clinical-workflows can be extended |
| OR / Surgical Procedure Documentation | Clinical Documentation | Epic OpTime, Cerner SurgiNet | Needed for surgical facilities; captures implants, counts, consent | No current hook — new module |
| Denial Management & AR Follow-up | Revenue Cycle | Epic Denial Workqueue, Cerner Denials | Tracks and works denied claims; improves net collection rate | No current hook — extends claims module |
| HIE / Carequality / CommonWell / TEFCA | Interoperability | Epic Care Everywhere, Cerner Seamless Exchange | Nationwide patient record retrieval; TEFCA mandated under ONC rule | Facesheet history/documents tabs; API service layer |
| LIS Bidirectional Interface | Interoperability | Epic Beaker, Cerner PathNet | Orders out to LIS; results back to chart automatically | Lab-orders tab commented out in `facesheetModules.ts` — ready to activate |
| PACS / RIS Integration | Interoperability | Epic Radiant, Cerner RadNet | Imaging orders and results within the clinical chart | Documents tab in facesheet; API service can be extended |
| Staff Scheduling & Workforce Management | Operational | Epic Optime Staffing, Cerner Clairvia | Nurse-to-patient ratio compliance, shift management, overtime tracking | No current hook — new module |
| Release of Information (ROI) & Consent Management | Operational | Epic ROI, Cerner HIM | HIPAA-compliant disclosure tracking; patient authorization workflows | Documents tab; visitors/contacts service; audit headers present |
| eCQM / Core Measures Reporting | Compliance & Quality | Epic Reporting Workbench, Cerner HealtheIntent Quality | CMS IQR/VBP programs; HCAHPS; TJC ORYX submission | No current hook — analytics/reporting module needed |
| Patient Safety / Incident Reporting | Compliance & Quality | Epic Safety Reporting, QuantumLeap Safety | Near-miss / adverse event capture; RCA workflow; accreditation | Alerts service; health alerts page |
| Patient Communication (SMS/Email/Portal Messaging) | Patient Engagement | Epic MyChart Messaging, Klara, Relatient | Discharge instructions, follow-up reminders, readmission reduction | Visitors/contacts service; health-monitoring pages |
| Readmission Risk Prediction (ML) | Analytics & AI | Epic Predictive Risk, Cerner HealtheIntent | CMS HRRP penalizes excess readmissions; targets care transitions | `PatientRiskList` page exists (unrouted); Google GenAI in deps |
| Clinical & Operational Business Intelligence | Analytics & AI | Epic Reporting Workbench / Radar, Cerner HealtheIntent | LOS, occupancy, cost-per-case, payer mix dashboards | IPD Dashboard + Chart.js in deps; Reports page (unrouted) |
| Emergency Department (ED) Module | Specialty | Epic EpicCare Emergency, Cerner FirstNet | Triage, tracking board, ESI scoring, fast-track workflows | `triageService` referenced in codebase |

---

## Phase 3 — Specialty & Growth (14+ Months)
*Priority: LOW*

| Module | Category | Vendor Parallel | US Business Case | Existing Hook in Codebase |
|--------|----------|----------------|-----------------|--------------------------|
| Anesthesia Record | Clinical Documentation | Epic Anesthesia, Cerner AnesthesiaSuite | Required for CRNA / anesthesiologist documentation | No current hook — new module |
| Telehealth / Virtual Visits | Patient Engagement | Epic Video Visit, Amwell, Teladoc API | Post-discharge follow-ups; rounding; CMS reimbursable since 2020 | Appointments calendar; AI assistant page |
| Labor & Delivery (L&D) Module | Specialty | Epic Stork, Cerner OB Tracing | Fetal monitoring strips, partogram, newborn admission automation | No current hook — specialty add-on |
| Post-Acute / SNF / Home Health | Specialty | Epic Skilled Nursing, PointClickCare | Continuum of care after inpatient; MDS assessments, OASIS | Discharge module; patient location service |
| Oncology Module | Specialty | Epic Beacon, Cerner Oncology | Chemotherapy order sets, regimen management, infusion tracking | No current hook — specialty add-on |
| Behavioral Health | Specialty | Netsmart myAvatar, Epic Behavioral Health | Involuntary holds, mental status exams, treatment plans | No current hook — specialty add-on |
| Population Health Management | Analytics & AI | Epic Healthy Planet, Cerner HealtheIntent | Risk stratification, gap-in-care alerts, value-based care contracts | AI assistant; health monitoring pages |

---

## Summary Count

| Priority | Count |
|----------|-------|
| High (Phase 1) | 16 modules |
| Medium (Phase 2) | 14 modules |
| Low (Phase 3) | 7 modules |
| **Total proposed** | **37 modules** |
| Already implemented | 18 modules |
| Quick wins (activate existing stubs) | 7 items |
