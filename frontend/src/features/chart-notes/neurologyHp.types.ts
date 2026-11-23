/** Core Neurology H&P shape (EMR-ng neuroHp — v1 without full Normal/Not-Tested grids). */

export const NEUROLOGY_HP_NOTE_TYPE = 'Neurology H&P' as const;

export const NEURO_SYMPTOM_OPTIONS = [
    { key: 'weakness', label: 'Weakness' },
    { key: 'sensory', label: 'Sensory changes' },
    { key: 'vision', label: 'Vision changes' },
    { key: 'speech', label: 'Speech/language' },
    { key: 'balance', label: 'Balance/gait' },
    { key: 'headache', label: 'Headache' },
    { key: 'seizures', label: 'Seizures' },
    { key: 'cognitive', label: 'Cognitive/behavioral' },
    { key: 'autonomic', label: 'Autonomic' },
] as const;

export type NeurologyHpData = {
    identifying: {
        handedness: string;
        sourceOfHistory: string;
        reliability: string;
    };
    chiefComplaint: string;
    hpi: {
        onset: string;
        timeCourse: string;
        duration: string;
        frequency: string;
        location: string;
        quality: string;
        severity: string;
        associatedSymptoms: string;
        triggers: string;
        relievingFactors: string;
        priorEpisodes: string;
        functionalImpact: string;
        additionalNarrative: string;
        neurologicSymptoms: Record<string, boolean>;
    };
    pmh: {
        neurologicConditions: string;
        chronicIllnesses: string;
        psychiatricHistory: string;
    };
    psh: { neurosurgical: string; other: string };
    medications: string;
    allergies: string;
    familyHistory: { conditions: string; other: string };
    socialHistory: {
        occupation: string;
        livingSituation: string;
        tobacco: string;
        alcohol: string;
        illicitDrugs: string;
        adls: string;
        drivingStatus: string;
    };
    physicalExam: {
        vitalSigns: { bp: string; hr: string; rr: string; temp: string; o2sat: string };
        general: string;
        mentalStatus: string;
        cranialNerves: string;
        motor: string;
        reflexes: string;
        sensory: string;
        coordination: string;
        gait: string;
        specialTests: string;
    };
    assessment: {
        problemList: string;
        localization: string;
        differentialDiagnosis: string;
    };
    plan: {
        diagnosticTests: string;
        treatment: string;
        consults: string;
        disposition: string;
        patientEducation: string;
    };
};

export function emptyNeurologyHpData(): NeurologyHpData {
    const neurologicSymptoms: Record<string, boolean> = {};
    for (const s of NEURO_SYMPTOM_OPTIONS) neurologicSymptoms[s.key] = false;
    return {
        identifying: { handedness: '', sourceOfHistory: '', reliability: '' },
        chiefComplaint: '',
        hpi: {
            onset: '',
            timeCourse: '',
            duration: '',
            frequency: '',
            location: '',
            quality: '',
            severity: '',
            associatedSymptoms: '',
            triggers: '',
            relievingFactors: '',
            priorEpisodes: '',
            functionalImpact: '',
            additionalNarrative: '',
            neurologicSymptoms,
        },
        pmh: { neurologicConditions: '', chronicIllnesses: '', psychiatricHistory: '' },
        psh: { neurosurgical: '', other: '' },
        medications: '',
        allergies: '',
        familyHistory: { conditions: '', other: '' },
        socialHistory: {
            occupation: '',
            livingSituation: '',
            tobacco: '',
            alcohol: '',
            illicitDrugs: '',
            adls: '',
            drivingStatus: '',
        },
        physicalExam: {
            vitalSigns: { bp: '', hr: '', rr: '', temp: '', o2sat: '' },
            general: '',
            mentalStatus: '',
            cranialNerves: '',
            motor: '',
            reflexes: '',
            sensory: '',
            coordination: '',
            gait: '',
            specialTests: '',
        },
        assessment: { problemList: '', localization: '', differentialDiagnosis: '' },
        plan: {
            diagnosticTests: '',
            treatment: '',
            consults: '',
            disposition: '',
            patientEducation: '',
        },
    };
}

export function validateNeurologyHp(data: NeurologyHpData): Record<string, string> {
    const e: Record<string, string> = {};
    if (!data.chiefComplaint.trim()) e.chiefComplaint = 'Chief complaint is required.';
    const hpiOk =
        data.hpi.onset.trim() ||
        data.hpi.timeCourse.trim() ||
        data.hpi.duration.trim() ||
        data.hpi.location.trim() ||
        data.hpi.additionalNarrative.trim();
    if (!hpiOk) e.hpi = 'Enter at least one HPI detail (onset, course, duration, location, or narrative).';
    if (!data.physicalExam.vitalSigns.bp.trim()) e.bp = 'BP is required.';
    if (!data.physicalExam.vitalSigns.hr.trim()) e.hr = 'HR is required.';
    if (!data.assessment.problemList.trim()) e.problemList = 'Problem list / assessment is required.';
    if (!data.assessment.localization.trim()) e.localization = 'Localization is required.';
    if (!data.plan.treatment.trim() && !data.plan.disposition.trim()) {
        e.plan = 'Enter treatment or disposition / follow-up.';
    }
    return e;
}
