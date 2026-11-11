// @ts-check
import { z } from 'zod';

export const CDS_SEVERITIES = /** @type {const} */ (['minor', 'moderate', 'major', 'contraindicated']);
export const CDS_OVERRIDE_SEVERITIES = /** @type {const} */ (['minor', 'moderate', 'major', 'contraindicated', 'suppressed']);
export const CDS_OUTCOMES = /** @type {const} */ (['blocked', 'overridden', 'advisory']);
export const CDS_CONTEXT_TYPES = /** @type {const} */ (['cpoe_order', 'prescription_sign', 'med_rec']);
export const CDS_RULE_TYPES = /** @type {const} */ (['drug_drug', 'drug_allergy_class']);
export const DRUG_TTYS = /** @type {const} */ (['IN', 'SCD', 'SBD', 'BN']);

export const cdsSeveritySchema = z.enum(CDS_SEVERITIES);
export const cdsOverrideSeveritySchema = z.enum(CDS_OVERRIDE_SEVERITIES);

export const drugHitSchema = z.object({
    rxnormCode: z.string().min(1),
    name: z.string().min(1),
    tty: z.enum(DRUG_TTYS),
});
/** @typedef {z.infer<typeof drugHitSchema>} DrugHit */

export const cdsCandidateSchema = z.object({
    rxnormCode: z.string().trim().min(1).max(20).nullable().optional(),
    name: z.string().trim().min(1).max(200),
});
/** @typedef {z.infer<typeof cdsCandidateSchema>} CdsCandidate */

export const cdsAlertSchema = z.object({
    ruleId: z.string().nullable(),
    ruleType: z.enum(CDS_RULE_TYPES).nullable(),
    severity: cdsSeveritySchema,
    message: z.string(),
    rxnormCodeA: z.string().nullable().optional(),
    rxnormCodeB: z.string().nullable().optional(),
    allergyClass: z.string().nullable().optional(),
    candidateName: z.string().optional(),
    matchedName: z.string().optional(),
    source: z.string().optional(),
});
/** @typedef {z.infer<typeof cdsAlertSchema>} CdsAlert */

export const cdsOverrideSchema = z.object({
    reason: z.string().trim().min(3).max(1000),
});
/** @typedef {z.infer<typeof cdsOverrideSchema>} CdsOverride */

export const cdsCheckBodySchema = z.object({
    patientId: z.string().min(1),
    candidates: z.array(cdsCandidateSchema).min(1).max(50),
});

export const ALLERGY_CLASSES = /** @type {const} */ ([
    'penicillins',
    'sulfonamides',
    'salicylates',
    'opioids',
    'nsaids',
    'cephalosporins',
    'macrolides',
    'other',
]);
