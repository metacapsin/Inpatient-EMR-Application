import type { NeurologyHpData } from './neurologyHp.types';
import { NEURO_SYMPTOM_OPTIONS } from './neurologyHp.types';

function txt(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
}

function joinParts(parts: Array<string | false | '' | undefined>, sep = '; '): string {
    return parts.filter(Boolean).join(sep);
}

/** Deterministic narrative — mirrors EMR-ng composeNeuroHpNote for inpatient v1 fields. */
export function composeNeurologyHpNote(data: NeurologyHpData | null | undefined): string {
    if (!data) return '';
    const out: string[] = [];
    const section = (title: string, body: string) => {
        if (body && body.trim()) out.push(`${title}:\n${body.trim()}`);
    };

    out.push('NEUROLOGY HISTORY & PHYSICAL');

    const id = data.identifying || {};
    section(
        'IDENTIFYING INFORMATION',
        joinParts(
            [
                txt(id.handedness) && `${txt(id.handedness)}-handed`,
                txt(id.sourceOfHistory) && `history from ${txt(id.sourceOfHistory).toLowerCase()}`,
                txt(id.reliability) && `reliability ${txt(id.reliability).toLowerCase()}`,
            ],
            ', ',
        ),
    );

    section('CHIEF COMPLAINT', txt(data.chiefComplaint) ? `"${txt(data.chiefComplaint)}"` : '');

    const hpi = data.hpi || ({} as NeurologyHpData['hpi']);
    const hpiParts = (
        [
            ['onset', 'Onset'],
            ['timeCourse', 'Time course'],
            ['duration', 'Duration'],
            ['frequency', 'Frequency'],
            ['severity', 'Severity'],
            ['location', 'Location'],
            ['quality', 'Quality'],
            ['triggers', 'Triggers'],
            ['relievingFactors', 'Relieving factors'],
            ['priorEpisodes', 'Prior episodes'],
            ['functionalImpact', 'Functional impact'],
        ] as const
    )
        .map(([key, label]) => txt(hpi[key]) && `${label}: ${txt(hpi[key])}`)
        .filter(Boolean);
    const positives = NEURO_SYMPTOM_OPTIONS.filter((s) => hpi.neurologicSymptoms?.[s.key]).map((s) => s.label);
    section(
        'HPI',
        joinParts(
            [
                joinParts(hpiParts),
                txt(hpi.associatedSymptoms) && `Associated symptoms: ${txt(hpi.associatedSymptoms)}`,
                positives.length ? `Positive neurologic symptom review: ${positives.join(', ')}.` : '',
                txt(hpi.additionalNarrative),
            ],
            '\n',
        ),
    );

    const pmh = data.pmh || {};
    section(
        'PAST MEDICAL HISTORY',
        joinParts(
            [
                txt(pmh.neurologicConditions) && `Neurologic: ${txt(pmh.neurologicConditions)}`,
                txt(pmh.chronicIllnesses) && `Chronic: ${txt(pmh.chronicIllnesses)}`,
                txt(pmh.psychiatricHistory) && `Psychiatric: ${txt(pmh.psychiatricHistory)}`,
            ],
            '\n',
        ),
    );

    const psh = data.psh || {};
    section(
        'PAST SURGICAL HISTORY',
        joinParts(
            [
                txt(psh.neurosurgical) && `Neurosurgical: ${txt(psh.neurosurgical)}`,
                txt(psh.other) && `Other: ${txt(psh.other)}`,
            ],
            '\n',
        ),
    );

    section('MEDICATIONS', txt(data.medications));
    section('ALLERGIES', txt(data.allergies));

    const fh = data.familyHistory || {};
    section('FAMILY HISTORY', joinParts([txt(fh.conditions), txt(fh.other)], '. '));

    const sh = data.socialHistory || {};
    section(
        'SOCIAL HISTORY',
        joinParts([
            txt(sh.occupation) && `Occupation: ${txt(sh.occupation)}`,
            txt(sh.livingSituation) && `Living situation: ${txt(sh.livingSituation)}`,
            txt(sh.tobacco) && `Tobacco: ${txt(sh.tobacco)}`,
            txt(sh.alcohol) && `Alcohol: ${txt(sh.alcohol)}`,
            txt(sh.illicitDrugs) && `Illicit drugs: ${txt(sh.illicitDrugs)}`,
            txt(sh.adls) && `Functional baseline: ${txt(sh.adls)}`,
            txt(sh.drivingStatus) && `Driving: ${txt(sh.drivingStatus)}`,
        ]),
    );

    const exam = data.physicalExam || ({} as NeurologyHpData['physicalExam']);
    const vs = exam.vitalSigns || {};
    const examLines: string[] = [];
    const vitals = joinParts(
        [
            txt(vs.bp) && `BP ${txt(vs.bp)}`,
            txt(vs.hr) && `HR ${txt(vs.hr)}`,
            txt(vs.rr) && `RR ${txt(vs.rr)}`,
            txt(vs.temp) && `Temp ${txt(vs.temp)}`,
            txt(vs.o2sat) && `O2 sat ${txt(vs.o2sat)}`,
        ],
        ', ',
    );
    if (vitals) examLines.push(`Vitals: ${vitals}.`);
    if (txt(exam.general)) examLines.push(`General: ${txt(exam.general)}.`);
    if (txt(exam.mentalStatus)) examLines.push(`Mental status: ${txt(exam.mentalStatus)}.`);
    if (txt(exam.cranialNerves)) examLines.push(`Cranial nerves: ${txt(exam.cranialNerves)}.`);
    if (txt(exam.motor)) examLines.push(`Motor: ${txt(exam.motor)}.`);
    if (txt(exam.reflexes)) examLines.push(`Reflexes: ${txt(exam.reflexes)}.`);
    if (txt(exam.sensory)) examLines.push(`Sensory: ${txt(exam.sensory)}.`);
    if (txt(exam.coordination)) examLines.push(`Coordination: ${txt(exam.coordination)}.`);
    if (txt(exam.gait)) examLines.push(`Gait/station: ${txt(exam.gait)}.`);
    if (txt(exam.specialTests)) examLines.push(`Special tests: ${txt(exam.specialTests)}.`);
    section('PHYSICAL EXAM', examLines.join('\n'));

    const assessment = data.assessment || {};
    section(
        'ASSESSMENT',
        joinParts(
            [
                txt(assessment.problemList),
                txt(assessment.localization) && `Localization: ${txt(assessment.localization)}`,
                txt(assessment.differentialDiagnosis) &&
                    `Differential: ${txt(assessment.differentialDiagnosis)}`,
            ],
            '\n',
        ),
    );

    const plan = data.plan || {};
    section(
        'PLAN',
        joinParts(
            [
                txt(plan.diagnosticTests) && `Diagnostics: ${txt(plan.diagnosticTests)}`,
                txt(plan.treatment) && `Treatment: ${txt(plan.treatment)}`,
                txt(plan.consults) && `Consults: ${txt(plan.consults)}`,
                txt(plan.disposition) && `Disposition/follow-up: ${txt(plan.disposition)}`,
                txt(plan.patientEducation) && `Patient education: ${txt(plan.patientEducation)}`,
            ],
            '\n',
        ),
    );

    return out.length > 1 ? out.join('\n\n') : '';
}
