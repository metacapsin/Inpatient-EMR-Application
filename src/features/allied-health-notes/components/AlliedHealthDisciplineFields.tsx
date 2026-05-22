import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import NewDropdown from '../../../components/ui/NewDropdown';
import {
    ADL_STATUS_OPTIONS,
    ASSISTIVE_DEVICE_OPTIONS,
    DISCHARGE_PLANNING_NEED_OPTIONS,
    DOMESTIC_VIOLENCE_OPTIONS,
    LIVING_SITUATION_OPTIONS,
    MOBILITY_ASSIST_OPTIONS,
    NUTRITIONAL_SCREENING_OPTIONS,
    ORAL_INTAKE_OPTIONS,
    PT_AMBULATION_OPTIONS,
    RT_TREATMENT_OPTIONS,
    SUBSTANCE_ABUSE_OPTIONS,
    SUPPORT_SYSTEM_OPTIONS,
    VENTILATOR_MODE_OPTIONS,
    WEANING_STATUS_OPTIONS,
} from '../constants/alliedHealthOptions';
import type { AlliedHealthDiscipline } from '../types/alliedHealthNote.types';
import type { AlliedHealthFormState } from '../utils/alliedHealthFormDefaults';

type Props = {
    discipline: AlliedHealthDiscipline;
    form: AlliedHealthFormState;
    onChange: (next: AlliedHealthFormState) => void;
    readonly?: boolean;
};

const labelClass = 'text-xs font-medium text-gray-600 dark:text-gray-400';
const sectionClass = 'mt-4 rounded border border-gray-200 p-3 dark:border-gray-700';
const gridClass = 'mt-2 grid gap-3 md:grid-cols-2';

function toOptions(values: readonly string[]) {
    return values.map((v) => ({ value: v, label: v }));
}

export function AlliedHealthDisciplineFields({ discipline, form, onChange, readonly }: Props) {
    if (discipline === 'Physical Therapy') {
        const pt = form.ptFields;
        return (
            <div className={sectionClass}>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Physical therapy</p>
                <div className={gridClass}>
                    <div>
                        <label className={labelClass}>Functional Mobility — Bed Mobility</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(MOBILITY_ASSIST_OPTIONS)}
                                value={pt.bedMobility}
                                onChange={(v) => onChange({ ...form, ptFields: { ...pt, bedMobility: String(v) as typeof pt.bedMobility } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Functional Mobility — Transfers</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(MOBILITY_ASSIST_OPTIONS)}
                                value={pt.transfers}
                                onChange={(v) => onChange({ ...form, ptFields: { ...pt, transfers: String(v) as typeof pt.transfers } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Functional Mobility — Ambulation</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(PT_AMBULATION_OPTIONS)}
                                value={pt.ambulation}
                                onChange={(v) => onChange({ ...form, ptFields: { ...pt, ambulation: String(v) as typeof pt.ambulation } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Ambulation Distance</label>
                        <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            value={pt.ambulationDistance}
                            onChange={(e) => onChange({ ...form, ptFields: { ...pt, ambulationDistance: e.target.value } })}
                            placeholder="feet / meters"
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Assistive Device</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(ASSISTIVE_DEVICE_OPTIONS)}
                                value={pt.assistiveDevice}
                                onChange={(v) => onChange({ ...form, ptFields: { ...pt, assistiveDevice: String(v) as typeof pt.assistiveDevice } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Discharge Mobility Goal</label>
                        <Textarea
                            className="mt-1"
                            rows={3}
                            value={pt.dischargeMobilityGoal}
                            onChange={(e) => onChange({ ...form, ptFields: { ...pt, dischargeMobilityGoal: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (discipline === 'Occupational Therapy') {
        const ot = form.otFields;
        return (
            <div className={sectionClass}>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Occupational therapy</p>
                <div className={gridClass}>
                    {(['grooming', 'dressing', 'bathing'] as const).map((key) => (
                        <div key={key}>
                            <label className={labelClass}>ADL Status — {key.charAt(0).toUpperCase() + key.slice(1)}</label>
                            <div className="mt-1">
                                <NewDropdown
                                    options={toOptions(ADL_STATUS_OPTIONS)}
                                    value={ot[key]}
                                    onChange={(v) => onChange({ ...form, otFields: { ...ot, [key]: String(v) as typeof ot.grooming } })}
                                    placeholder="Select…"
                                    disabled={readonly}
                                />
                            </div>
                        </div>
                    ))}
                    <div className="md:col-span-2">
                        <label className={labelClass}>Adaptive Equipment Recommended</label>
                        <Input
                            className="mt-1"
                            value={ot.adaptiveEquipmentRecommended}
                            onChange={(e) => onChange({ ...form, otFields: { ...ot, adaptiveEquipmentRecommended: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (discipline === 'Respiratory Therapy') {
        const rt = form.rtFields;
        return (
            <div className={sectionClass}>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Respiratory therapy</p>
                <div className={gridClass}>
                    <div>
                        <label className={labelClass}>Ventilator Mode</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(VENTILATOR_MODE_OPTIONS)}
                                value={rt.ventilatorMode}
                                onChange={(v) => onChange({ ...form, rtFields: { ...rt, ventilatorMode: String(v) as typeof rt.ventilatorMode } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>FiO₂ (%)</label>
                        <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            max={100}
                            value={rt.fio2}
                            onChange={(e) => onChange({ ...form, rtFields: { ...rt, fio2: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>PEEP (cmH₂O)</label>
                        <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            value={rt.peep}
                            onChange={(e) => onChange({ ...form, rtFields: { ...rt, peep: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Post-Treatment SpO₂ (%)</label>
                        <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            max={100}
                            value={rt.postTreatmentSpo2}
                            onChange={(e) => onChange({ ...form, rtFields: { ...rt, postTreatmentSpo2: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Weaning Status</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(WEANING_STATUS_OPTIONS)}
                                value={rt.weaningStatus}
                                onChange={(v) => onChange({ ...form, rtFields: { ...rt, weaningStatus: String(v) as typeof rt.weaningStatus } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Treatment Given</label>
                        <div className="mt-2 flex flex-wrap gap-3">
                            {RT_TREATMENT_OPTIONS.map((t) => {
                                const checked = rt.treatmentGiven.includes(t);
                                return (
                                    <label key={t} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={readonly}
                                            onChange={(e) => {
                                                const next = e.target.checked
                                                    ? [...rt.treatmentGiven, t]
                                                    : rt.treatmentGiven.filter((x) => x !== t);
                                                onChange({ ...form, rtFields: { ...rt, treatmentGiven: next } });
                                            }}
                                        />
                                        {t}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (discipline === 'Social Work') {
        const sw = form.socialWorkFields;
        return (
            <div className={sectionClass}>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Social work</p>
                <div className={gridClass}>
                    <div>
                        <label className={labelClass}>Living Situation</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(LIVING_SITUATION_OPTIONS)}
                                value={sw.livingSituation}
                                onChange={(v) => onChange({ ...form, socialWorkFields: { ...sw, livingSituation: String(v) as typeof sw.livingSituation } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Support System</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(SUPPORT_SYSTEM_OPTIONS)}
                                value={sw.supportSystem}
                                onChange={(v) => onChange({ ...form, socialWorkFields: { ...sw, supportSystem: String(v) as typeof sw.supportSystem } })}
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Domestic Violence Screen</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(DOMESTIC_VIOLENCE_OPTIONS)}
                                value={sw.domesticViolenceScreen}
                                onChange={(v) =>
                                    onChange({ ...form, socialWorkFields: { ...sw, domesticViolenceScreen: String(v) as typeof sw.domesticViolenceScreen } })
                                }
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Substance Abuse Screen</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(SUBSTANCE_ABUSE_OPTIONS)}
                                value={sw.substanceAbuseScreen}
                                onChange={(v) =>
                                    onChange({ ...form, socialWorkFields: { ...sw, substanceAbuseScreen: String(v) as typeof sw.substanceAbuseScreen } })
                                }
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Financial / Insurance Concerns</label>
                        <label className="mt-2 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                            <input
                                type="checkbox"
                                checked={sw.financialConcerns}
                                disabled={readonly}
                                onChange={(e) => onChange({ ...form, socialWorkFields: { ...sw, financialConcerns: e.target.checked } })}
                            />
                            Concerns identified
                        </label>
                        {sw.financialConcerns ? (
                            <Input
                                className="mt-2"
                                value={sw.financialConcernsText}
                                onChange={(e) => onChange({ ...form, socialWorkFields: { ...sw, financialConcernsText: e.target.value } })}
                                placeholder="Details"
                                readOnly={readonly}
                                disabled={readonly}
                            />
                        ) : null}
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Discharge Planning Needs</label>
                        <div className="mt-2 flex flex-wrap gap-3">
                            {DISCHARGE_PLANNING_NEED_OPTIONS.map((need) => {
                                const checked = sw.dischargePlanningNeeds.includes(need);
                                return (
                                    <label key={need} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={readonly}
                                            onChange={(e) => {
                                                const next = e.target.checked
                                                    ? [...sw.dischargePlanningNeeds, need]
                                                    : sw.dischargePlanningNeeds.filter((x) => x !== need);
                                                onChange({ ...form, socialWorkFields: { ...sw, dischargePlanningNeeds: next } });
                                            }}
                                        />
                                        {need}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (discipline === 'Dietitian') {
        const diet = form.dietitianFields;
        return (
            <div className={sectionClass}>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dietitian</p>
                <div className={gridClass}>
                    <div>
                        <label className={labelClass}>BMI</label>
                        <Input className="mt-1" value={diet.bmi} readOnly disabled />
                        <p className="mt-1 text-xs text-gray-500">Auto-calculated from latest height/weight</p>
                    </div>
                    <div>
                        <label className={labelClass}>Nutritional Screening Score</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(NUTRITIONAL_SCREENING_OPTIONS)}
                                value={diet.nutritionalScreeningScore}
                                onChange={(v) =>
                                    onChange({
                                        ...form,
                                        dietitianFields: { ...diet, nutritionalScreeningScore: String(v) as typeof diet.nutritionalScreeningScore },
                                    })
                                }
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Estimated Caloric Needs (kcal/day)</label>
                        <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            value={diet.estimatedCaloricNeeds}
                            onChange={(e) => onChange({ ...form, dietitianFields: { ...diet, estimatedCaloricNeeds: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Oral Intake %</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(ORAL_INTAKE_OPTIONS)}
                                value={diet.oralIntakePercent}
                                onChange={(v) =>
                                    onChange({ ...form, dietitianFields: { ...diet, oralIntakePercent: String(v) as typeof diet.oralIntakePercent } })
                                }
                                placeholder="Select…"
                                disabled={readonly}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Recommended Diet</label>
                        <Input
                            className="mt-1"
                            value={diet.recommendedDiet}
                            onChange={(e) => onChange({ ...form, dietitianFields: { ...diet, recommendedDiet: e.target.value } })}
                            readOnly={readonly}
                            disabled={readonly}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
