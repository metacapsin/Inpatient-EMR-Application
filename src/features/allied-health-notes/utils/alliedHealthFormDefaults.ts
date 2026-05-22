import { DUMMY_BMI_FROM_VITALS } from '../constants/alliedHealthOptions';
import type {
    AlliedHealthDiscipline,
    AlliedHealthNote,
    DietitianDisciplineFields,
    OtDisciplineFields,
    PtDisciplineFields,
    RtDisciplineFields,
    SocialWorkDisciplineFields,
} from '../types/alliedHealthNote.types';

export function defaultPtFields(): PtDisciplineFields {
    return {
        bedMobility: '',
        transfers: '',
        ambulation: '',
        ambulationDistance: '',
        assistiveDevice: '',
        dischargeMobilityGoal: '',
    };
}

export function defaultOtFields(): OtDisciplineFields {
    return {
        grooming: '',
        dressing: '',
        bathing: '',
        adaptiveEquipmentRecommended: '',
    };
}

export function defaultRtFields(): RtDisciplineFields {
    return {
        ventilatorMode: '',
        fio2: '',
        peep: '',
        treatmentGiven: [],
        postTreatmentSpo2: '',
        weaningStatus: '',
    };
}

export function defaultSocialWorkFields(): SocialWorkDisciplineFields {
    return {
        livingSituation: '',
        supportSystem: '',
        financialConcerns: false,
        financialConcernsText: '',
        domesticViolenceScreen: '',
        substanceAbuseScreen: '',
        dischargePlanningNeeds: [],
    };
}

export function defaultDietitianFields(): DietitianDisciplineFields {
    return {
        bmi: DUMMY_BMI_FROM_VITALS,
        nutritionalScreeningScore: '',
        estimatedCaloricNeeds: '',
        recommendedDiet: '',
        oralIntakePercent: '',
    };
}

export function visitDateTimeLocalValue(iso?: string): string {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDateTimeToIso(local: string): string {
    if (!local) return new Date().toISOString();
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function noteToFormState(note: AlliedHealthNote) {
    return {
        discipline: note.discipline,
        visitType: note.visitType,
        visitDateTime: visitDateTimeLocalValue(note.visitDateTime),
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
        ptFields: note.ptFields ?? defaultPtFields(),
        otFields: note.otFields ?? defaultOtFields(),
        rtFields: note.rtFields ?? defaultRtFields(),
        socialWorkFields: note.socialWorkFields ?? defaultSocialWorkFields(),
        dietitianFields: note.dietitianFields ?? defaultDietitianFields(),
    };
}

export type AlliedHealthFormState = ReturnType<typeof emptyFormState>;

export function emptyFormState(discipline: AlliedHealthDiscipline = 'Physical Therapy'): AlliedHealthFormState {
    return {
        discipline,
        visitType: 'Evaluation',
        visitDateTime: visitDateTimeLocalValue(),
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        ptFields: defaultPtFields(),
        otFields: defaultOtFields(),
        rtFields: defaultRtFields(),
        socialWorkFields: defaultSocialWorkFields(),
        dietitianFields: defaultDietitianFields(),
    };
}
