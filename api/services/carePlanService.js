const { randomUUID } = require('crypto');
const { CarePlan } = require('../models/CarePlan');
const { NandaDiagnosis, ensureNandaSeed } = require('../models/NandaDiagnosis');

const GOAL_STATUSES = ['Not Met', 'Partially Met', 'Met'];
const DIAGNOSIS_STATUSES = ['Active', 'Resolved', 'Discontinued'];

function todayYmd() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

function isPastDateYmd(ymd) {
    if (!ymd || typeof ymd !== 'string') return false;
    const t = new Date(`${ymd}T12:00:00`).getTime();
    const today = new Date(`${todayYmd()}T12:00:00`).getTime();
    return !Number.isNaN(t) && t < today;
}

function serializePlan(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        ...o,
        id: String(o._id || o.id),
        _id: String(o._id || o.id),
    };
}

/**
 * @param {object} body
 * @param {object} user — { id, name, tenantId }
 */
async function createCarePlan(body, user) {
    const patientId = String(body.patientId || '').trim();
    const encounterId = String(body.encounterId || '').trim();
    const tenantId = String(body.tenantId || user?.tenantId || '').trim();
    if (!patientId || !encounterId || !tenantId) {
        const err = new Error('patientId, encounterId, and tenantId are required');
        err.statusCode = 400;
        throw err;
    }

    const existing = await CarePlan.findOne({ encounterId, tenantId });
    if (existing) {
        const err = new Error('Care plan already exists for this encounter');
        err.statusCode = 409;
        throw err;
    }

    const diagnoses = Array.isArray(body.diagnoses) ? body.diagnoses : [];
    if (diagnoses.length === 0) {
        const err = new Error('Cannot save empty diagnosis list');
        err.statusCode = 400;
        throw err;
    }

    for (const d of diagnoses) {
        if (!d.nandaCode?.trim() || !d.nandaLabel?.trim()) {
            const err = new Error('Each diagnosis requires NANDA code and label');
            err.statusCode = 400;
            throw err;
        }
        for (const g of d.goals || []) {
            if (g.targetDate && isPastDateYmd(g.targetDate)) {
                const err = new Error('Goal target date cannot be in the past');
                err.statusCode = 400;
                throw err;
            }
        }
    }

    const now = new Date();
    const reviewerId = String(user?.id || body.lastReviewedBy || '').trim();
    const reviewerName = String(user?.name || body.lastReviewedByName || 'Staff').trim();

    const doc = await CarePlan.create({
        patientId,
        encounterId,
        tenantId,
        diagnoses: diagnoses.map((d) => ({
            id: d.id || randomUUID(),
            nandaCode: d.nandaCode.trim(),
            nandaLabel: d.nandaLabel.trim(),
            relatedTo: d.relatedTo || '',
            evidencedBy: d.evidencedBy || '',
            priority: d.priority || 'Medium',
            goals: (d.goals || []).map((g) => ({
                id: g.id || randomUUID(),
                statement: g.statement || '',
                targetDate: g.targetDate || todayYmd(),
                status: GOAL_STATUSES.includes(g.status) ? g.status : 'Not Met',
                evaluationNote: g.evaluationNote || '',
            })),
            interventions: (d.interventions || []).map((i) => ({
                id: i.id || randomUUID(),
                text: i.text || '',
                frequency: i.frequency || 'Daily',
                responsibleDiscipline: i.responsibleDiscipline || 'RN',
                status: i.status === 'Discontinued' ? 'Discontinued' : 'Active',
            })),
            addedAt: d.addedAt ? new Date(d.addedAt) : now,
            addedBy: d.addedBy || reviewerName,
            status: DIAGNOSIS_STATUSES.includes(d.status) ? d.status : 'Active',
        })),
        interdisciplinaryNotes: body.interdisciplinaryNotes || '',
        lastReviewedBy: reviewerId,
        lastReviewedByName: reviewerName,
        lastReviewedAt: now,
        version: 1,
    });

    return serializePlan(doc);
}

async function getCarePlanByEncounter(encounterId, tenantId) {
    const enc = String(encounterId || '').trim();
    if (!enc) {
        const err = new Error('encounterId is required');
        err.statusCode = 400;
        throw err;
    }
    const query = { encounterId: enc };
    if (tenantId) query.tenantId = String(tenantId).trim();
    const doc = await CarePlan.findOne(query);
    return doc ? serializePlan(doc) : null;
}

async function updateCarePlan(planId, body, user) {
    const id = String(planId || '').trim();
    const doc = await CarePlan.findById(id);
    if (!doc) {
        const err = new Error('Care plan not found');
        err.statusCode = 404;
        throw err;
    }

    const tenantId = String(body.tenantId || user?.tenantId || doc.tenantId || '').trim();
    if (tenantId && doc.tenantId !== tenantId) {
        const err = new Error('Encounter ownership mismatch');
        err.statusCode = 403;
        throw err;
    }

    if (body.encounterId && String(body.encounterId).trim() !== doc.encounterId) {
        const err = new Error('Encounter ownership mismatch');
        err.statusCode = 403;
        throw err;
    }

    if (Array.isArray(body.diagnoses)) {
        if (body.diagnoses.length === 0) {
            const err = new Error('Cannot save empty diagnosis list');
            err.statusCode = 400;
            throw err;
        }
        for (const d of body.diagnoses) {
            if (!d.nandaCode?.trim() || !d.nandaLabel?.trim()) {
                const err = new Error('Each diagnosis requires NANDA code and label');
                err.statusCode = 400;
                throw err;
            }
            for (const g of d.goals || []) {
                if (g.targetDate && isPastDateYmd(g.targetDate)) {
                    const err = new Error('Goal target date cannot be in the past');
                    err.statusCode = 400;
                    throw err;
                }
            }
        }
        doc.diagnoses = body.diagnoses.map((d) => ({
            id: d.id || randomUUID(),
            nandaCode: d.nandaCode.trim(),
            nandaLabel: d.nandaLabel.trim(),
            relatedTo: d.relatedTo || '',
            evidencedBy: d.evidencedBy || '',
            priority: d.priority || 'Medium',
            goals: (d.goals || []).map((g) => ({
                id: g.id || randomUUID(),
                statement: g.statement || '',
                targetDate: g.targetDate || todayYmd(),
                status: GOAL_STATUSES.includes(g.status) ? g.status : 'Not Met',
                evaluationNote: g.evaluationNote || '',
            })),
            interventions: (d.interventions || []).map((i) => ({
                id: i.id || randomUUID(),
                text: i.text || '',
                frequency: i.frequency || 'Daily',
                responsibleDiscipline: i.responsibleDiscipline || 'RN',
                status: i.status === 'Discontinued' ? 'Discontinued' : 'Active',
            })),
            addedAt: d.addedAt ? new Date(d.addedAt) : new Date(),
            addedBy: d.addedBy || doc.lastReviewedByName || 'Staff',
            status: DIAGNOSIS_STATUSES.includes(d.status) ? d.status : 'Active',
        }));
    }

    if (typeof body.interdisciplinaryNotes === 'string') {
        doc.interdisciplinaryNotes = body.interdisciplinaryNotes;
    }

    const reviewerId = String(user?.id || body.lastReviewedBy || doc.lastReviewedBy || '').trim();
    const reviewerName = String(user?.name || body.lastReviewedByName || doc.lastReviewedByName || 'Staff').trim();
    doc.lastReviewedBy = reviewerId;
    doc.lastReviewedByName = reviewerName;
    doc.lastReviewedAt = new Date();
    doc.version = (doc.version || 1) + 1;

    await doc.save();
    return serializePlan(doc);
}

async function updateGoalStatus(planId, body, user) {
    const id = String(planId || '').trim();
    const doc = await CarePlan.findById(id);
    if (!doc) {
        const err = new Error('Care plan not found');
        err.statusCode = 404;
        throw err;
    }

    const diagnosisId = String(body.diagnosisId || '').trim();
    const goalId = String(body.goalId || '').trim();
    const status = String(body.status || '').trim();
    if (!diagnosisId || !goalId || !GOAL_STATUSES.includes(status)) {
        const err = new Error('diagnosisId, goalId, and valid status are required');
        err.statusCode = 400;
        throw err;
    }

    const dx = doc.diagnoses.find((d) => d.id === diagnosisId);
    if (!dx) {
        const err = new Error('Diagnosis not found');
        err.statusCode = 404;
        throw err;
    }
    const goal = dx.goals.find((g) => g.id === goalId);
    if (!goal) {
        const err = new Error('Goal not found');
        err.statusCode = 404;
        throw err;
    }

    goal.status = status;
    if (typeof body.evaluationNote === 'string') {
        goal.evaluationNote = body.evaluationNote;
    }

    doc.lastReviewedBy = String(user?.id || '').trim();
    doc.lastReviewedByName = String(user?.name || 'Staff').trim();
    doc.lastReviewedAt = new Date();
    doc.version = (doc.version || 1) + 1;
    doc.markModified('diagnoses');
    await doc.save();
    return serializePlan(doc);
}

async function searchNanda(q) {
    await ensureNandaSeed();
    const term = String(q || '').trim();
    if (!term) return [];
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const rows = await NandaDiagnosis.find({
        $or: [{ code: rx }, { label: rx }, { definition: rx }],
    })
        .limit(25)
        .lean();
    return rows.map((r) => ({ code: r.code, label: r.label, definition: r.definition || '' }));
}

module.exports = {
    createCarePlan,
    getCarePlanByEncounter,
    updateCarePlan,
    updateGoalStatus,
    searchNanda,
    serializePlan,
};
