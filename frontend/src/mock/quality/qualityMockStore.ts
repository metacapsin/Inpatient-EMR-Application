import type {
    ComplianceStatus,
    MeasureElement,
    PatientComplianceRow,
    QualityDashboardResponse,
    QualityMeasureEncounterResponse,
    UpdateMeasureElementPayload,
    BundleKey,
} from '../../types/quality';
import { BUNDLE_LABELS } from '../../constants/quality/bundles';
import { getQualityUnitById } from '../../constants/quality/units';
import { QUALITY_STAFF_OPTIONS } from '../../constants/quality/staff';

const MOCK_LATENCY_MS = { min: 400, max: 900 };

export function mockDelay(): Promise<void> {
    const ms = MOCK_LATENCY_MS.min + Math.random() * (MOCK_LATENCY_MS.max - MOCK_LATENCY_MS.min);
    return new Promise((r) => setTimeout(r, ms));
}

type PatientSeed = {
    encounterId: string;
    measureId: string;
    patientName: string;
    mrn: string;
    roomNumber: string;
    losDays: number;
    highRisk: boolean;
    bundles: Partial<Record<BundleKey, { status: ComplianceStatus; score: number; overdueCount: number }>>;
    overallScore: number;
};

function cell(
    status: ComplianceStatus,
    score: number,
    overdueCount = 0,
): { status: ComplianceStatus; score: number; overdueCount: number } {
    return { status, score, overdueCount };
}

const ICU_PATIENTS: PatientSeed[] = [
    {
        encounterId: 'enc-icu-2401',
        measureId: 'qm-icu-2401',
        patientName: 'Robert Henderson',
        mrn: 'MRN-104882',
        roomNumber: 'ICU-412',
        losDays: 4,
        highRisk: true,
        bundles: {
            sep1: cell('deficient', 42, 2),
            vte: cell('compliant', 100, 0),
            glycemic: cell('pending', 68, 1),
            cauti: cell('compliant', 95, 0),
            clabsi: cell('compliant', 100, 0),
            fall: cell('na', 0, 0),
            pressure: cell('pending', 72, 1),
        },
        overallScore: 68,
    },
    {
        encounterId: 'enc-icu-2402',
        measureId: 'qm-icu-2402',
        patientName: 'Maria Santos',
        mrn: 'MRN-098441',
        roomNumber: 'ICU-408',
        losDays: 2,
        highRisk: true,
        bundles: {
            sep1: cell('pending', 78, 1),
            vte: cell('compliant', 100, 0),
            glycemic: cell('compliant', 92, 0),
            cauti: cell('pending', 65, 1),
            clabsi: cell('compliant', 100, 0),
            fall: cell('na', 0, 0),
            pressure: cell('compliant', 88, 0),
        },
        overallScore: 82,
    },
    {
        encounterId: 'enc-icu-2403',
        measureId: 'qm-icu-2403',
        patientName: 'James Whitfield',
        mrn: 'MRN-112903',
        roomNumber: 'ICU-415',
        losDays: 7,
        highRisk: true,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('deficient', 45, 2),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('pending', 70, 1),
            fall: cell('na', 0, 0),
            pressure: cell('deficient', 55, 2),
        },
        overallScore: 61,
    },
];

const MED_SURG_PATIENTS: PatientSeed[] = [
    {
        encounterId: 'enc-ms-3101',
        measureId: 'qm-ms-3101',
        patientName: 'Patricia Nguyen',
        mrn: 'MRN-087221',
        roomNumber: '6E-214',
        losDays: 3,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('compliant', 90, 0),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 95, 0),
            pressure: cell('compliant', 100, 0),
        },
        overallScore: 96,
    },
    {
        encounterId: 'enc-ms-3102',
        measureId: 'qm-ms-3102',
        patientName: 'William Brooks',
        mrn: 'MRN-091556',
        roomNumber: '6E-218',
        losDays: 5,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('pending', 75, 1),
            glycemic: cell('compliant', 88, 0),
            cauti: cell('pending', 66, 1),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 100, 0),
            pressure: cell('pending', 70, 1),
        },
        overallScore: 78,
    },
    {
        encounterId: 'enc-ms-3103',
        measureId: 'qm-ms-3103',
        patientName: 'Linda Crawford',
        mrn: 'MRN-076334',
        roomNumber: '6E-206',
        losDays: 2,
        highRisk: true,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('pending', 72, 1),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('deficient', 48, 2),
            pressure: cell('compliant', 92, 0),
        },
        overallScore: 74,
    },
    {
        encounterId: 'enc-ms-3104',
        measureId: 'qm-ms-3104',
        patientName: 'Thomas Rivera',
        mrn: 'MRN-103772',
        roomNumber: '6E-221',
        losDays: 1,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('pending', 80, 1),
            glycemic: cell('compliant', 100, 0),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('pending', 68, 1),
            pressure: cell('compliant', 100, 0),
        },
        overallScore: 86,
    },
];

const STEP_DOWN_PATIENTS: PatientSeed[] = [
    {
        encounterId: 'enc-sd-2201',
        measureId: 'qm-sd-2201',
        patientName: 'Dorothy Kim',
        mrn: 'MRN-065118',
        roomNumber: '3W-302',
        losDays: 4,
        highRisk: true,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('compliant', 94, 0),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 100, 0),
            pressure: cell('pending', 78, 1),
        },
        overallScore: 91,
    },
    {
        encounterId: 'enc-sd-2202',
        measureId: 'qm-sd-2202',
        patientName: 'George Patterson',
        mrn: 'MRN-088902',
        roomNumber: '3W-308',
        losDays: 6,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('pending', 70, 1),
            cauti: cell('pending', 62, 1),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 95, 0),
            pressure: cell('compliant', 90, 0),
        },
        overallScore: 80,
    },
];

const TELEMETRY_PATIENTS: PatientSeed[] = [
    {
        encounterId: 'enc-tel-5101',
        measureId: 'qm-tel-5101',
        patientName: 'Susan Mitchell',
        mrn: 'MRN-094201',
        roomNumber: '5S-514',
        losDays: 3,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('compliant', 96, 0),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 100, 0),
            pressure: cell('compliant', 100, 0),
        },
        overallScore: 98,
    },
    {
        encounterId: 'enc-tel-5102',
        measureId: 'qm-tel-5102',
        patientName: 'Richard Adams',
        mrn: 'MRN-101445',
        roomNumber: '5S-507',
        losDays: 2,
        highRisk: true,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('pending', 72, 1),
            glycemic: cell('deficient', 50, 2),
            cauti: cell('compliant', 100, 0),
            clabsi: cell('na', 0, 0),
            fall: cell('pending', 74, 1),
            pressure: cell('compliant', 88, 0),
        },
        overallScore: 76,
    },
    {
        encounterId: 'enc-tel-5103',
        measureId: 'qm-tel-5103',
        patientName: 'Barbara Ellis',
        mrn: 'MRN-072889',
        roomNumber: '5S-511',
        losDays: 4,
        highRisk: false,
        bundles: {
            sep1: cell('na', 0, 0),
            vte: cell('compliant', 100, 0),
            glycemic: cell('compliant', 90, 0),
            cauti: cell('pending', 68, 1),
            clabsi: cell('na', 0, 0),
            fall: cell('compliant', 92, 0),
            pressure: cell('pending', 76, 1),
        },
        overallScore: 84,
    },
];

const UNIT_PATIENTS: Record<string, PatientSeed[]> = {
    'unit-icu-4n': ICU_PATIENTS,
    'unit-ms-6e': MED_SURG_PATIENTS,
    'unit-sd-3w': STEP_DOWN_PATIENTS,
    'unit-tel-5s': TELEMETRY_PATIENTS,
};

function seedToRow(seed: PatientSeed): PatientComplianceRow {
    const defaultNa = cell('na', 0, 0);
    const keys: BundleKey[] = ['sep1', 'vte', 'glycemic', 'cauti', 'clabsi', 'fall', 'pressure'];
    const bundles = {} as PatientComplianceRow['bundles'];
    for (const k of keys) {
        bundles[k] = seed.bundles[k] ?? defaultNa;
    }
    const overallStatus: ComplianceStatus =
        seed.overallScore >= 85 ? 'compliant' : seed.overallScore >= 70 ? 'pending' : 'deficient';
    return {
        encounterId: seed.encounterId,
        measureId: seed.measureId,
        patientName: seed.patientName,
        mrn: seed.mrn,
        roomNumber: seed.roomNumber,
        losDays: seed.losDays,
        highRisk: seed.highRisk,
        bundles,
        overall: { score: seed.overallScore, status: overallStatus },
    };
}

function buildSparkline(base: number, variance: number, len = 7): number[] {
    const out: number[] = [];
    for (let i = 0; i < len; i++) {
        out.push(Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * variance))));
    }
    return out;
}

function aggregateKpis(rows: PatientComplianceRow[]) {
    let compliant = 0;
    let pending = 0;
    let deficient = 0;
    let na = 0;
    let activeDeficiencies = 0;
    let overdueElements = 0;
    let highRisk = 0;
    let totalScore = 0;
    let scoredPatients = 0;

    for (const row of rows) {
        if (row.highRisk) highRisk++;
        totalScore += row.overall.score;
        scoredPatients++;
        for (const b of Object.values(row.bundles)) {
            if (b.status === 'compliant') compliant++;
            else if (b.status === 'pending') pending++;
            else if (b.status === 'deficient') {
                deficient++;
                activeDeficiencies++;
            } else na++;
            overdueElements += b.overdueCount;
        }
    }

    const overallCompliancePct =
        scoredPatients > 0 ? Math.round(totalScore / scoredPatients) : 0;
    const bundleCompletionRate =
        rows.length > 0
            ? Math.round(
                  ((compliant + pending) / Math.max(1, compliant + pending + deficient + na)) * 100,
              )
            : 0;

    return {
        kpis: {
            totalPatients: rows.length,
            overallCompliancePct,
            activeDeficiencies,
            overdueBundleElements: overdueElements,
            highRiskPatients: highRisk,
            bundleCompletionRate,
            sparklines: {
                totalPatients: buildSparkline(rows.length, 2),
                overallCompliance: buildSparkline(overallCompliancePct, 8),
                activeDeficiencies: buildSparkline(activeDeficiencies, 4),
                overdueElements: buildSparkline(overdueElements, 3),
                highRisk: buildSparkline(highRisk, 2),
                completionRate: buildSparkline(bundleCompletionRate, 6),
            },
        },
        complianceSummary: { compliant, pending, deficient, na },
    };
}

const ELEMENT_TEMPLATES: Record<BundleKey, string[]> = {
    sep1: [
        'Blood cultures ordered within 3h',
        'Broad-spectrum antibiotics within 3h',
        'Lactate measured within 3h',
        'IV fluid bolus if lactate ≥4',
        'Vasopressors if MAP <65 after fluids',
    ],
    vte: [
        'Risk assessment within 24h',
        'Pharmacological prophylaxis',
        'Mechanical prophylaxis if contraindicated',
    ],
    glycemic: [
        'Hypoglycemia management protocol',
        'Insulin protocol ordered',
        'Point-of-care glucose monitoring',
    ],
    cauti: [
        'Foley indication documented',
        'Daily necessity reassessment',
        'Removal of unnecessary foley',
    ],
    clabsi: [
        'Central line necessity documented',
        'Daily line necessity review',
        'CHG bath per protocol',
    ],
    fall: [
        'Morse Fall Scale completed',
        'High-risk interventions documented',
        'Fall precautions active',
    ],
    pressure: [
        'Braden scale completed',
        'Turning schedule documented',
        'Pressure redistribution surface',
    ],
};

const elementStore = new Map<string, MeasureElement[]>();

function buildElements(measureId: string, bundleKey: BundleKey): MeasureElement[] {
    const cached = elementStore.get(`${measureId}:${bundleKey}`);
    if (cached) return cached.map((e) => ({ ...e }));

    const names = ELEMENT_TEMPLATES[bundleKey];
    const statuses: ComplianceStatus[] = ['compliant', 'pending', 'deficient', 'compliant', 'pending'];
    const elements: MeasureElement[] = names.map((name, i) => {
        const status = statuses[i % statuses.length];
        const now = Date.now();
        const due = new Date(now + (status === 'pending' ? 2 : -1) * 3600000).toISOString();
        const completed =
            status === 'compliant'
                ? new Date(now - 3600000).toISOString()
                : null;
        const completedBy =
            status === 'compliant' ? QUALITY_STAFF_OPTIONS[i % QUALITY_STAFF_OPTIONS.length].name : null;
        const overdueBy =
            status === 'deficient' ? '2h 15m' : status === 'pending' ? null : null;
        return {
            id: `${measureId}-el-${bundleKey}-${i}`,
            elementName: name,
            status,
            dueBy: status === 'na' ? null : due,
            completedAt: completed,
            completedBy,
            overdueBy,
            notes: status === 'deficient' ? 'Awaiting physician order verification.' : null,
            assignTo:
                status === 'pending' || status === 'deficient'
                    ? QUALITY_STAFF_OPTIONS[(i + 1) % QUALITY_STAFF_OPTIONS.length].id
                    : null,
        };
    });
    elementStore.set(`${measureId}:${bundleKey}`, elements);
    return elements.map((e) => ({ ...e }));
}

export async function getMockDashboard(unitId: string): Promise<QualityDashboardResponse> {
    await mockDelay();
    const unit = getQualityUnitById(unitId);
    const seeds = UNIT_PATIENTS[unitId] ?? MED_SURG_PATIENTS;
    const patients = seeds.map(seedToRow);
    const { kpis, complianceSummary } = aggregateKpis(patients);

    return {
        unitId,
        unitName: unit?.label ?? 'Unit',
        unitType: unit?.unitType ?? 'med-surg',
        lastEvaluatedAt: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
        kpis,
        complianceSummary,
        patients,
    };
}

export async function getMockEncounterMeasure(
    encounterId: string,
    bundleKey: BundleKey,
): Promise<QualityMeasureEncounterResponse | null> {
    await mockDelay();
    for (const seeds of Object.values(UNIT_PATIENTS)) {
        const seed = seeds.find((s) => s.encounterId === encounterId);
        if (seed) {
            return {
                encounterId: seed.encounterId,
                measureId: seed.measureId,
                patientName: seed.patientName,
                mrn: seed.mrn,
                roomNumber: seed.roomNumber,
                unitId: Object.entries(UNIT_PATIENTS).find(([, list]) =>
                    list.some((p) => p.encounterId === encounterId),
                )?.[0] ?? 'unit-ms-6e',
                bundleKey,
                bundleLabel: BUNDLE_LABELS[bundleKey],
                elements: buildElements(seed.measureId, bundleKey),
            };
        }
    }
    return null;
}

export async function mockUpdateElement(
    measureId: string,
    payload: UpdateMeasureElementPayload,
): Promise<MeasureElement | null> {
    await mockDelay();
    for (const [, elements] of elementStore) {
        const idx = elements.findIndex((e) => e.id === payload.elementId && measureId.startsWith('qm'));
        if (idx >= 0) {
            const el = elements[idx];
            if (payload.notes !== undefined) el.notes = payload.notes;
            if (payload.assignTo !== undefined) {
                el.assignTo = payload.assignTo;
                const staff = QUALITY_STAFF_OPTIONS.find((s) => s.id === payload.assignTo);
                if (staff && payload.assignTo) {
                    el.notes = el.notes ?? `Assigned to ${staff.name}.`;
                }
            }
            return { ...el };
        }
    }
    for (const key of elementStore.keys()) {
        if (!key.startsWith(measureId.split('-').slice(0, 2).join('-'))) continue;
        const list = elementStore.get(key);
        if (!list) continue;
        const el = list.find((e) => e.id === payload.elementId);
        if (el) {
            if (payload.notes !== undefined) el.notes = payload.notes;
            if (payload.assignTo !== undefined) el.assignTo = payload.assignTo;
            return { ...el };
        }
    }
    return null;
}

export async function mockEvaluateEncounter(encounterId: string): Promise<{ evaluatedAt: string }> {
    await mockDelay();
    return { evaluatedAt: new Date().toISOString() };
}

/** In-memory search/filter helper for dashboard rows */
export function filterDashboardPatients(
    patients: PatientComplianceRow[],
    search: string,
): PatientComplianceRow[] {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
        (p) =>
            p.patientName.toLowerCase().includes(q) ||
            p.mrn.toLowerCase().includes(q) ||
            p.roomNumber.toLowerCase().includes(q),
    );
}
