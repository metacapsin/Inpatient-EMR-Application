# US Healthcare Requirements Gap Analysis (Phase 2)

Audit date: 2026-11-12. This is an engineering gap analysis against published requirements. It is **not** a compliance determination. HIPAA, CMS Conditions of Participation and ONC certification require independent assessment by qualified privacy, security, clinical and legal reviewers; items needing that review are marked **[Review]**.

Applicability key: **M** mandatory for a covered entity / hospital, **R** recommended / industry standard, **C** conditional (depends on certification, program participation or scope).

## 1. HIPAA Privacy Rule (45 CFR Part 160, 164 Subparts A and E) — M

| Requirement | Relevance | Status | Gap | Recommendation |
|---|---|---|---|---|
| Minimum necessary (164.502(b)) | Staff should see only what their role needs | Not met | 91% of GET routes open to any role; billing/staff can read charts, notes, labs, documents | Read-side RBAC matrix; unit/assignment scoping for nurses |
| Accounting of disclosures (164.528) | Patients may request disclosure history | Not met | No disclosure log; `patient_rights_requests` is intake only; HL7/FHIR egress not reconciled to patient | Disclosure log fed by ADT notifications, FHIR access, document release |
| Notice of Privacy Practices (164.520) | Acknowledgement must be recorded | Partial | `notice_of_privacy_practices_date` text on patient; consent of type `HIPAA NPP` requires an encounter | Allow registration-time consents |
| Right of access (164.524) | Patient can obtain their record | Partial | FHIR portal exposes 8 resources; no document/ROI fulfilment workflow; results released without provider review window **[Review]** | Add ROI workflow and release policy |
| Business associates (164.502(e)) | Third parties processing PHI need a BAA | Not met | Browser-side Google Gemini call; Stedi, Gmail SMTP, pg-boss hosting are BAA questions **[Review]** | Remove client-side AI; inventory vendors |
| De-identification (164.514) | Test/demo data | Met | Seed data is synthetic | Keep synthetic data policy |

Reference: 45 CFR 164 (eCFR); HHS OCR Privacy Rule guidance.

## 2. HIPAA Security Rule (45 CFR 164 Subpart C) — M

| Safeguard | Status | Gap | Recommendation |
|---|---|---|---|
| Risk analysis (164.308(a)(1)(ii)(A)) | Not done **[Review]** | No documented risk analysis | Commission formal analysis; this audit is an input |
| Information system activity review (164.308(a)(1)(ii)(D)) | Not met | No staff audit log | Audit log middleware at `requireAuth` + privileged-action log |
| Workforce clearance / termination (164.308(a)(3)) | Partial | Deactivation lags 15 min; no access-review report | Per-request `is_active` check; access review export |
| Unique user identification (164.312(a)(2)(i)) | Met | Per-user accounts; shared seed password is dev-only | Enforce rotation on first login |
| Emergency access (164.312(a)(2)(ii)) | Not met | No break-glass; UI falsely claims server enforcement | Break-glass with reason + audit |
| Automatic logoff (164.312(a)(2)(iii)) | Not met | No idle timeout | Idle timeout + absolute session cap |
| Encryption (164.312(a)(2)(iv), (e)(2)(ii)) | Partial | TLS not enforced in app; no DB TLS; no at-rest encryption; cleartext MLLP/`http://` webhooks allowed | Enforce HTTPS, `sslmode=require`, disk/column encryption, https-only webhooks, MLLP over TLS |
| Audit controls (164.312(b)) | Not met | Only `fhir_access_log`; 401s not logged | Full audit log |
| Integrity (164.312(c)) | Partial | Signed notes immutable; but MAR and flowsheet signatures are client-supplied; note version history keeps only checksums | Server-side attribution; retain prior versions |
| Person/entity authentication (164.312(d)) | Partial | Password only; no MFA; no lockout | MFA for all staff, lockout policy |
| Transmission security (164.312(e)) | Partial | See encryption | |
| Contingency plan / backups (164.308(a)(7)) | Not addressed **[Review]** | No backup/restore procedure in repo | Document and test |

Reference: 45 CFR 164.308-164.316; NIST SP 800-66 Rev 2.

## 3. HIPAA Breach Notification Rule (164.400-414) — M

No breach detection or notification tooling is expected in the application itself, but the absence of an audit log makes breach scoping impossible. The committed Gemini key and browser-side PHI transmission should be evaluated as a potential reportable event **[Review]**.

## 4. HITECH Act — M

Strengthens the above (audit, encryption safe harbor, BA liability). Encryption at rest and in transit would give breach safe-harbor benefit; neither is present.

## 5. CMS Hospital Conditions of Participation (42 CFR Part 482) — M for Medicare-participating hospitals

| CoP | Requirement | Status | Gap |
|---|---|---|---|
| 482.24(c)(4)(i) | H&P within 24h of admission | Flag only | Deadline computed and reported; no worklist of patients with no H&P; not enforced |
| 482.24(c)(1) | Authenticated, dated, timed entries | Partial | Notes OK; MAR and flowsheet signers client-supplied |
| 482.24(c)(4)(vi) | Discharge summary with outcome, disposition, follow-up | Met (structured, signed) | Disposition free text |
| 482.24(d) (2020 IFC) | Electronic ADT event notifications to PCP/post-acute | Largely met | A01/A02/A03 real; no recipient directory UI; Direct unimplemented |
| 482.23(c) | Drugs administered per orders, verbal orders authenticated | Not met | No verbal-order workflow; MAR not scheduled |
| 482.25(b) | Pharmacy control, pharmacist review of orders | Not met | No pharmacist verification state |
| 482.43 | Discharge planning evaluation, patient/caregiver education | Partial | Checklist labels only; no structured plan |
| 482.13 | Patient rights, restraints, grievances | Partial | Rights requests intake; no restraint documentation |
| 482.42 | Infection prevention surveillance | Partial | HAI log without NHSN vocabulary/rates |
| 482.30 / 482.21 | Utilisation review, QAPI | Not met | No reporting layer |

Reference: 42 CFR 482; CMS State Operations Manual Appendix A.

## 6. CMS documentation and billing — M (for billing Medicare)

| Requirement | Status |
|---|---|
| UB-04 / 837I institutional claims | Not started |
| ICD-10-CM principal/secondary dx with POA indicators | Problem list exists; POA and principal flags absent |
| ICD-10-PCS procedures | Not started |
| MS-DRG assignment | Not started (free text in CDI) |
| Revenue codes / HCPCS / chargemaster | Not started |
| Admission type / source and discharge status codes (FL 14/15/17) | Free text |
| Important Message from Medicare, MOON (observation) | Not started |
| Price transparency machine-readable file (45 CFR 180) | Not started |

## 7. HL7 v2 — R (M in practice for lab/ADT integration)

Outbound ADT A01/A02/A03/A08 with MLLP + ACK is real. Defects: PV1-10 misused for diagnosis (should be DG1), MSH-10 length, lossy delimiter escaping, no DG1/IN1/NK1/GT1. Missing: inbound ADT, ORM/OML/ORU (lab), DFT^P03 (charges), SIU (scheduling), MDM (documents), MLLP listener, TLS.

## 8. FHIR R4 / US Core — C (M for ONC §170.315(g)(10) certification)

Served: Patient, Encounter, Condition, AllergyIntolerance, MedicationRequest, Observation (vitals + labs), Immunization, DocumentReference; SMART App Launch with PKCE. Gaps vs US Core 6/7 and g(10): no `meta.profile`; no paging with correct `total`; no `$export` Bulk Data; `.well-known/smart-configuration` not at FHIR base and relative URLs; `aud` not validated; missing Procedure, CareTeam, CarePlan/Goal, DiagnosticReport, Provenance, Location, Organization, Practitioner, Coverage, Device; Patient lacks race/ethnicity/birthsex/gender-identity extensions. Reference: HL7 US Core IG, SMART App Launch 2.x, ONC §170.315(g)(10).

## 9. USCDI v3 — C (M for certified EHR)

9 of 22 data classes served. Absent: Procedures, Care Team, Goals, Assessment & Plan, Health Concerns, Health Status Assessments (smoking, functional, pregnancy, SDOH), Provenance, Devices, Facility Information, Diagnostic Imaging, Clinical Tests, several Patient Demographics elements (gender identity, sexual orientation, tribal affiliation, occupation, interpreter). Clinical Notes: 4 of 8 types.

## 10. ICD-10-CM — M

Catalog table, CMS order-file seeder and problem-list CRUD exist. The catalog is **empty out of the box**: `backend/data/icd10/` ships only a README and the auto-download unzips via `powershell.exe`. Admission diagnosis and discharge summary final diagnoses are free text with only a regex check. No POA, no principal designation, no annual code-set update process.

## 11. ICD-10-PCS — M (inpatient procedures)

Not present anywhere.

## 12. CPT / HCPCS — C (facility professional billing, chargemaster)

Not present. Only a `CptMultiTypeahead` in the prior-auth mock UI. Note CPT licensing (AMA) is required before shipping a code set **[Review]**.

## 13. SNOMED CT — R (M for USCDI Problems/Allergies in certified EHR)

Not present. Problems are ICD-10-CM only; allergy reactions free text. SNOMED CT US Edition is free under NLM UMLS license.

## 14. LOINC — R (M for certified lab results)

`lab_results.loinc_code` is accepted and mapped to FHIR Observation, and vitals have a LOINC table in `lib/fhir/terminology.js`. No lab test catalog enforces LOINC at order time; document types lack LOINC codes.

## 15. RxNorm — R

Present on CPOE medication orders, prescriptions, allergies. Absent on legacy medication endpoints and med-rec lines. RxNav runs in stub mode (14 drugs) unless `RXNAV_MODE=live`.

## 16. NIST security guidance — R

NIST SP 800-63B (passwords: length over complexity, breached-password check, lockout/throttling, MFA): partially met (length only, IP throttle only, no MFA). NIST SP 800-66r2 (HIPAA implementation): see Section 2. NIST CSF 2.0: no logging/monitoring function.

## 17. WCAG 2.1 AA (Section 508 / ADA applicability) — R (M for federal procurement, increasingly expected)

Observed: form inputs in registration have labels, `aria-invalid`, `role="alert"`; Allergies modal is a proper dialog. Gaps: Documents/Medications/History modals lack `role="dialog"`, `aria-modal`, focus trap and Escape; most tab search inputs are unlabeled placeholders; toast-only errors; mobile clipping of the chart header (information loss); colour-only status badges in places; no skip link audit performed. Recommend an axe-core pass per screen in the UI module work.

## 18. Other applicable items

| Item | Status |
|---|---|
| ONC Information Blocking (45 CFR 171) | Truncated FHIR search results with wrong `total` is a technical information-blocking risk **[Review]** |
| 21st Century Cures / patient access to notes and results | Notes shared only when signed (good); lab results released with no provider window; no sensitive-result policy **[Review]** |
| The Joint Commission NPSG.02.03.01 (critical results) | Detection and ack exist; no read-back documentation, no targeting, no escalation timer |
| TJC NPSG.03.06.01 (med rec) | Admission/transfer/discharge rec exists; no prescriber attestation |
| DEA 21 CFR 1311 (EPCS) | Controlled prescribing is blocked outright (safe); EPCS not implemented |
| State PDMP mandates | Not implemented |
| CLIA | No performing-lab attribution on results |
| NHSN | HAI log lacks NHSN definitions and denominators |
| No Surprises Act GFE | Not applicable until patient billing exists |

## Items requiring qualified review before any compliance claim

1. Formal HIPAA risk analysis and risk management plan.
2. BAA inventory (AI vendor, Stedi, email provider, hosting, job queue) and whether the Gemini exposure is reportable.
3. Result-release and sensitive-information policies for the patient portal.
4. Clinical validation of the hardcoded lab critical-limit table, CDS rule content, and any order sets or protocols before they are used with real patients.
5. Terminology licensing (CPT, NANDA-I, any commercial drug knowledge base).
6. Record retention schedule and legal-hold requirements per state.
