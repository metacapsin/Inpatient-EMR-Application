import type { CreateAlliedHealthNoteInput } from '../mock/alliedHealthNoteStore';
import type { AlliedHealthNote } from '../types/alliedHealthNote.types';
import type { AlliedHealthFormState } from './alliedHealthFormDefaults';
import { localDateTimeToIso } from './alliedHealthFormDefaults';

export function buildNotePayload(
    form: AlliedHealthFormState,
    ctx: { patientId: string; encounterId: string; signedBy: string; credentials: string },
): CreateAlliedHealthNoteInput {
    const base: CreateAlliedHealthNoteInput = {
        patientId: ctx.patientId,
        encounterId: ctx.encounterId,
        discipline: form.discipline,
        visitType: form.visitType,
        visitDateTime: localDateTimeToIso(form.visitDateTime),
        subjective: form.subjective,
        objective: form.objective,
        assessment: form.assessment,
        plan: form.plan,
        signedBy: ctx.signedBy,
        credentials: ctx.credentials,
        status: 'Draft',
        signedAt: null,
    };

    attachDisciplineFields(base, form);
    return base;
}

export function buildUpdatePayload(form: AlliedHealthFormState): Partial<AlliedHealthNote> {
    const patch: Partial<AlliedHealthNote> = {
        discipline: form.discipline,
        visitType: form.visitType,
        visitDateTime: localDateTimeToIso(form.visitDateTime),
        subjective: form.subjective,
        objective: form.objective,
        assessment: form.assessment,
        plan: form.plan,
        ptFields: undefined,
        otFields: undefined,
        rtFields: undefined,
        socialWorkFields: undefined,
        dietitianFields: undefined,
    };
    attachDisciplineFields(patch as CreateAlliedHealthNoteInput, form);
    return patch;
}

function attachDisciplineFields(
    target: CreateAlliedHealthNoteInput | Partial<AlliedHealthNote>,
    form: AlliedHealthFormState,
): void {
    const d = form.discipline;
    if (d === 'Physical Therapy') {
        target.ptFields = { ...form.ptFields };
        return;
    }
    if (d === 'Occupational Therapy') {
        target.otFields = { ...form.otFields };
        return;
    }
    if (d === 'Respiratory Therapy') {
        target.rtFields = { ...form.rtFields };
        return;
    }
    if (d === 'Social Work') {
        target.socialWorkFields = { ...form.socialWorkFields };
        return;
    }
    if (d === 'Dietitian') {
        target.dietitianFields = { ...form.dietitianFields };
    }
}
