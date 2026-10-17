import { demoPatientBySlot } from '../../../mocks/demoPatientRegistry';
import type { CarePlanDiagnosis, CarePlanDocument } from '../types/carePlan.types';
import { todayYmd } from '../utils/carePlanValidation';

function uid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function demoDiagnosis(
    nandaCode: string,
    nandaLabel: string,
    priority: CarePlanDiagnosis['priority'],
    addedBy: string
): CarePlanDiagnosis {
    const goalId = uid('goal');
    return {
        id: uid('dx'),
        nandaCode,
        nandaLabel,
        relatedTo: 'Hospitalization and altered mobility',
        evidencedBy: 'Clinical assessment and flowsheet documentation',
        priority,
        goals: [
            {
                id: goalId,
                statement: `Patient will demonstrate progress related to ${nandaLabel.toLowerCase()} within target period`,
                targetDate: todayYmd(),
                status: 'Partially Met',
                evaluationNote: '',
            },
        ],
        interventions: [
            {
                id: uid('int'),
                text: `Implement unit protocol for ${nandaLabel.toLowerCase()}`,
                frequency: 'Each Shift',
                responsibleDiscipline: 'RN',
                status: 'Active',
            },
        ],
        addedAt: new Date().toISOString(),
        addedBy,
        status: 'Active',
    };
}

export function buildEmptyCarePlanSeed(args: {
    patientId: string;
    encounterId: string;
    tenantId: string;
}): CarePlanDocument {
    return {
        id: uid('plan'),
        patientId: args.patientId,
        encounterId: args.encounterId,
        tenantId: args.tenantId,
        diagnoses: [],
        interdisciplinaryNotes: '',
        lastReviewedBy: '',
        lastReviewedByName: '',
        lastReviewedAt: null,
        version: 0,
    };
}

/** Demo seed for first registry patient when no API plan exists. */
export function buildDemoCarePlanSeed(args: {
    patientId: string;
    encounterId: string;
    tenantId: string;
}): CarePlanDocument | null {
    const p0 = demoPatientBySlot(0);
    if (args.patientId !== p0.id) return null;

    const now = new Date().toISOString();
    return {
        id: uid('plan'),
        patientId: args.patientId,
        encounterId: args.encounterId,
        tenantId: args.tenantId,
        diagnoses: [
            demoDiagnosis('00146', 'Risk for Falls', 'High', 'RN Demo'),
            demoDiagnosis('00085', 'Risk for Impaired Skin Integrity', 'Medium', 'RN Demo'),
        ],
        interdisciplinaryNotes: 'PT consulted for mobility. Dietitian aware of sodium restriction.',
        lastReviewedBy: 'staff-demo',
        lastReviewedByName: 'RN Demo',
        lastReviewedAt: now,
        version: 2,
    };
}
