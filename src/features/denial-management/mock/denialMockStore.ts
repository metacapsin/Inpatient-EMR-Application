import type { ClaimDenialRecord, DenialAnalytics } from '../types/denial.types';
import { emptyDenialAppeal } from '../types/denial.types';

const TENANT = 'tenant-demo-01';

function daysFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

const seed: ClaimDenialRecord[] = [
    {
        denialId: 'den-1001',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-88421',
        patientId: 'pat-101',
        patientName: 'Elena Vasquez',
        dateOfService: daysAgo(45),
        payer: 'BlueCross PPO',
        billedAmount: 42850,
        deniedAmount: 12400,
        denialCode: 'CO-4',
        denialReason: 'Procedure code inconsistent with modifier',
        category: 'Coding',
        appealDeadline: daysFromNow(12),
        status: 'New',
        appeal: emptyDenialAppeal(),
    },
    {
        denialId: 'den-1002',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-88302',
        patientId: 'pat-102',
        patientName: 'Marcus Webb',
        dateOfService: daysAgo(30),
        payer: 'Medicare Part A',
        billedAmount: 67200,
        deniedAmount: 67200,
        denialCode: 'CO-96',
        denialReason: 'Non-covered charge(s)',
        category: 'Authorization',
        appealDeadline: daysFromNow(5),
        status: 'Working',
        appeal: { ...emptyDenialAppeal('Billing Specialist'), submittedDate: daysAgo(2) },
    },
    {
        denialId: 'den-1003',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-88110',
        patientId: 'pat-103',
        patientName: 'Priya Nair',
        dateOfService: daysAgo(60),
        payer: 'Aetna Commercial',
        billedAmount: 18900,
        deniedAmount: 4200,
        denialCode: 'CO-197',
        denialReason: 'Precertification/authorization absent',
        category: 'Authorization',
        appealDeadline: daysFromNow(2),
        status: 'Appealed',
        appeal: {
            ...emptyDenialAppeal('Revenue Cycle Lead'),
            appealLevel: 'First Level',
            appealType: 'Written',
            submittedDate: daysAgo(10),
            payerReferenceNumber: 'AET-REF-99281',
            expectedResponseDate: daysFromNow(14),
            outcome: 'Pending',
        },
    },
    {
        denialId: 'den-1004',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-87955',
        patientId: 'pat-104',
        patientName: 'Thomas Reed',
        dateOfService: daysAgo(90),
        payer: 'UnitedHealthcare',
        billedAmount: 31500,
        deniedAmount: 31500,
        denialCode: 'PR-27',
        denialReason: 'Expenses incurred after coverage terminated',
        category: 'Eligibility',
        appealDeadline: daysFromNow(20),
        status: 'Resolved',
        appeal: {
            ...emptyDenialAppeal('Appeals Coordinator'),
            outcome: 'Approved',
            outcomeDate: daysAgo(5),
            approvedAmount: 28000,
            submittedDate: daysAgo(25),
        },
    },
    {
        denialId: 'den-1005',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-87801',
        patientId: 'pat-105',
        patientName: 'Angela Brooks',
        dateOfService: daysAgo(120),
        payer: 'Cigna',
        billedAmount: 22400,
        deniedAmount: 8900,
        denialCode: 'CO-4',
        denialReason: 'Duplicate claim/service',
        category: 'Duplicate',
        appealDeadline: daysAgo(3),
        status: 'Written Off',
        appeal: {
            ...emptyDenialAppeal('Billing Manager'),
            writeOffAmount: 8900,
            writeOffApprovedBy: 'CFO Delegate',
            outcome: 'Denied',
            outcomeDate: daysAgo(8),
        },
    },
    {
        denialId: 'den-1006',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-87644',
        patientId: 'pat-106',
        patientName: 'David Cho',
        dateOfService: daysAgo(15),
        payer: 'Humana',
        billedAmount: 54100,
        deniedAmount: 15200,
        denialCode: 'CO-96',
        denialReason: 'Medical necessity not established',
        category: 'Clinical',
        appealDeadline: daysFromNow(28),
        status: 'New',
        appeal: emptyDenialAppeal(),
    },
    {
        denialId: 'den-1007',
        tenantId: TENANT,
        claimNumber: 'CLM-2025-87590',
        patientId: 'pat-107',
        patientName: 'Fatima Hassan',
        dateOfService: daysAgo(200),
        payer: 'Medicare Part A',
        billedAmount: 9800,
        deniedAmount: 9800,
        denialCode: 'CO-197',
        denialReason: 'Timely filing limit exceeded',
        category: 'Timely Filing',
        appealDeadline: daysFromNow(6),
        status: 'Working',
        appeal: emptyDenialAppeal(),
    },
];

const store = new Map<string, ClaimDenialRecord[]>();

function key(tenantId: string): string {
    return tenantId.trim() || TENANT;
}

export function ensureDenialWorklist(tenantId: string): ClaimDenialRecord[] {
    const k = key(tenantId);
    if (!store.has(k)) {
        store.set(k, seed.map((r) => ({ ...r, tenantId: k })));
    }
    return store.get(k)!;
}

export function findDenial(tenantId: string, denialId: string): ClaimDenialRecord | undefined {
    return ensureDenialWorklist(tenantId).find((r) => r.denialId === denialId);
}

export function upsertDenial(record: ClaimDenialRecord): void {
    const rows = ensureDenialWorklist(record.tenantId);
    const idx = rows.findIndex((r) => r.denialId === record.denialId);
    if (idx >= 0) rows[idx] = record;
    else rows.unshift(record);
}

export function nextDenialId(): string {
    return `den-${Date.now()}`;
}

export function analyticsForTenant(tenantId: string): DenialAnalytics {
    void ensureDenialWorklist(tenantId);
    return {
        denialByCategory: [
            { category: 'Authorization', count: 18 },
            { category: 'Coding', count: 24 },
            { category: 'Clinical', count: 11 },
            { category: 'Timely Filing', count: 7 },
            { category: 'Duplicate', count: 5 },
            { category: 'Eligibility', count: 9 },
        ],
        denialRateByPayer: [
            { payer: 'Medicare Part A', ratePercent: 8.2 },
            { payer: 'BlueCross PPO', ratePercent: 6.4 },
            { payer: 'UnitedHealthcare', ratePercent: 5.1 },
            { payer: 'Aetna Commercial', ratePercent: 4.8 },
            { payer: 'Cigna', ratePercent: 3.9 },
            { payer: 'Humana', ratePercent: 3.2 },
        ],
        topDenialCodes: [
            { code: 'CO-4', amount: 142800 },
            { code: 'CO-96', amount: 118400 },
            { code: 'CO-197', amount: 96200 },
            { code: 'PR-27', amount: 67400 },
            { code: 'CO-16', amount: 52100 },
            { code: 'CO-50', amount: 44800 },
            { code: 'CO-22', amount: 38900 },
            { code: 'CO-18', amount: 31200 },
            { code: 'CO-29', amount: 27600 },
            { code: 'CO-151', amount: 24100 },
        ],
        appealOverturnRatePercent: 34.5,
        monthlyDenialTrend: [
            { month: 'Oct', count: 42, amount: 312000 },
            { month: 'Nov', count: 38, amount: 285400 },
            { month: 'Dec', count: 51, amount: 398200 },
            { month: 'Jan', count: 47, amount: 361800 },
            { month: 'Feb', count: 44, amount: 329500 },
            { month: 'Mar', count: 39, amount: 298100 },
        ],
    };
}
