import type {
    CarePlanCreatePayload,
    CarePlanDocument,
    CarePlanGoalStatusPayload,
    CarePlanUpdatePayload,
    NandaSearchResult,
} from '../types/carePlan.types';
import { mapCarePlanDocument } from '../utils/carePlanMappers';
import { todayYmd, validateDiagnosesForSave } from '../utils/carePlanValidation';
import { searchNandaCatalog } from './nandaCatalog';
import { buildEmptyCarePlanSeed, buildDemoCarePlanSeed } from './mockCarePlanData';

const plansByEncounter = new Map<string, CarePlanDocument>();

function newId(): string {
    return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function mockGetCarePlan(encounterId: string, patientId: string, tenantId: string): CarePlanDocument | null {
    const key = encounterId.trim();
    const existing = plansByEncounter.get(key);
    if (existing) return JSON.parse(JSON.stringify(existing)) as CarePlanDocument;
    if (!patientId.trim()) return null;
    const seed = buildDemoCarePlanSeed({ patientId, encounterId: key, tenantId });
    if (seed) {
        plansByEncounter.set(key, seed);
        return JSON.parse(JSON.stringify(seed)) as CarePlanDocument;
    }
    return null;
}

export async function mockCreateCarePlan(payload: CarePlanCreatePayload, reviewer: { id: string; name: string }): Promise<CarePlanDocument> {
    const err = validateDiagnosesForSave(payload.diagnoses);
    if (err) throw new Error(err);
    const enc = payload.encounterId.trim();
    if (plansByEncounter.has(enc)) throw new Error('Care plan already exists for this encounter');

    const doc = mapCarePlanDocument({
        _id: newId(),
        patientId: payload.patientId,
        encounterId: enc,
        tenantId: payload.tenantId,
        diagnoses: payload.diagnoses.map((d) => ({
            ...d,
            addedAt: d.addedAt || new Date().toISOString(),
            addedBy: d.addedBy || reviewer.name,
        })),
        interdisciplinaryNotes: payload.interdisciplinaryNotes || '',
        lastReviewedBy: reviewer.id,
        lastReviewedByName: reviewer.name,
        lastReviewedAt: new Date().toISOString(),
        version: 1,
    });
    plansByEncounter.set(enc, doc);
    return JSON.parse(JSON.stringify(doc)) as CarePlanDocument;
}

export async function mockUpdateCarePlan(
    planId: string,
    payload: CarePlanUpdatePayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    const err = validateDiagnosesForSave(payload.diagnoses);
    if (err) throw new Error(err);

    const found = [...plansByEncounter.values()].find((p) => p.id === planId);
    if (!found) throw new Error('Care plan not found');
    if (found.encounterId !== payload.encounterId.trim()) throw new Error('Encounter ownership mismatch');

    const updated: CarePlanDocument = {
        ...found,
        diagnoses: payload.diagnoses,
        interdisciplinaryNotes: payload.interdisciplinaryNotes,
        lastReviewedBy: reviewer.id,
        lastReviewedByName: reviewer.name,
        lastReviewedAt: new Date().toISOString(),
        version: (found.version || 1) + 1,
    };
    plansByEncounter.set(found.encounterId, updated);
    return JSON.parse(JSON.stringify(updated)) as CarePlanDocument;
}

export async function mockUpdateGoalStatus(
    planId: string,
    payload: CarePlanGoalStatusPayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    const found = [...plansByEncounter.values()].find((p) => p.id === planId);
    if (!found) throw new Error('Care plan not found');

    const dx = found.diagnoses.find((d) => d.id === payload.diagnosisId);
    if (!dx) throw new Error('Diagnosis not found');
    const goal = dx.goals.find((g) => g.id === payload.goalId);
    if (!goal) throw new Error('Goal not found');

    goal.status = payload.status;
    if (payload.evaluationNote !== undefined) goal.evaluationNote = payload.evaluationNote;

    const updated: CarePlanDocument = {
        ...found,
        lastReviewedBy: reviewer.id,
        lastReviewedByName: reviewer.name,
        lastReviewedAt: new Date().toISOString(),
        version: (found.version || 1) + 1,
    };
    plansByEncounter.set(found.encounterId, updated);
    return JSON.parse(JSON.stringify(updated)) as CarePlanDocument;
}

export function mockSearchNanda(q: string): NandaSearchResult[] {
    return searchNandaCatalog(q);
}

export function mockEnsureEmptyPlan(patientId: string, encounterId: string, tenantId: string): CarePlanDocument {
    const key = encounterId.trim();
    if (!plansByEncounter.has(key)) {
        plansByEncounter.set(key, buildEmptyCarePlanSeed({ patientId, encounterId: key, tenantId }));
    }
    return JSON.parse(JSON.stringify(plansByEncounter.get(key)!)) as CarePlanDocument;
}
