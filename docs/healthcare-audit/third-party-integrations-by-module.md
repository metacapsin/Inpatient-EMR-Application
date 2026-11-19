# Third-Party Integrations Required, by Module

Date: 2026-11-12. This is the inventory of external services, code sets and interfaces each module needs to be production-ready for a US inpatient hospital. It is a **list only**; no integration work has been started or approved. Each row shows what exists today, what is needed, and what has to be decided or procured before engineering can begin (licence, contract, BAA, credentials).

Legend: **M** mandatory for go-live, **R** recommended, **C** conditional on scope or certification. "BAA" marks vendors that will process PHI and therefore need a Business Associate Agreement.

## Platform and security

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Multi-factor authentication | M | none | TOTP library (in-app) or identity provider (Okta/Entra ID/Auth0) with SAML/OIDC | Decision: in-app TOTP vs enterprise SSO |
| Transactional email (invites, resets, notifications) | M | Gmail SMTP, cert check disabled | Hosted SMTP/API provider with BAA option (SES, SendGrid, Postmark) | BAA; verified sending domain; remove `rejectUnauthorized:false` |
| Secrets management | M | `.env` files | Vault / AWS Secrets Manager / cloud KMS for JWT secrets, webhook secrets, API keys | Hosting decision |
| Audit log storage and SIEM | R | none | Append-only store or SIEM forwarder (Splunk, Elastic, CloudWatch) | After in-app audit log exists |
| Encryption at rest | M | none | Managed Postgres with disk encryption; optional column encryption (pgcrypto) | Hosting decision |
| Object storage for documents and photos | M | bytes in Postgres | S3-compatible storage with server-side encryption and signed URLs | BAA with cloud provider |
| Malware scanning of uploads | R | none | ClamAV or cloud AV scanning | Object storage first |
| Error and uptime monitoring | R | none | Sentry (PHI scrubbing on), status checks | BAA or PHI-scrub config |

## Hospital and staff management

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Provider identity verification | M | Luhn check on NPI only | NPPES NPI Registry API (free) | none |
| Licence verification | R | none | State board lookups or a credentialing vendor (CAQH, Verisys) | Vendor contract |
| DEA validation | C | regex only | DEA number validation via a prescribing vendor | With e-prescribing |
| Staff scheduling import | C | own scheduler | HL7 or CSV import from Kronos/UKG if the hospital uses one | Customer decision |

## Patient registration and demographics

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Address validation | R | 5-digit ZIP regex | USPS Address API or Smarty/Melissa | API key; no PHI concern beyond address |
| Race/ethnicity/language code sets | M | free-text labels | CDC Race & Ethnicity (CDC-RE) and OMB codes, ISO 639 language codes | Code tables only (no vendor) |
| Enterprise MPI / patient matching | C | name+DOB duplicate check | EMPI vendor or probabilistic matching library | Only for multi-facility deployments |
| Patient photo capture | done | data URL in DB | Move to object storage | see platform |

## Admission, bed management, discharge (ADT)

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Outbound ADT to PCP/post-acute (CMS CoP 482.24(d)) | M | HL7 v2.5 A01/A02/A03 via MLLP, HTTPS, email; `direct` not implemented | Direct Secure Messaging HISP (e.g. DataMotion, Kno2, MaxMD) and/or an interface engine (Mirth/Rhapsody) and HIE connection | HISP contract + BAA; recipient directory UI |
| Inbound ADT from ED or other systems | C | none | HL7 v2 listener (MLLP) | Interface engine |
| Code sets: admission type, point of origin, discharge status | M | free text | UB-04 code tables (NUBC) | NUBC licence for official manual; codes themselves are public |
| Bed board display boards | R | web page | none required | |

## Clinical documentation and orders

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| ICD-10-CM catalog | M | seeder exists, catalog empty on Linux | CMS/NCHS annual code file (free) with a cross-platform download step | Ops task |
| ICD-10-PCS | M | none | CMS annual PCS file (free) | Procedures module |
| SNOMED CT | R (M for ONC) | none | NLM UMLS licence (free), SNOMED CT US Edition | UMLS account |
| LOINC (document types, vitals) | R | partial table for vitals | LOINC release (free, Regenstrief licence) | none |
| Note templates / speech-to-text | C | none | Dragon Medical One / Nuance DAX, or Deepgram medical | BAA; optional |
| Nursing taxonomy (NANDA-I) | R | 10 demo rows | NANDA-I licence | Licence purchase |
| Early warning score content | R | none | Published NEWS2/MEWS definitions (no vendor) | Clinical review |

## Medication, MAR, pharmacy, CDS

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Drug database (names, RxNorm, NDC, dose forms) | M | RxNav stub (14 drugs); live mode calls NLM `/drugs.json` | NLM RxNorm API (free) for coding; a licensed drug knowledge base for dosing | Decision: RxNorm-only vs licensed KB |
| Drug-drug / drug-allergy / dose-range knowledge | M | 10 teaching rules | First Databank, Medi-Span (Wolters Kluwer) or Lexicomp | Licence + clinical validation |
| e-Prescribing network | M | stub transmit | Surescripts via a certified intermediary (DrFirst Rcopia, Veradigm, NewCrop) with NCPDP SCRIPT 2023 | Vendor contract, Surescripts certification, BAA |
| EPCS (controlled substances) | M (if prescribing controlled) | blocked | DEA-compliant two-factor via the e-Rx vendor; identity proofing | Same vendor; DEA audit |
| PDMP check | M in most states | none | State PDMP via Appriss/Bamboo Health gateway (often via e-Rx vendor) | State registration |
| Barcode medication administration | R (M for MAR safety) | none | Barcode scanners (keyboard-wedge) + NDC/UDI barcode parsing; label printer | Hardware; drug DB with NDC |
| Pharmacy inventory / ADC | C | none | Omnicell / Pyxis interface (HL7 or vendor API) | Only if hospital uses ADCs |
| Formulary | R | none | Hospital formulary file or vendor feed | Pharmacy decision |

## Laboratory

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| LIS interface | M | none | HL7 v2 ORM/OML out, ORU in (via interface engine) to the lab system (Cerner, Sunquest, Epic Beaker, Orchard) | Interface engine; lab vendor cooperation |
| Reference lab (outreach) | C | none | Quest / LabCorp HL7 or API | Contract |
| Test catalog with LOINC and CPT | M | free text | Compendium from the LIS or built in-house with LOINC | LIS first |
| Specimen labels / barcodes | R | accession number only | Label printer (Zebra ZPL) | Hardware |

## Imaging

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Radiology information system / PACS | M | stored viewer URL | HL7 ORM out, ORU/MDM in; DICOM modality worklist; web viewer (OHIF or vendor) with WADO-RS | RIS/PACS vendor cooperation |
| Appropriate use criteria (PAMA) | C | none | Qualified CDSM (e.g. CareSelect, ACR Select) | Only for Medicare advanced imaging |

## Results and critical notifications

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Secure clinical messaging / paging | R | in-app bell only | TigerConnect, Vocera, Spok, or SMS via Twilio (PHI-safe templates) | BAA; escalation policy |
| Push notifications | R | none | Web push or mobile push service | |

## Billing, insurance, revenue cycle

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Eligibility 270/271 | done (sandbox) | Stedi | Production Stedi account or alternate clearinghouse | Contract; practice NPI/EIN |
| Prior authorization 278 / FHIR PAS | R | none | Clearinghouse or payer portals; CMS-0057 FHIR Prior Auth API (2027) | Clearinghouse contract |
| Claims 837I and remittance 835 | M | none | Clearinghouse (Stedi, Availity, Change Healthcare, Waystar) | Contract; EDI enrollment per payer |
| CPT / HCPCS code sets | M | none | AMA CPT licence (paid); HCPCS from CMS (free) | AMA licence |
| DRG grouper | M | none | CMS MS-DRG Grouper (free executable/MCE) or 3M APR-DRG (paid) | Decision |
| Chargemaster | M | none | Hospital CDM import (CSV) | Customer data |
| Patient statements and payments | R | none | Payment processor with PCI scope (Stripe, InstaMed) and statement printing | PCI responsibility decision |
| Price transparency file | M (CMS) | none | Machine-readable file generator | After chargemaster |
| Tenant subscription billing | C | Stripe stub | Stripe Billing with webhooks | Business model decision |

## Interoperability and patient access

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| ONC (g)(10) conformance | C | partial FHIR R4 + SMART | Inferno test kit (free) for US Core, Bulk Data `$export`, SMART discovery | Engineering only |
| C-CDA generation and exchange | M (transitions of care) | none | C-CDA R2.1 templates; validation via NIST tooling; exchange via Direct or HIE | HISP/HIE contract |
| HIE / national networks | R | none | Carequality / CommonWell / TEFCA QHIN via a participant vendor | Contract |
| Patient portal identity proofing | R | email invite | ID verification vendor (ID.me, CLEAR) or in-person workflow | Policy decision |
| Immunization registry (IIS) | C | none | State IIS via HL7 VXU/QBP | State onboarding |
| Public health / NHSN reporting | C | none | NHSN CDA submission; eCR via AIMS | Program enrollment |
| Quality reporting (eCQM/QRDA) | C | none | QRDA I/III generation, CMS submission; may need a certified module | Decision |

## AI assistant

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| LLM for explanations/chat | C (optional) | Gemini called from the browser with a leaked key | Server-side proxy to a BAA-covered endpoint (Vertex AI, Azure OpenAI, Bedrock); consent, audit, PHI minimisation | **Rotate the current key now**; legal review before any PHI is sent |

## Appointments

| Need | Priority | Today | Required integration | Prerequisite |
|---|---|---|---|---|
| Reminders | R | none | SMS/voice/email provider (Twilio, Amazon Pinpoint) with PHI-safe templates | BAA; TCPA consent capture |
| Calendar sync | C | none | Google/Microsoft calendar APIs | Provider decision |

## Procurement checklist (what must be in place before each integration starts)

1. Signed BAA with the vendor.
2. Vendor sandbox credentials stored in the secrets manager, never in the repo.
3. Named clinical owner for any content that influences care (drug rules, critical limits, order sets).
4. Interface engine decision (Mirth Connect open source vs commercial) for all HL7 v2 traffic.
5. Test environment per vendor with synthetic patients only.
