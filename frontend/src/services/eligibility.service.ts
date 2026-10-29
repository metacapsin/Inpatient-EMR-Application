/**
 * Stedi payer directory + real-time eligibility (270/271), mirroring EMR-ng's
 * payers.service / eligibility.service against this repo's backend (routes/eligibility.js).
 */
import api from './api';

export interface PayerRow {
    /** Stedi trading-partner id (e.g. "HPQRS"). */
    stediId: string;
    displayName: string;
    /** Numeric primary payer id (e.g. "60054") — preferred for eligibility routing. */
    primaryPayerId?: string;
    aliases?: string[];
    transactions?: Record<string, string>;
}

/** The id to persist as `tradingPartnerServiceId` for a picked payer. */
export const payerTradingPartnerId = (p: PayerRow): string => p.primaryPayerId || p.stediId || '';

export class PayerDirectoryUnavailable extends Error {}

export async function searchPayers(query: string, pageSize = 10): Promise<PayerRow[]> {
    try {
        const { data } = await api.get<{ data?: { items?: PayerRow[] } }>('/Payers/search', { params: { query, pageSize } });
        return data?.data?.items ?? [];
    } catch (err: any) {
        if (err?.response?.status === 503) throw new PayerDirectoryUnavailable(err.response?.data?.message || 'Payer directory unavailable');
        throw err;
    }
}

export type EligibilityStatus = 'active' | 'inactive' | 'unknown' | 'error' | 'skipped';

export interface EligibilityBenefitLine {
    code?: string;
    name?: string;
    serviceTypeCodes?: string[];
    serviceTypes?: string[];
    benefitAmount?: string | number;
    benefitPercent?: string | number;
    timeQualifier?: string;
    timeQualifierCode?: string;
    coverageLevel?: string;
    planCoverage?: string;
    inPlanNetworkIndicatorCode?: string;
    [k: string]: unknown;
}

export interface EligibilitySummary {
    id?: string | null;
    slot?: 'primary' | 'secondary';
    status: EligibilityStatus;
    error?: string | null;
    errors?: string[];
    warnings?: string[];
    planName?: string;
    coverageStartDate?: string;
    coverageEndDate?: string;
    copay?: string | number;
    deductible?: string | number;
    outOfPocketMax?: string | number;
    inNetwork?: boolean;
    payerName?: string;
    tradingPartnerServiceId?: string;
    checkedAt?: string;
    serviceTypeCodes?: string[];
    details?: {
        groupNumber?: string;
        groupDescription?: string;
        insuranceType?: string;
        insuranceTypeCode?: string;
        coverageLevel?: string;
        planNumber?: string;
        subscriber?: { memberId?: string; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string; groupNumber?: string };
        payer?: { name?: string; payorIdentification?: string };
        provider?: { name?: string; npi?: string };
        benefits?: {
            inNetwork?: Record<string, EligibilityBenefitLine[]>;
            outOfNetwork?: Record<string, EligibilityBenefitLine[]>;
            notApplicable?: Record<string, EligibilityBenefitLine[]>;
        };
    };
}

export interface EligibilityInsuranceInput {
    insuranceCompany?: string;
    tradingPartnerServiceId?: string;
    subscriberId?: string;
    groupNumber?: string;
    [k: string]: unknown;
}

export interface EligibilityCheckPayload {
    patientId?: string | null;
    firstName: string;
    lastName: string;
    dOB: string;
    sex?: string;
    serviceTypeCodes?: string[];
    insurance?: EligibilityInsuranceInput | null;
    secondaryInsurance?: EligibilityInsuranceInput | null;
}

export interface EligibilityCheckResult {
    primary?: EligibilitySummary;
    secondary?: EligibilitySummary;
    stediEnabled: boolean;
}

/** POST /Eligibility/checkInline — per-slot summaries. History is filed when `patientId` is set. */
export async function checkInlineEligibility(payload: EligibilityCheckPayload): Promise<EligibilityCheckResult> {
    const { data } = await api.post<{ data?: { primary?: EligibilitySummary; secondary?: EligibilitySummary }; stediEnabled?: boolean }>(
        '/Eligibility/checkInline',
        payload
    );
    return { ...(data?.data ?? {}), stediEnabled: Boolean(data?.stediEnabled) };
}

/** GET /Eligibility/historyByPatient/:id — newest first. */
export async function getEligibilityHistory(patientId: string): Promise<EligibilitySummary[]> {
    const { data } = await api.get<{ data?: EligibilitySummary[] }>(`/Eligibility/historyByPatient/${encodeURIComponent(patientId)}`);
    return data?.data ?? [];
}

/** X12 EB03 service type codes offered on the Verify Coverage control (same list as EMR-ng, inpatient first). */
export const SERVICE_TYPE_OPTIONS: Array<{ code: string; label: string }> = [
    { code: '30', label: 'General (Plan Coverage)' },
    { code: '48', label: 'Hospital Inpatient' },
    { code: '47', label: 'Hospital' },
    { code: '50', label: 'Hospital Outpatient' },
    { code: '98', label: 'Professional (Office Visit)' },
    { code: 'UC', label: 'Urgent Care' },
    { code: 'MH', label: 'Mental Health' },
    { code: '88', label: 'Pharmacy' },
    { code: '35', label: 'Dental' },
    { code: 'AL', label: 'Vision' },
    { code: '33', label: 'Chiropractic' },
];

/** Stedi dates are YYYYMMDD; our inputs are YYYY-MM-DD. */
export function stediDateToYmd(v: string | undefined | null): string {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v ?? '').trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

export function formatStediDate(v: string | undefined | null): string {
    const ymd = stediDateToYmd(v);
    if (!ymd) return v ? String(v) : '—';
    const [y, m, d] = ymd.split('-');
    return `${m}/${d}/${y}`;
}

export function formatMoney(v: string | number | undefined | null): string {
    if (v === undefined || v === null || v === '') return '—';
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export interface InsuranceAutoFillPatch {
    insuranceStatus?: 'Active' | 'Inactive';
    coverageStartDate?: string;
    terminationDate?: string;
    coPayAmount?: string;
    groupNumber?: string;
    insurancePlan?: string;
    insuranceType?: string;
}

/**
 * Fields the payer answered authoritatively on the 271 (ported from EMR-ng applyEligibilityToForm).
 * Medical group / PCP / guarantor are deliberately not touched.
 */
export function eligibilityAutoFillPatch(summary: EligibilitySummary, planTypeOptions: string[]): InsuranceAutoFillPatch {
    const patch: InsuranceAutoFillPatch = {};
    if (summary.status === 'active') patch.insuranceStatus = 'Active';
    else if (summary.status === 'inactive') patch.insuranceStatus = 'Inactive';
    const start = stediDateToYmd(summary.coverageStartDate);
    if (start) patch.coverageStartDate = start;
    const end = stediDateToYmd(summary.coverageEndDate);
    if (end) patch.terminationDate = end;
    const copay = summary.copay ?? summary.details?.benefits?.inNetwork?.copay?.[0]?.benefitAmount;
    if (copay !== undefined && copay !== null && copay !== '') patch.coPayAmount = String(copay);
    const group = summary.details?.groupNumber || summary.details?.subscriber?.groupNumber;
    if (group) patch.groupNumber = String(group);
    // Plan type: match the 271's "Preferred Provider Organization (PPO)" against our option labels by abbreviation.
    const t = summary.details?.insuranceType;
    if (t) {
        const paren = /\(([^)]+)\)/.exec(t);
        const abbr = (paren ? paren[1] : t).toLowerCase();
        const found = planTypeOptions.find((o) => o.toLowerCase().startsWith(abbr) || o.toLowerCase().includes(`(${abbr})`) || o.toLowerCase().includes(abbr));
        if (found) patch.insurancePlan = found;
    }
    return patch;
}
