import type { FollowUpProgressData } from './followUpProgress.types';
import { EXAM_SYSTEMS, ROS_SYSTEMS } from './followUpProgress.types';

function txt(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
}

function joinParts(parts: Array<string | false | '' | undefined>, sep = '; '): string {
    return parts.filter(Boolean).join(sep);
}

/** Deterministic narrative — mirrors EMR-ng composeFollowUpNote (core sections). */
export function composeFollowUpNote(data: FollowUpProgressData | null | undefined): string {
    if (!data) return '';
    const out: string[] = [];
    const section = (title: string, body: string) => {
        if (body && body.trim()) out.push(`${title}:\n${body.trim()}`);
    };

    out.push('FOLLOW-UP PROGRESS NOTE');

    const enc = data.encounter || ({} as FollowUpProgressData['encounter']);
    section(
        'ENCOUNTER',
        joinParts(
            [
                txt(enc.cptCode) && `CPT ${txt(enc.cptCode)}`,
                txt(enc.visitSetting) && `Setting: ${txt(enc.visitSetting)}`,
                txt(enc.billingPath) && `Billing: ${txt(enc.billingPath)}`,
                txt(enc.mdmLevel) && `MDM: ${txt(enc.mdmLevel)}`,
                txt(enc.modifier) && txt(enc.modifier) !== 'None' && `Modifier: ${txt(enc.modifier)}`,
                txt(enc.totalTime) && `Total time: ${txt(enc.totalTime)}`,
            ],
            ' · ',
        ),
    );

    const cc = data.chiefComplaint || { patientWords: '' };
    section('CHIEF COMPLAINT', txt(cc.patientWords) ? `"${txt(cc.patientWords)}"` : '');

    section('INTERVAL HISTORY', txt(data.intervalHistory));
    section('ALLERGIES', txt(data.allergiesText));
    section('MEDICATIONS', txt(data.medicationsText));

    const v = data.vitals || ({} as FollowUpProgressData['vitals']);
    const vitalBits = (
        [
            ['bp', 'BP'],
            ['hr', 'HR'],
            ['rr', 'RR'],
            ['temp', 'Temp'],
            ['tempRoute', 'Temp route'],
            ['spo2', 'SpO2'],
            ['weight', 'Weight'],
            ['height', 'Height'],
            ['bmi', 'BMI'],
        ] as const
    )
        .map(([key, label]) => txt(v[key]) && `${label}: ${txt(v[key])}`)
        .filter(Boolean);
    section('VITAL SIGNS', vitalBits.join('; '));

    const ros = data.ros || {};
    const rosLines = ROS_SYSTEMS.map((s) => {
        const notes = txt(ros[`${s.key}Notes`]);
        return notes ? `${s.label}: ${notes}` : '';
    }).filter(Boolean);
    section('REVIEW OF SYSTEMS', rosLines.join('\n'));

    const exam = data.physExam || {};
    const examLines = EXAM_SYSTEMS.map((s) => {
        const findings = txt(exam[`${s.key}Findings`]);
        return findings ? `${s.label}: ${findings}` : '';
    }).filter(Boolean);
    if (txt(exam.additionalNarrative)) examLines.push(txt(exam.additionalNarrative));
    section('PHYSICAL EXAMINATION', examLines.join('\n'));

    const apRows = (Array.isArray(data.assessmentPlan) ? data.assessmentPlan : [])
        .filter((row) => row && (txt(row.dx) || txt(row.plan)))
        .map((row, i) => {
            const head = joinParts([txt(row.dx), txt(row.icd10) && `(${txt(row.icd10)})`], ' ');
            const detail = txt(row.plan) ? `Plan: ${txt(row.plan)}` : '';
            return `${i + 1}. ${head}${detail ? `\n   ${detail}` : ''}`;
        })
        .join('\n');
    section('ASSESSMENT & PLAN', apRows);

    section('FOLLOW-UP PLAN', txt(data.followUpPlan));

    return out.length > 1 ? out.join('\n\n') : '';
}
