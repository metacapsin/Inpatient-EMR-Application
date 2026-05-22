import type { PriorAuthRecord } from '../types/priorAuth.types';
import { computeUsedUnitsDummy } from '../utils/priorAuthFormDefaults';

function daysFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

function daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

export function buildPriorAuthMockSeed(
    patientId: string,
    encounterId: string,
    tenantId: string
): PriorAuthRecord[] {
    const tid = tenantId.trim() || 'tenant-demo-01';
    const approvedUnits = 14;
    return [
        {
            authId: `pa-seed-${encounterId}-1`,
            encounterId,
            patientId,
            tenantId: tid,
            serviceType: 'Inpatient Stay',
            serviceDescription: 'Acute inpatient medical stay',
            icd10Codes: ['J18.9'],
            cptCodes: ['99223'],
            insurancePayer: 'Commercial PPO',
            payerName: 'BlueCross Health Plan',
            authNumber: 'PA-2026-88421',
            requestedDate: daysAgo(12),
            authStartDate: daysAgo(10),
            authEndDate: daysFromNow(2),
            approvedUnits,
            usedUnits: computeUsedUnitsDummy(approvedUnits),
            status: 'Approved',
            urgentFlag: false,
            denialReason: '',
            payerContact: '800-555-0199',
            notes: 'Inpatient medical authorization',
        },
        {
            authId: `pa-seed-${encounterId}-2`,
            encounterId,
            patientId,
            tenantId: tid,
            serviceType: 'Imaging',
            serviceDescription: 'CT chest with contrast',
            icd10Codes: ['R91.8'],
            cptCodes: ['71260'],
            insurancePayer: 'Commercial PPO',
            payerName: 'BlueCross Health Plan',
            authNumber: 'PA-2026-77102',
            requestedDate: daysAgo(3),
            authStartDate: daysAgo(2),
            authEndDate: daysFromNow(5),
            approvedUnits: 1,
            usedUnits: 0,
            status: 'Pending',
            urgentFlag: true,
            denialReason: '',
            payerContact: '800-555-0199',
            notes: '',
        },
    ];
}
