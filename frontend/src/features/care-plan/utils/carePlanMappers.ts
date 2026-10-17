import type { CarePlanDocument, CarePlanDiagnosis, NandaSearchResult } from '../types/carePlan.types';

function asRecord(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

export function unwrapCarePlanPayload(body: unknown): CarePlanDocument | null {
    const root = asRecord(body);
    if (!root) return null;
    const data = (root.data ?? root.result ?? root) as unknown;
    const rec = asRecord(data);
    if (!rec) return null;
    return mapCarePlanDocument(rec);
}

export function unwrapNandaSearch(body: unknown): NandaSearchResult[] {
    const root = asRecord(body);
    if (!root) return [];
    const data = root.data ?? root.result ?? root;
    if (!Array.isArray(data)) return [];
    return data
        .map((row) => {
            const r = asRecord(row);
            if (!r) return null;
            const code = String(r.code ?? '').trim();
            const label = String(r.label ?? '').trim();
            if (!code || !label) return null;
            return { code, label, definition: String(r.definition ?? '') };
        })
        .filter(Boolean) as NandaSearchResult[];
}

function mapDiagnosis(raw: Record<string, unknown>): CarePlanDiagnosis {
    return {
        id: String(raw.id ?? ''),
        nandaCode: String(raw.nandaCode ?? ''),
        nandaLabel: String(raw.nandaLabel ?? ''),
        relatedTo: String(raw.relatedTo ?? ''),
        evidencedBy: String(raw.evidencedBy ?? ''),
        priority: (raw.priority as CarePlanDiagnosis['priority']) || 'Medium',
        goals: Array.isArray(raw.goals)
            ? raw.goals.map((g) => {
                  const gr = asRecord(g) || {};
                  return {
                      id: String(gr.id ?? ''),
                      statement: String(gr.statement ?? ''),
                      targetDate: String(gr.targetDate ?? ''),
                      status: (gr.status as CarePlanDiagnosis['goals'][0]['status']) || 'Not Met',
                      evaluationNote: String(gr.evaluationNote ?? ''),
                  };
              })
            : [],
        interventions: Array.isArray(raw.interventions)
            ? raw.interventions.map((i) => {
                  const ir = asRecord(i) || {};
                  return {
                      id: String(ir.id ?? ''),
                      text: String(ir.text ?? ''),
                      frequency: (ir.frequency as CarePlanDiagnosis['interventions'][0]['frequency']) || 'Daily',
                      responsibleDiscipline:
                          (ir.responsibleDiscipline as CarePlanDiagnosis['interventions'][0]['responsibleDiscipline']) ||
                          'RN',
                      status: (ir.status as CarePlanDiagnosis['interventions'][0]['status']) || 'Active',
                  };
              })
            : [],
        addedAt: raw.addedAt ? new Date(String(raw.addedAt)).toISOString() : new Date().toISOString(),
        addedBy: String(raw.addedBy ?? ''),
        status: (raw.status as CarePlanDiagnosis['status']) || 'Active',
    };
}

export function mapCarePlanDocument(raw: Record<string, unknown>): CarePlanDocument {
    return {
        id: String(raw._id ?? raw.id ?? ''),
        patientId: String(raw.patientId ?? ''),
        encounterId: String(raw.encounterId ?? ''),
        tenantId: String(raw.tenantId ?? ''),
        diagnoses: Array.isArray(raw.diagnoses) ? raw.diagnoses.map((d) => mapDiagnosis(asRecord(d) || {})) : [],
        interdisciplinaryNotes: String(raw.interdisciplinaryNotes ?? ''),
        lastReviewedBy: String(raw.lastReviewedBy ?? ''),
        lastReviewedByName: String(raw.lastReviewedByName ?? ''),
        lastReviewedAt: raw.lastReviewedAt ? new Date(String(raw.lastReviewedAt)).toISOString() : null,
        version: Number(raw.version ?? 1),
    };
}
