import type { ReactNode } from 'react';
import type { NeurologyHpData } from './neurologyHp.types';
import { NEURO_SYMPTOM_OPTIONS } from './neurologyHp.types';

type Props = {
    value: NeurologyHpData;
    onChange: (next: NeurologyHpData) => void;
    readOnly?: boolean;
    errors?: Record<string, string>;
};

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
    return (
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            {children}
            {required ? <span className="text-danger"> *</span> : null}
        </label>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="panel mb-4 overflow-hidden p-0">
            <header className="border-b border-white-light bg-white-light/40 px-4 py-2.5 dark:border-[#191e3a] dark:bg-[#0e1726]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
            </header>
            <div className="space-y-3 p-4">{children}</div>
        </section>
    );
}

export function NeurologyHpFields({ value, onChange, readOnly, errors = {} }: Props) {
    const patch = (partial: Partial<NeurologyHpData>) => onChange({ ...value, ...partial });

    return (
        <div className="space-y-1">
            <Section title="I — Identifying">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                        <FieldLabel>Handedness</FieldLabel>
                        <select
                            className="form-select w-full"
                            disabled={readOnly}
                            value={value.identifying.handedness}
                            onChange={(e) =>
                                patch({ identifying: { ...value.identifying, handedness: e.target.value } })
                            }
                        >
                            <option value="">Select</option>
                            <option value="Right">Right</option>
                            <option value="Left">Left</option>
                            <option value="Ambidextrous">Ambidextrous</option>
                        </select>
                    </div>
                    <div>
                        <FieldLabel>Source of history</FieldLabel>
                        <input
                            className="form-input w-full"
                            disabled={readOnly}
                            value={value.identifying.sourceOfHistory}
                            onChange={(e) =>
                                patch({
                                    identifying: { ...value.identifying, sourceOfHistory: e.target.value },
                                })
                            }
                            placeholder="Patient, family…"
                        />
                    </div>
                    <div>
                        <FieldLabel>Reliability</FieldLabel>
                        <input
                            className="form-input w-full"
                            disabled={readOnly}
                            value={value.identifying.reliability}
                            onChange={(e) =>
                                patch({ identifying: { ...value.identifying, reliability: e.target.value } })
                            }
                        />
                    </div>
                </div>
            </Section>

            <Section title="II — Chief complaint">
                <textarea
                    className="form-textarea min-h-[72px] w-full text-sm"
                    disabled={readOnly}
                    value={value.chiefComplaint}
                    onChange={(e) => patch({ chiefComplaint: e.target.value })}
                    placeholder="Chief complaint…"
                />
                {errors.chiefComplaint ? <p className="text-xs text-danger">{errors.chiefComplaint}</p> : null}
            </Section>

            <Section title="III — HPI">
                {errors.hpi ? <p className="text-xs text-danger">{errors.hpi}</p> : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(
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
                    ).map(([key, label]) => (
                        <div key={key}>
                            <FieldLabel>{label}</FieldLabel>
                            <input
                                className="form-input w-full"
                                disabled={readOnly}
                                value={value.hpi[key]}
                                onChange={(e) => patch({ hpi: { ...value.hpi, [key]: e.target.value } })}
                            />
                        </div>
                    ))}
                </div>
                <div>
                    <FieldLabel>Associated symptoms</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[56px] w-full text-sm"
                        disabled={readOnly}
                        value={value.hpi.associatedSymptoms}
                        onChange={(e) => patch({ hpi: { ...value.hpi, associatedSymptoms: e.target.value } })}
                    />
                </div>
                <div>
                    <FieldLabel>Neurologic symptom review</FieldLabel>
                    <div className="flex flex-wrap gap-3">
                        {NEURO_SYMPTOM_OPTIONS.map((s) => (
                            <label key={s.key} className="inline-flex items-center gap-1.5 text-sm">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    disabled={readOnly}
                                    checked={Boolean(value.hpi.neurologicSymptoms[s.key])}
                                    onChange={(e) =>
                                        patch({
                                            hpi: {
                                                ...value.hpi,
                                                neurologicSymptoms: {
                                                    ...value.hpi.neurologicSymptoms,
                                                    [s.key]: e.target.checked,
                                                },
                                            },
                                        })
                                    }
                                />
                                {s.label}
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <FieldLabel>Additional HPI narrative</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[72px] w-full text-sm"
                        disabled={readOnly}
                        value={value.hpi.additionalNarrative}
                        onChange={(e) => patch({ hpi: { ...value.hpi, additionalNarrative: e.target.value } })}
                    />
                </div>
            </Section>

            <Section title="IV–IX — History">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <FieldLabel>Neurologic PMH</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.pmh.neurologicConditions}
                            onChange={(e) =>
                                patch({ pmh: { ...value.pmh, neurologicConditions: e.target.value } })
                            }
                        />
                    </div>
                    <div>
                        <FieldLabel>Chronic illnesses</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.pmh.chronicIllnesses}
                            onChange={(e) => patch({ pmh: { ...value.pmh, chronicIllnesses: e.target.value } })}
                        />
                    </div>
                    <div>
                        <FieldLabel>Medications</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.medications}
                            onChange={(e) => patch({ medications: e.target.value })}
                        />
                    </div>
                    <div>
                        <FieldLabel>Allergies</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.allergies}
                            onChange={(e) => patch({ allergies: e.target.value })}
                        />
                    </div>
                    <div>
                        <FieldLabel>Family history</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.familyHistory.conditions}
                            onChange={(e) =>
                                patch({ familyHistory: { ...value.familyHistory, conditions: e.target.value } })
                            }
                        />
                    </div>
                    <div>
                        <FieldLabel>Social (occupation / tobacco / alcohol)</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={[
                                value.socialHistory.occupation,
                                value.socialHistory.tobacco,
                                value.socialHistory.alcohol,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                            onChange={(e) =>
                                patch({
                                    socialHistory: {
                                        ...value.socialHistory,
                                        occupation: e.target.value,
                                    },
                                })
                            }
                            placeholder="Occupation; tobacco; alcohol…"
                        />
                    </div>
                </div>
            </Section>

            <Section title="XI — Physical exam">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {(
                        [
                            ['bp', 'BP', true],
                            ['hr', 'HR', true],
                            ['rr', 'RR', false],
                            ['temp', 'Temp', false],
                            ['o2sat', 'O2 sat', false],
                        ] as const
                    ).map(([key, label, required]) => (
                        <div key={key}>
                            <FieldLabel required={required}>{label}</FieldLabel>
                            <input
                                className="form-input w-full"
                                disabled={readOnly}
                                value={value.physicalExam.vitalSigns[key]}
                                onChange={(e) =>
                                    patch({
                                        physicalExam: {
                                            ...value.physicalExam,
                                            vitalSigns: {
                                                ...value.physicalExam.vitalSigns,
                                                [key]: e.target.value,
                                            },
                                        },
                                    })
                                }
                            />
                            {errors[key] ? <p className="mt-1 text-xs text-danger">{errors[key]}</p> : null}
                        </div>
                    ))}
                </div>
                {(
                    [
                        ['general', 'General'],
                        ['mentalStatus', 'Mental status'],
                        ['cranialNerves', 'Cranial nerves'],
                        ['motor', 'Motor'],
                        ['reflexes', 'Reflexes'],
                        ['sensory', 'Sensory'],
                        ['coordination', 'Coordination'],
                        ['gait', 'Gait / station'],
                        ['specialTests', 'Special tests'],
                    ] as const
                ).map(([key, label]) => (
                    <div key={key}>
                        <FieldLabel>{label}</FieldLabel>
                        <textarea
                            className="form-textarea min-h-[56px] w-full text-sm"
                            disabled={readOnly}
                            value={value.physicalExam[key]}
                            onChange={(e) =>
                                patch({
                                    physicalExam: { ...value.physicalExam, [key]: e.target.value },
                                })
                            }
                        />
                    </div>
                ))}
            </Section>

            <Section title="XII — Assessment">
                <div>
                    <FieldLabel required>Problem list / assessment</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[72px] w-full text-sm"
                        disabled={readOnly}
                        value={value.assessment.problemList}
                        onChange={(e) =>
                            patch({ assessment: { ...value.assessment, problemList: e.target.value } })
                        }
                    />
                    {errors.problemList ? <p className="text-xs text-danger">{errors.problemList}</p> : null}
                </div>
                <div>
                    <FieldLabel required>Localization</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[56px] w-full text-sm"
                        disabled={readOnly}
                        value={value.assessment.localization}
                        onChange={(e) =>
                            patch({ assessment: { ...value.assessment, localization: e.target.value } })
                        }
                    />
                    {errors.localization ? <p className="text-xs text-danger">{errors.localization}</p> : null}
                </div>
                <div>
                    <FieldLabel>Differential diagnosis</FieldLabel>
                    <textarea
                        className="form-textarea min-h-[56px] w-full text-sm"
                        disabled={readOnly}
                        value={value.assessment.differentialDiagnosis}
                        onChange={(e) =>
                            patch({
                                assessment: { ...value.assessment, differentialDiagnosis: e.target.value },
                            })
                        }
                    />
                </div>
            </Section>

            <Section title="XIII — Plan">
                {errors.plan ? <p className="text-xs text-danger">{errors.plan}</p> : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(
                        [
                            ['diagnosticTests', 'Diagnostics'],
                            ['treatment', 'Treatment'],
                            ['consults', 'Consults'],
                            ['disposition', 'Disposition / follow-up'],
                            ['patientEducation', 'Patient education'],
                        ] as const
                    ).map(([key, label]) => (
                        <div key={key} className={key === 'patientEducation' ? 'md:col-span-2' : ''}>
                            <FieldLabel>{label}</FieldLabel>
                            <textarea
                                className="form-textarea min-h-[56px] w-full text-sm"
                                disabled={readOnly}
                                value={value.plan[key]}
                                onChange={(e) => patch({ plan: { ...value.plan, [key]: e.target.value } })}
                            />
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}
