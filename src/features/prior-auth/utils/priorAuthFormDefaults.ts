import type { PriorAuthFormValues } from '../types/priorAuth.types';
import { dummyInsuranceDefaults, type PriorAuthInsuranceDefaults } from './priorAuthInsuranceFill';

export function computeUsedUnitsDummy(approvedUnits: number): number {
    if (approvedUnits <= 0) return 0;
    return Math.min(approvedUnits, Math.max(1, Math.floor(approvedUnits * 0.35)));
}

export function emptyPriorAuthForm(insurance?: PriorAuthInsuranceDefaults): PriorAuthFormValues {
    const ins = insurance ?? dummyInsuranceDefaults();
    const today = new Date().toISOString();
    return {
        serviceType: 'Inpatient Stay',
        serviceDescription: '',
        icd10Codes: [],
        cptCodes: [],
        insurancePayer: ins.insurancePayer,
        payerName: ins.payerName,
        authNumber: '',
        requestedDate: today,
        authStartDate: today,
        authEndDate: '',
        approvedUnits: 0,
        status: 'Not Started',
        urgentFlag: false,
        denialReason: '',
        payerContact: '',
        notes: '',
    };
}

export function recordToFormValues(
    record: PriorAuthFormValues & { usedUnits?: number }
): PriorAuthFormValues {
    const { usedUnits: _u, ...rest } = record as PriorAuthFormValues & { usedUnits?: number };
    return { ...rest };
}
