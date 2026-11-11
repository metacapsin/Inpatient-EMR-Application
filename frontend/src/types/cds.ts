import { z } from 'zod';

export const CDS_SEVERITIES = ['minor', 'moderate', 'major', 'contraindicated'] as const;
export type CdsSeverity = (typeof CDS_SEVERITIES)[number];

export const CDS_OVERRIDE_SEVERITIES = [...CDS_SEVERITIES, 'suppressed'] as const;
export type CdsOverrideSeverity = (typeof CDS_OVERRIDE_SEVERITIES)[number];

export const DRUG_TTYS = ['IN', 'SCD', 'SBD', 'BN'] as const;

export const drugHitSchema = z.object({
    rxnormCode: z.string().min(1),
    name: z.string().min(1),
    tty: z.enum(DRUG_TTYS),
});
export type DrugHit = z.infer<typeof drugHitSchema>;

export const cdsAlertSchema = z.object({
    ruleId: z.string().nullable(),
    ruleType: z.enum(['drug_drug', 'drug_allergy_class']).nullable(),
    severity: z.enum(CDS_SEVERITIES),
    message: z.string(),
    rxnormCodeA: z.string().nullable().optional(),
    rxnormCodeB: z.string().nullable().optional(),
    allergyClass: z.string().nullable().optional(),
    candidateName: z.string().optional(),
    matchedName: z.string().optional(),
    source: z.string().optional(),
});
export type CdsAlert = z.infer<typeof cdsAlertSchema>;

export const cdsOverrideSchema = z.object({
    reason: z.string().trim().min(3).max(1000),
});
export type CdsOverride = z.infer<typeof cdsOverrideSchema>;

export type CdsCheckState =
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'alerts'; alerts: CdsAlert[] }
    | { status: 'error'; message: string };

export const cdsRuleRowSchema = z.object({
    id: z.string(),
    ruleType: z.enum(['drug_drug', 'drug_allergy_class']),
    rxnormCodeA: z.string(),
    rxnormCodeB: z.string().nullable().optional(),
    allergyClass: z.string().nullable().optional(),
    defaultSeverity: z.enum(CDS_SEVERITIES),
    effectiveSeverity: z.enum(CDS_OVERRIDE_SEVERITIES),
    description: z.string(),
    source: z.string(),
    overrideSeverity: z.enum(CDS_OVERRIDE_SEVERITIES).nullable(),
    overrideSetBy: z.string().nullable().optional(),
    overrideSetAt: z.string().nullable().optional(),
});
export type CdsRuleRow = z.infer<typeof cdsRuleRowSchema>;

export const ALLERGY_CLASSES = [
    'penicillins',
    'sulfonamides',
    'salicylates',
    'opioids',
    'nsaids',
    'cephalosporins',
    'macrolides',
    'other',
] as const;
export type AllergyClass = (typeof ALLERGY_CLASSES)[number];

const RANK: Record<CdsSeverity, number> = {
    minor: 0,
    moderate: 1,
    major: 2,
    contraindicated: 3,
};

export function requiresOverride(alerts: CdsAlert[]): boolean {
    return alerts.some((a) => a.severity === 'major' || a.severity === 'contraindicated');
}

export function sortAlertsBySeverity(alerts: CdsAlert[]): CdsAlert[] {
    return [...alerts].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

export function assertNever(x: never): never {
    throw new Error(`Unexpected value: ${String(x)}`);
}
