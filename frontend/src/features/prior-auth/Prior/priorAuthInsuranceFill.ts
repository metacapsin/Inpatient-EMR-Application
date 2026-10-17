import { DEFAULT_INSURANCE_PAYER, DEFAULT_PAYER_NAME } from '../constants/priorAuthOptions';

export type PriorAuthInsuranceDefaults = {
    insurancePayer: string;
    payerName: string;
};

function pickString(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

/** Pull primary insurance from demographics API shape (same as Demographics insurance tab). */
export function insuranceDefaultsFromDemographicsPayload(data: unknown): PriorAuthInsuranceDefaults {
    const root = data as Record<string, unknown> | null;
    const inner = (root?.data ?? root) as Record<string, unknown> | undefined;
    const demo = (inner?.demographics ?? inner) as Record<string, unknown> | undefined;
    const ins = (demo?.insurance ?? demo?.insuranceDetails) as Record<string, unknown> | undefined;
    if (!ins || typeof ins !== 'object') {
        return { insurancePayer: DEFAULT_INSURANCE_PAYER, payerName: DEFAULT_PAYER_NAME };
    }
    const insuranceType =
        pickString(ins.insuranceType) || pickString(ins.insuranceCompany) || DEFAULT_INSURANCE_PAYER;
    const payerName = pickString(ins.insuranceCompany) || pickString(ins.insurancePlan) || DEFAULT_PAYER_NAME;
    return {
        insurancePayer: insuranceType,
        payerName,
    };
}

export function dummyInsuranceDefaults(): PriorAuthInsuranceDefaults {
    return { insurancePayer: DEFAULT_INSURANCE_PAYER, payerName: DEFAULT_PAYER_NAME };
}
