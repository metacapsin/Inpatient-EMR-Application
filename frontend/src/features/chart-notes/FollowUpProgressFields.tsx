import type { AssessmentPlanRow, FollowUpProgressData } from './followUpProgress.types';
import {
    EXAM_SYSTEMS,
    MDM_LEVEL_OPTIONS,
    ROS_SYSTEMS,
    VISIT_SETTING_OPTIONS,
    cptOptionsForSetting,
} from './followUpProgress.types';
import { ClinicalFieldLabel as FieldLabel, ClinicalNoteSection as Section } from './notesUi';

type Props = {
    value: FollowUpProgressData;
    onChange: (next: FollowUpProgressData) => void;
    readOnly?: boolean;
    errors?: Record<string, string>;
};

export function FollowUpProgressFields({ value, onChange, readOnly, errors = {} }: Props) {
    const patch = (partial: Partial<FollowUpProgressData>) => onChange({ ...value, ...partial });
    const cptOptions = cptOptionsForSetting(value.encounter.visitSetting);

    const setAp = (index: number, row: AssessmentPlanRow) => {
        const assessmentPlan = value.assessmentPlan.map((r, i) => (i === index ? row : r));
        patch({ assessmentPlan });
    };

    return (
        <div className="space-y-1">
            <Section title="1 — Visit setting & CPT">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                        <FieldLabel required>Visit setting</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.encounter.visitSetting}
                            onChange={(e) =>
                                patch({
                                    encounter: {
                                        ...value.encounter,
                                        visitSetting: e.target.value,
                                        cptCode: '',
                                    },
                                })
                            }
                        >
                            {VISIT_SETTING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        {errors.visitSetting ? <p className="mt-1 text-xs text-danger">{errors.visitSetting}</p> : null}
                    </div>
                    <div>
                        <FieldLabel required>CPT</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.encounter.cptCode}
                            onChange={(e) => patch({ encounter: { ...value.encounter, cptCode: e.target.value } })}
                        >
                            <option value="">Select CPT</option>
                            {cptOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        {errors.cptCode ? <p className="mt-1 text-xs text-danger">{errors.cptCode}</p> : null}
                    </div>
                    <div>
                        <FieldLabel>MDM level</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.encounter.mdmLevel}
                            onChange={(e) => patch({ encounter: { ...value.encounter, mdmLevel: e.target.value } })}
                        >
                            <option value="">Select MDM</option>
                            {MDM_LEVEL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <FieldLabel>Billing path</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.encounter.billingPath}
                            onChange={(e) => patch({ encounter: { ...value.encounter, billingPath: e.target.value } })}
                        >
                            <option value="MDM">MDM</option>
                            <option value="Time-based">Time-based</option>
                        </select>
                    </div>
                    <div>
                        <FieldLabel>Total time</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.encounter.totalTime}
                            onChange={(e) => patch({ encounter: { ...value.encounter, totalTime: e.target.value } })}
                        >
                            <option value="">Optional</option>
                            <option value="45 mins">45 mins</option>
                            <option value="60 mins">60 mins</option>
                            <option value="90 mins">90 mins</option>
                        </select>
                    </div>
                </div>
            </Section>

            <Section title="2 — Chief complaint">
                <FieldLabel required>Patient&apos;s words</FieldLabel>
                <textarea
                    className="form-textarea min-h-[72px] w-full text-sm"
                    disabled={readOnly}
                    value={value.chiefComplaint.patientWords}
                    onChange={(e) => patch({ chiefComplaint: { patientWords: e.target.value } })}
                    placeholder="Chief complaint in the patient’s words…"
                />
                {errors.chiefComplaint ? <p className="mt-1 text-xs text-danger">{errors.chiefComplaint}</p> : null}
            </Section>

            <Section title="3 — Interval history">
                <textarea
                    className="form-textarea min-h-[88px] w-full text-sm"
                    disabled={readOnly}
                    value={value.intervalHistory}
                    onChange={(e) => patch({ intervalHistory: e.target.value })}
                    placeholder="Interval history since last visit…"
                />
            </Section>

            <Section title="4 — Allergies & medications">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <FieldLabel>Allergies</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[72px] w-full text-sm"
                            disabled={readOnly}
                            value={value.allergiesText}
                            onChange={(e) => patch({ allergiesText: e.target.value })}
                        />
                    </div>
                    <div>
                        <FieldLabel>Current medications</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[72px] w-full text-sm"
                            disabled={readOnly}
                            value={value.medicationsText}
                            onChange={(e) => patch({ medicationsText: e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <Section title="5 — Vital signs">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {(
                        [
                            ['bp', 'BP', true],
                            ['hr', 'HR', true],
                            ['rr', 'RR', false],
                            ['temp', 'Temp', false],
                            ['spo2', 'SpO2', false],
                            ['weight', 'Weight', false],
                            ['height', 'Height', false],
                            ['bmi', 'BMI', false],
                        ] as const
                    ).map(([key, label, required]) => (
                        <div key={key}>
                            <FieldLabel required={required}>{label}</FieldLabel>
                            <input
                                className="form-input w-full"
                                disabled={readOnly}
                                value={value.vitals[key]}
                                onChange={(e) => patch({ vitals: { ...value.vitals, [key]: e.target.value } })}
                            />
                            {errors[key] ? <p className="mt-1 text-xs text-danger">{errors[key]}</p> : null}
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="6 — Focused ROS (min 4 systems)">
                {errors.ros ? <p className="text-xs text-danger">{errors.ros}</p> : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {ROS_SYSTEMS.map((s) => (
                        <div key={s.key}>
                            <FieldLabel>{s.label}</FieldLabel>
                            <textarea
                                className="form-textarea min-h-[56px] w-full text-sm"
                                disabled={readOnly}
                                value={value.ros[`${s.key}Notes`] || ''}
                                onChange={(e) =>
                                    patch({ ros: { ...value.ros, [`${s.key}Notes`]: e.target.value } })
                                }
                            />
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="7 — Physical exam">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {EXAM_SYSTEMS.map((s) => (
                        <div key={s.key}>
                            <FieldLabel>{s.label}</FieldLabel>
                            <textarea
                                className="form-textarea min-h-[56px] w-full text-sm"
                                disabled={readOnly}
                                value={value.physExam[`${s.key}Findings`] || ''}
                                onChange={(e) =>
                                    patch({
                                        physExam: { ...value.physExam, [`${s.key}Findings`]: e.target.value },
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
                <div>
                    <FieldLabel>Additional exam narrative</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[64px] w-full text-sm"
                        disabled={readOnly}
                        value={value.physExam.additionalNarrative || ''}
                        onChange={(e) =>
                            patch({ physExam: { ...value.physExam, additionalNarrative: e.target.value } })
                        }
                    />
                </div>
            </Section>

            <Section title="8 — Assessment & plan">
                {errors.assessmentPlan ? <p className="text-xs text-danger">{errors.assessmentPlan}</p> : null}
                <div className="space-y-3">
                    {value.assessmentPlan.map((row, index) => (
                        <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-white-light p-3 dark:border-[#191e3a] md:grid-cols-12">
                            <div className="md:col-span-4">
                                <FieldLabel>Diagnosis</FieldLabel>
                                <input
                                    className="form-input w-full"
                                    disabled={readOnly}
                                    value={row.dx}
                                    onChange={(e) => setAp(index, { ...row, dx: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel>ICD-10</FieldLabel>
                                <input
                                    className="form-input w-full"
                                    disabled={readOnly}
                                    value={row.icd10}
                                    onChange={(e) => setAp(index, { ...row, icd10: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-5">
                                <FieldLabel>Plan</FieldLabel>
                                <input
                                    className="form-input w-full"
                                    disabled={readOnly}
                                    value={row.plan}
                                    onChange={(e) => setAp(index, { ...row, plan: e.target.value })}
                                />
                            </div>
                            <div className="flex items-end md:col-span-1">
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm w-full"
                                    disabled={readOnly || value.assessmentPlan.length <= 1}
                                    onClick={() =>
                                        patch({
                                            assessmentPlan: value.assessmentPlan.filter((_, i) => i !== index),
                                        })
                                    }
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {!readOnly ? (
                    <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() =>
                            patch({
                                assessmentPlan: [...value.assessmentPlan, { dx: '', icd10: '', plan: '' }],
                            })
                        }
                    >
                        Add diagnosis
                    </button>
                ) : null}
            </Section>

            <Section title="9 — Follow-up plan">
                <textarea
                    className="form-textarea min-h-[80px] w-full text-sm"
                    disabled={readOnly}
                    value={value.followUpPlan}
                    onChange={(e) => patch({ followUpPlan: e.target.value })}
                    placeholder="Return precautions, next visit timing, referrals…"
                />
            </Section>
        </div>
    );
}
