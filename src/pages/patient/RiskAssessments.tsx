import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Calendar } from 'primereact/calendar';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { usePatientId } from '../../hooks/usePatientId';
import { riskAssessmentAPI } from '../../services/api';
import AppButton from '../../components/ui/AppButton';
import NewDropdown from '../../components/ui/NewDropdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BradenScores {
    sensoryPerception: number;
    moisture: number;
    activity: number;
    mobility: number;
    nutrition: number;
    frictionShear: number;
}

interface MorseScores {
    historyOfFalling: number;
    secondaryDiagnosis: number;
    ambulatoryAid: number;
    ivHepLock: number;
    gait: number;
    mentalStatus: number;
}

interface GCSScores {
    eye: number;
    verbal: number;
    motor: number;
}

type PainScale = 'NRS' | 'FLACC' | 'CPOT' | 'WongBaker';
type PainRelief = 'Complete Relief' | 'Partial Relief' | 'No Relief' | '';

interface PainAssessmentData {
    scale: PainScale;
    score: number;
    location: string;
    character: string[];
    intervention: string;
    response: PainRelief;
    reassessmentDue: string;
    priority: 'STAT' | 'routine';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_TITLE_CLASS = 'text-sm font-semibold text-gray-900 dark:text-white';
const LABEL_CLASS = 'mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const BODY_TEXT_CLASS = 'text-xs font-medium text-gray-700 dark:text-gray-300';
const MUTED_TEXT_CLASS = 'text-xs text-gray-500 dark:text-gray-400';
const OPTION_BASE_CLASS = 'rounded-lg border px-3 py-2 text-xs font-medium transition-colors';
const OPTION_ACTIVE_CLASS = 'border-primary bg-primary/10 text-primary';
const OPTION_IDLE_CLASS = 'border-gray-200 text-gray-700 hover:border-primary/50 dark:border-white/10 dark:text-gray-300';
const RADIO_INDICATOR_BASE =
    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-white dark:bg-[#141210]';
const RADIO_INDICATOR_ACTIVE = 'border-primary';
const RADIO_INDICATOR_IDLE = 'border-gray-300 dark:border-gray-600';
const APPOINTMENT_FLOAT_LABEL =
    'pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-white px-1 text-[12px] font-medium text-gray-500 dark:bg-[#141210] dark:text-gray-400';
const APPOINTMENT_FIELD_FRAME =
    'relative rounded-lg border border-gray-200/70 bg-white shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 dark:border-gray-600 dark:bg-[#141210]';
const APPOINTMENT_FIELD_INPUT =
    'h-10 w-full border-0 bg-transparent px-3 pb-2 pt-[1.125rem] text-[14px] font-medium leading-tight text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500';
const APPOINTMENT_FIELD_INPUT_TIGHT =
    'h-10 w-full border-0 bg-transparent px-3 pb-2 pt-3 text-[14px] font-medium leading-tight text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500';
const APPOINTMENT_TEXTAREA =
    'min-h-[120px] w-full resize-y border-0 bg-transparent px-3 pb-3 pt-5 text-[14px] font-medium leading-snug text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500';
const APPOINTMENT_CALENDAR_CLASS =
    'flex h-8 max-h-[32px] w-full overflow-hidden rounded-lg border border-primary-200 bg-white shadow-sm dark:border-primary-700 dark:bg-[#141210] [&_.p-button]:!h-8 [&_.p-button]:!max-h-[32px] [&_.p-button]:!w-10 [&_.p-button]:!shrink-0 [&_.p-button]:!rounded-none [&_.p-button]:!rounded-r-lg [&_.p-button]:!border-0 [&_.p-button]:!bg-primary [&_.p-button]:!px-0 [&_.p-button]:!text-white [&_.p-button]:!shadow-none [&_.p-button]:hover:!bg-primary-600 [&_.p-button-icon]:!h-3.5 [&_.p-button-icon]:!w-3.5';
const APPOINTMENT_CALENDAR_INPUT =
    '!h-8 !min-h-0 !max-h-[32px] !min-w-0 !flex-1 !rounded-none !border-0 !bg-transparent !py-0 !pl-2.5 !pr-1.5 !text-xs !font-normal !leading-8 !text-slate-700 !shadow-none !outline-none !ring-0 placeholder:!text-slate-400 focus:!shadow-none focus:!outline-none focus:!ring-0 dark:!text-gray-200 dark:placeholder:!text-gray-500';
const OUTLINED_DATE_LABEL =
    'pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-white px-1 text-xs font-bold text-dark dark:bg-[#141210] dark:text-gray-200';

const bradenTotal = (s: BradenScores) =>
    s.sensoryPerception + s.moisture + s.activity + s.mobility + s.nutrition + s.frictionShear;

const bradenRisk = (total: number): { label: string; color: string } => {
    if (total <= 9)  return { label: 'Very High Risk 🔴', color: 'text-red-600' };
    if (total <= 12) return { label: 'High Risk 🟠',      color: 'text-orange-500' };
    if (total <= 14) return { label: 'Moderate Risk 🟡',  color: 'text-yellow-500' };
    return              { label: 'Low Risk 🟢',           color: 'text-green-600' };
};

const morseTotal = (s: MorseScores) =>
    s.historyOfFalling + s.secondaryDiagnosis + s.ambulatoryAid + s.ivHepLock + s.gait + s.mentalStatus;

const morseRisk = (total: number): { label: string; color: string } => {
    if (total <= 24) return { label: 'Low Risk 🟢',    color: 'text-green-600' };
    if (total <= 44) return { label: 'Medium Risk 🟡', color: 'text-yellow-500' };
    return              { label: 'High Risk 🔴',       color: 'text-red-600' };
};

const gcsRisk = (total: number): { label: string; color: string } => {
    if (total >= 13) return { label: 'Mild 🟢',     color: 'text-green-600' };
    if (total >= 9)  return { label: 'Moderate 🟡', color: 'text-yellow-500' };
    return               { label: 'Severe 🔴',      color: 'text-red-600' };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RadioGroupProps {
    label: string;
    options: { value: number; text: string }[];
    value: number;
    onChange: (v: number) => void;
    showValue?: boolean;
    showRadioIndicator?: boolean;
}

const RadioGroup = ({ label, options, value, onChange, showValue = true, showRadioIndicator = false }: RadioGroupProps) => (
    <div className="mb-5">
        <p className={LABEL_CLASS}>{label}</p>
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 ${OPTION_BASE_CLASS} ${
                        value === opt.value
                            ? OPTION_ACTIVE_CLASS
                            : OPTION_IDLE_CLASS
                    }`}
                >
                    <input
                        type="radio"
                        className="hidden"
                        checked={value === opt.value}
                        onChange={() => onChange(opt.value)}
                    />
                    {showRadioIndicator ? (
                        <span
                            className={`${RADIO_INDICATOR_BASE} ${
                                value === opt.value
                                    ? RADIO_INDICATOR_ACTIVE
                                    : RADIO_INDICATOR_IDLE
                            }`}
                            aria-hidden
                        >
                            {value === opt.value ? (
                                <span className="h-2 w-2 rounded-full bg-primary" />
                            ) : null}
                        </span>
                    ) : null}
                    {showValue ? <span className="font-bold">{opt.value}</span> : null}
                    <span className={value === opt.value ? 'text-primary' : BODY_TEXT_CLASS}>{opt.text}</span>
                </label>
            ))}
        </div>
    </div>
);

// ─── Braden Scale Tab ─────────────────────────────────────────────────────────

const BRADEN_DEFAULTS: BradenScores = {
    sensoryPerception: 1,
    moisture: 1,
    activity: 1,
    mobility: 1,
    nutrition: 1,
    frictionShear: 1,
};

const BradenScale = ({ encounterId }: { encounterId: string | null }) => {
    const [scores, setScores] = useState<BradenScores>(BRADEN_DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const set = (key: keyof BradenScores) => (v: number) =>
        setScores((prev) => ({ ...prev, [key]: v }));

    const total = bradenTotal(scores);
    const risk  = bradenRisk(total);

    const handleSave = async () => {
        if (!encounterId) { toast.error('Encounter ID not found'); return; }
        setSaving(true);
        try {
            await riskAssessmentAPI.save({
                encounterId,
                assessmentType: 'braden',
                subscores: scores,
                totalScore: total,
                riskLevel: risk.label,
            });
            toast.success('Braden Scale saved');
            setLastSaved(new Date().toLocaleTimeString());
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Load latest on mount
    useEffect(() => {
        if (!encounterId) return;
        riskAssessmentAPI.getLatest(encounterId).then((res) => {
            const data = (res.data as any)?.braden;
            if (data?.subscores) setScores(data.subscores);
        }).catch(() => {});
    }, [encounterId]);

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h4 className={SECTION_TITLE_CLASS}>Braden Scale — Pressure Injury Risk</h4>
                    {lastSaved && <p className={`${MUTED_TEXT_CLASS} mt-0.5`}>Last saved: {lastSaved}</p>}
                </div>
                <div className={`text-xs font-bold ${risk.color}`}>
                    Total: {total} — {risk.label}
                </div>
            </div>

            <RadioGroup
                label="1. Sensory Perception"
                value={scores.sensoryPerception}
                onChange={set('sensoryPerception')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Completely Limited' },
                    { value: 2, text: 'Very Limited' },
                    { value: 3, text: 'Slightly Limited' },
                    { value: 4, text: 'No Impairment' },
                ]}
            />
            <RadioGroup
                label="2. Moisture"
                value={scores.moisture}
                onChange={set('moisture')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Constantly Moist' },
                    { value: 2, text: 'Very Moist' },
                    { value: 3, text: 'Occasionally Moist' },
                    { value: 4, text: 'Rarely Moist' },
                ]}
            />
            <RadioGroup
                label="3. Activity"
                value={scores.activity}
                onChange={set('activity')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Bedfast' },
                    { value: 2, text: 'Chairfast' },
                    { value: 3, text: 'Walks Occasionally' },
                    { value: 4, text: 'Walks Frequently' },
                ]}
            />
            <RadioGroup
                label="4. Mobility"
                value={scores.mobility}
                onChange={set('mobility')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Completely Immobile' },
                    { value: 2, text: 'Very Limited' },
                    { value: 3, text: 'Slightly Limited' },
                    { value: 4, text: 'No Limitations' },
                ]}
            />
            <RadioGroup
                label="5. Nutrition"
                value={scores.nutrition}
                onChange={set('nutrition')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Very Poor' },
                    { value: 2, text: 'Probably Inadequate' },
                    { value: 3, text: 'Adequate' },
                    { value: 4, text: 'Excellent' },
                ]}
            />
            <RadioGroup
                label="6. Friction & Shear"
                value={scores.frictionShear}
                onChange={set('frictionShear')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'Problem' },
                    { value: 2, text: 'Potential Problem' },
                    { value: 3, text: 'No Apparent Problem' },
                ]}
            />

            {/* Score Summary */}
            <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className={LABEL_CLASS}>Total Score (6–23)</p>
                    <p className={`text-xl font-bold ${risk.color}`}>{total}</p>
                    <p className={`mt-0.5 text-xs font-semibold ${risk.color}`}>{risk.label}</p>
                </div>
                <div className={`${MUTED_TEXT_CLASS} space-y-0.5`}>
                    <p>≤9 Very High Risk 🔴</p>
                    <p>10–12 High 🟠</p>
                    <p>13–14 Moderate 🟡</p>
                    <p>≥15 Low Risk 🟢</p>
                </div>
                <AppButton onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Assessment'}
                </AppButton>
            </div>
        </div>
    );
};

// ─── Morse Fall Scale Tab ─────────────────────────────────────────────────────

const MORSE_DEFAULTS: MorseScores = {
    historyOfFalling: 0,
    secondaryDiagnosis: 0,
    ambulatoryAid: 0,
    ivHepLock: 0,
    gait: 0,
    mentalStatus: 0,
};

const MorseFallScale = ({ encounterId }: { encounterId: string | null }) => {
    const [scores, setScores] = useState<MorseScores>(MORSE_DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const set = (key: keyof MorseScores) => (v: number) =>
        setScores((prev) => ({ ...prev, [key]: v }));

    const total = morseTotal(scores);
    const risk  = morseRisk(total);
    const fallPrecautions = total >= 45;

    const handleSave = async () => {
        if (!encounterId) { toast.error('Encounter ID not found'); return; }
        setSaving(true);
        try {
            await riskAssessmentAPI.save({
                encounterId,
                assessmentType: 'morse',
                subscores: scores,
                totalScore: total,
                riskLevel: risk.label,
                interventionsInitiated: fallPrecautions ? ['fall-precautions'] : [],
            });
            toast.success('Morse Fall Scale saved');
            setLastSaved(new Date().toLocaleTimeString());
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!encounterId) return;
        riskAssessmentAPI.getLatest(encounterId).then((res) => {
            const data = (res.data as any)?.morse;
            if (data?.subscores) setScores(data.subscores);
        }).catch(() => {});
    }, [encounterId]);

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h4 className={SECTION_TITLE_CLASS}>Morse Fall Scale</h4>
                    {lastSaved && <p className={`${MUTED_TEXT_CLASS} mt-0.5`}>Last saved: {lastSaved}</p>}
                </div>
                <div className={`text-xs font-bold ${risk.color}`}>
                    Total: {total} — {risk.label}
                </div>
            </div>

            {fallPrecautions && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm font-medium">
                    ⚠️ Fall Precautions Auto-Enabled (Score ≥ 45)
                </div>
            )}

            <RadioGroup
                label="1. History of Falling (last 3 months)"
                value={scores.historyOfFalling}
                onChange={set('historyOfFalling')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'No' },
                    { value: 25, text: 'Yes' },
                ]}
            />
            <RadioGroup
                label="2. Secondary Diagnosis (>1 medical diagnosis)"
                value={scores.secondaryDiagnosis}
                onChange={set('secondaryDiagnosis')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'No' },
                    { value: 15, text: 'Yes' },
                ]}
            />
            <RadioGroup
                label="3. Ambulatory Aid"
                value={scores.ambulatoryAid}
                onChange={set('ambulatoryAid')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'None / Bed Rest' },
                    { value: 15, text: 'Crutches / Cane / Walker' },
                    { value: 30, text: 'Furniture' },
                ]}
            />
            <RadioGroup
                label="4. IV / Hep-Lock"
                value={scores.ivHepLock}
                onChange={set('ivHepLock')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'No' },
                    { value: 20, text: 'Yes' },
                ]}
            />
            <RadioGroup
                label="5. Gait"
                value={scores.gait}
                onChange={set('gait')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'Normal / Bed Rest' },
                    { value: 10, text: 'Weak' },
                    { value: 20, text: 'Impaired' },
                ]}
            />
            <RadioGroup
                label="6. Mental Status"
                value={scores.mentalStatus}
                onChange={set('mentalStatus')}
                showRadioIndicator
                options={[
                    { value: 0,  text: 'Oriented to own ability' },
                    { value: 15, text: 'Forgets limitations' },
                ]}
            />

            {/* Score Summary */}
            <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className={LABEL_CLASS}>Total Score (0–125)</p>
                    <p className={`text-xl font-bold ${risk.color}`}>{total}</p>
                    <p className={`mt-0.5 text-xs font-semibold ${risk.color}`}>{risk.label}</p>
                </div>
                <div className={`${MUTED_TEXT_CLASS} space-y-0.5`}>
                    <p>0–24 Low Risk 🟢</p>
                    <p>25–44 Medium Risk 🟡</p>
                    <p>≥45 High Risk 🔴</p>
                </div>
                <AppButton onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Assessment'}
                </AppButton>
            </div>
        </div>
    );
};

// ─── Glasgow Coma Scale Tab ──────────────────────────────────────────────────

const GCS_DEFAULTS: GCSScores = { eye: 4, verbal: 5, motor: 6 };

const GlasgowComaScale = ({ encounterId }: { encounterId: string | null }) => {
    const [scores, setScores] = useState<GCSScores>(GCS_DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const set = (key: keyof GCSScores) => (v: number) =>
        setScores((prev) => ({ ...prev, [key]: v }));

    const total = scores.eye + scores.verbal + scores.motor;
    const risk  = gcsRisk(total);

    const handleSave = async () => {
        if (!encounterId) { toast.error('Encounter ID not found'); return; }
        setSaving(true);
        try {
            await riskAssessmentAPI.save({
                encounterId,
                assessmentType: 'gcs',
                subscores: scores,
                totalScore: total,
                riskLevel: risk.label,
            });
            toast.success('GCS saved');
            setLastSaved(new Date().toLocaleTimeString());
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!encounterId) return;
        riskAssessmentAPI.getLatest(encounterId).then((res) => {
            const d = (res.data as any)?.gcs;
            if (d?.subscores) setScores(d.subscores);
        }).catch(() => {});
    }, [encounterId]);

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h4 className={SECTION_TITLE_CLASS}>Glasgow Coma Scale (GCS)</h4>
                    {lastSaved && <p className={`${MUTED_TEXT_CLASS} mt-0.5`}>Last saved: {lastSaved}</p>}
                </div>
                <div className={`text-xs font-bold ${risk.color}`}>
                    Total: {total} — {risk.label}
                </div>
            </div>

            <RadioGroup
                label="1. Eye Opening (E)"
                value={scores.eye}
                onChange={set('eye')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'None' },
                    { value: 2, text: 'To Pain' },
                    { value: 3, text: 'To Voice' },
                    { value: 4, text: 'Spontaneous' },
                ]}
            />
            <RadioGroup
                label="2. Verbal Response (V)"
                value={scores.verbal}
                onChange={set('verbal')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'None' },
                    { value: 2, text: 'Incomprehensible' },
                    { value: 3, text: 'Inappropriate' },
                    { value: 4, text: 'Confused' },
                    { value: 5, text: 'Oriented' },
                ]}
            />
            <RadioGroup
                label="3. Motor Response (M)"
                value={scores.motor}
                onChange={set('motor')}
                showValue={false}
                showRadioIndicator
                options={[
                    { value: 1, text: 'None' },
                    { value: 2, text: 'Extension' },
                    { value: 3, text: 'Flexion' },
                    { value: 4, text: 'Withdraws' },
                    { value: 5, text: 'Localizes' },
                    { value: 6, text: 'Obeys' },
                ]}
            />

            <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className={LABEL_CLASS}>Total GCS (3–15)</p>
                    <p className={`text-xl font-bold ${risk.color}`}>{total}</p>
                    <p className={`mt-0.5 text-xs font-semibold ${risk.color}`}>{risk.label}</p>
                    <p className={`${MUTED_TEXT_CLASS} mt-1`}>E{scores.eye} V{scores.verbal} M{scores.motor}</p>
                </div>
                <div className={`${MUTED_TEXT_CLASS} space-y-0.5`}>
                    <p>13–15 Mild 🟢</p>
                    <p>9–12 Moderate 🟡</p>
                    <p>3–8 Severe 🔴</p>
                </div>
                <AppButton onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Assessment'}
                </AppButton>
            </div>
        </div>
    );
};

// ─── Pain Assessment Tab ─────────────────────────────────────────────────────

const PAIN_CHARACTERS = ['Sharp', 'Dull', 'Burning', 'Aching', 'Stabbing'];

const SCALE_MAX: Record<PainScale, number> = { NRS: 10, FLACC: 10, CPOT: 8, WongBaker: 10 };

const WONG_BAKER_FACES = [
    { score: 0,  emoji: '😊', label: 'No Hurt' },
    { score: 2,  emoji: '🙂', label: 'Hurts Little Bit' },
    { score: 4,  emoji: '😐', label: 'Hurts Little More' },
    { score: 6,  emoji: '😟', label: 'Hurts Even More' },
    { score: 8,  emoji: '😢', label: 'Hurts Whole Lot' },
    { score: 10, emoji: '😭', label: 'Hurts Worst' },
];

const BODY_REGIONS = [
    { id: 'head',          label: 'Head',           cx: 100, cy: 30,  r: 22 },
    { id: 'neck',          label: 'Neck',           cx: 100, cy: 62,  r: 10 },
    { id: 'chest',         label: 'Chest',          cx: 100, cy: 100, r: 22 },
    { id: 'abdomen',       label: 'Abdomen',        cx: 100, cy: 145, r: 20 },
    { id: 'pelvis',        label: 'Pelvis',         cx: 100, cy: 183, r: 16 },
    { id: 'left-shoulder', label: 'L Shoulder',     cx: 62,  cy: 85,  r: 13 },
    { id: 'right-shoulder',label: 'R Shoulder',     cx: 138, cy: 85,  r: 13 },
    { id: 'left-arm',      label: 'L Arm',          cx: 48,  cy: 125, r: 12 },
    { id: 'right-arm',     label: 'R Arm',          cx: 152, cy: 125, r: 12 },
    { id: 'left-hand',     label: 'L Hand',         cx: 40,  cy: 163, r: 10 },
    { id: 'right-hand',    label: 'R Hand',         cx: 160, cy: 163, r: 10 },
    { id: 'left-thigh',    label: 'L Thigh',        cx: 82,  cy: 220, r: 14 },
    { id: 'right-thigh',   label: 'R Thigh',        cx: 118, cy: 220, r: 14 },
    { id: 'left-knee',     label: 'L Knee',         cx: 80,  cy: 258, r: 11 },
    { id: 'right-knee',    label: 'R Knee',         cx: 120, cy: 258, r: 11 },
    { id: 'left-foot',     label: 'L Foot',         cx: 78,  cy: 300, r: 11 },
    { id: 'right-foot',    label: 'R Foot',         cx: 122, cy: 300, r: 11 },
];

const calcReassessment = (priority: 'STAT' | 'routine') => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (priority === 'STAT' ? 60 : 240));
    return d.toISOString().slice(0, 16);
};

const parseLocalDateTime = (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const PAIN_DEFAULTS: PainAssessmentData = {
    scale: 'NRS',
    score: 0,
    location: '',
    character: [],
    intervention: '',
    response: '',
    reassessmentDue: calcReassessment('routine'),
    priority: 'routine',
};

const PainAssessment = ({ encounterId }: { encounterId: string | null }) => {
    const [data, setData] = useState<PainAssessmentData>(PAIN_DEFAULTS);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const set = useCallback(<K extends keyof PainAssessmentData>(key: K, val: PainAssessmentData[K]) =>
        setData((prev) => ({ ...prev, [key]: val })), []);

    const toggleRegion = (id: string) => {
        setSelectedRegions((prev) => {
            const next = prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id];
            const labels = next.map((r) => BODY_REGIONS.find((b) => b.id === r)?.label ?? r);
            set('location', labels.join(', '));
            return next;
        });
    };

    const toggleChar = (c: string) => {
        set('character', data.character.includes(c)
            ? data.character.filter((x) => x !== c)
            : [...data.character, c]);
    };

    const handlePriorityChange = (p: 'STAT' | 'routine') => {
        setData((prev) => ({ ...prev, priority: p, reassessmentDue: calcReassessment(p) }));
    };

    const scoreColor = (s: number, max: number) => {
        const pct = s / max;
        if (pct >= 0.7) return 'text-red-600';
        if (pct >= 0.4) return 'text-yellow-500';
        return 'text-green-600';
    };

    const handleSave = async () => {
        if (!encounterId) { toast.error('Encounter ID not found'); return; }
        setSaving(true);
        try {
            await riskAssessmentAPI.save({
                encounterId,
                assessmentType: 'pain',
                subscores: data,
                totalScore: data.score,
                riskLevel: `${data.scale} ${data.score}/${SCALE_MAX[data.scale]}`,
            });
            toast.success('Pain Assessment saved');
            setLastSaved(new Date().toLocaleTimeString());
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!encounterId) return;
        riskAssessmentAPI.getLatest(encounterId).then((res) => {
            const d = (res.data as any)?.pain;
            if (d?.subscores) {
                setData(d.subscores);
                if (d.subscores.location) {
                    const ids = BODY_REGIONS
                        .filter((b) => d.subscores.location.includes(b.label))
                        .map((b) => b.id);
                    setSelectedRegions(ids);
                }
            }
        }).catch(() => {});
    }, [encounterId]);

    const max = SCALE_MAX[data.scale];

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h4 className={SECTION_TITLE_CLASS}>Pain Assessment</h4>
                    {lastSaved && <p className={`${MUTED_TEXT_CLASS} mt-0.5`}>Last saved: {lastSaved}</p>}
                </div>
                <span className={`text-base font-bold ${scoreColor(data.score, max)}`}>
                    {data.score}/{max}
                </span>
            </div>

            {/* 1. Scale */}
            <div className="mb-5">
                <p className={LABEL_CLASS}>1. Scale Used</p>
                <div className="flex flex-wrap gap-2">
                    {(['NRS', 'FLACC', 'CPOT', 'WongBaker'] as PainScale[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => { set('scale', s); set('score', 0); }}
                            className={`flex items-center gap-2 ${OPTION_BASE_CLASS} ${
                                data.scale === s
                                    ? OPTION_ACTIVE_CLASS
                                    : OPTION_IDLE_CLASS
                            }`}
                        >
                            <span
                                className={`${RADIO_INDICATOR_BASE} ${
                                    data.scale === s ? RADIO_INDICATOR_ACTIVE : RADIO_INDICATOR_IDLE
                                }`}
                                aria-hidden
                            >
                                {data.scale === s ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                            </span>
                            {s === 'WongBaker' ? 'Wong-Baker Faces' : s === 'NRS' ? 'NRS 0–10' : s === 'FLACC' ? 'FLACC (pediatric)' : 'CPOT (ICU/non-verbal)'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Score */}
            <div className="mb-5">
                <p className={LABEL_CLASS}>2. Score</p>
                {data.scale === 'WongBaker' ? (
                    <div className="flex flex-wrap gap-3">
                        {WONG_BAKER_FACES.map((f) => (
                            <button
                                key={f.score}
                                type="button"
                                onClick={() => set('score', f.score)}
                                className={`flex flex-col items-center ${OPTION_BASE_CLASS} ${
                                    data.score === f.score
                                        ? OPTION_ACTIVE_CLASS
                                        : OPTION_IDLE_CLASS
                                }`}
                            >
                                <span className="text-2xl">{f.emoji}</span>
                                <span className={`${MUTED_TEXT_CLASS} mt-0.5`}>{f.score}</span>
                                <span className={MUTED_TEXT_CLASS}>{f.label}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min={0}
                            max={max}
                            value={data.score}
                            onChange={(e) => set('score', Number(e.target.value))}
                            className="flex-1 accent-primary"
                        />
                        <span className={`w-10 text-center text-base font-bold ${scoreColor(data.score, max)}`}>
                            {data.score}
                        </span>
                    </div>
                )}
            </div>

            {/* 3. Location — SVG body diagram */}
            <div className="mb-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <svg viewBox="0 0 200 320" className="w-40 shrink-0 border rounded-xl bg-gray-50 dark:bg-white/5">
                        {BODY_REGIONS.map((b) => (
                            <g key={b.id} onClick={() => toggleRegion(b.id)} className="cursor-pointer">
                                <circle
                                    cx={b.cx} cy={b.cy} r={b.r}
                                    fill={selectedRegions.includes(b.id) ? '#ef4444' : '#d1d5db'}
                                    fillOpacity={selectedRegions.includes(b.id) ? 0.8 : 0.4}
                                    stroke={selectedRegions.includes(b.id) ? '#dc2626' : '#9ca3af'}
                                    strokeWidth={1.5}
                                />
                                <text x={b.cx} y={b.cy + 1} textAnchor="middle" dominantBaseline="middle"
                                    fontSize={b.r > 15 ? 7 : 6} fill="#374151" fontWeight="500">
                                    {b.label}
                                </text>
                            </g>
                        ))}
                    </svg>
                    <div className="flex-1">
                        <div className={APPOINTMENT_FIELD_FRAME}>
                            <span className={APPOINTMENT_FLOAT_LABEL}>Location</span>
                            <input
                                type="text"
                                value={data.location}
                                onChange={(e) => set('location', e.target.value)}
                                placeholder="Click regions or type location"
                                className={APPOINTMENT_FIELD_INPUT_TIGHT}
                            />
                        </div>
                        {selectedRegions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {selectedRegions.map((id) => (
                                    <span key={id} className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                                        {BODY_REGIONS.find((b) => b.id === id)?.label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Character */}
            <div className="mb-5">
                <p className={LABEL_CLASS}>4. Character</p>
                <div className="flex flex-wrap gap-2">
                    {PAIN_CHARACTERS.map((c) => (
                        <label
                            key={c}
                            className={`flex cursor-pointer items-center gap-2 ${OPTION_BASE_CLASS} ${
                                data.character.includes(c)
                                    ? OPTION_ACTIVE_CLASS
                                    : OPTION_IDLE_CLASS
                            }`}
                        >
                            <input type="checkbox" className="hidden" checked={data.character.includes(c)} onChange={() => toggleChar(c)} />
                            <span
                                className={`${RADIO_INDICATOR_BASE} ${
                                    data.character.includes(c) ? RADIO_INDICATOR_ACTIVE : RADIO_INDICATOR_IDLE
                                }`}
                                aria-hidden
                            >
                                {data.character.includes(c) ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                            </span>
                            {c}
                        </label>
                    ))}
                </div>
            </div>

            {/* 5. Intervention */}
            <div className="mb-5">
                <div className={APPOINTMENT_FIELD_FRAME}>
                    <span className={APPOINTMENT_FLOAT_LABEL}>Intervention Given</span>
                    <textarea
                        rows={3}
                        value={data.intervention}
                        onChange={(e) => set('intervention', e.target.value)}
                        placeholder="Describe intervention..."
                        className={APPOINTMENT_TEXTAREA}
                    />
                </div>
            </div>

            {/* 6. Response */}
            <div className="mb-5">
                <div className="max-w-xs">
                    <NewDropdown
                        fieldSize="md"
                        label="Response to Intervention"
                        options={[
                            { value: 'Complete Relief', label: 'Complete Relief' },
                            { value: 'Partial Relief', label: 'Partial Relief' },
                            { value: 'No Relief', label: 'No Relief' },
                        ]}
                        value={data.response}
                        placeholder="Select..."
                        onChange={(value) => set('response', String(value) as PainRelief)}
                    />
                </div>
            </div>

            {/* 7. Re-assessment Due */}
            <div className="mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-2">
                        {(['STAT', 'routine'] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => handlePriorityChange(p)}
                                className={`flex items-center gap-2 ${OPTION_BASE_CLASS} ${
                                    data.priority === p
                                        ? OPTION_ACTIVE_CLASS
                                        : OPTION_IDLE_CLASS
                                }`}
                            >
                                <span
                                    className={`${RADIO_INDICATOR_BASE} ${
                                        data.priority === p ? RADIO_INDICATOR_ACTIVE : RADIO_INDICATOR_IDLE
                                    }`}
                                    aria-hidden
                                >
                                    {data.priority === p ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                                </span>
                                {p === 'STAT' ? 'STAT (+1h)' : 'Routine (+4h)'}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full min-w-[260px] sm:w-[340px]">
                        <span className={OUTLINED_DATE_LABEL}>Re-assessment Due</span>
                        <Calendar
                            value={parseLocalDateTime(data.reassessmentDue)}
                            onChange={(e) => {
                                const value = e.value as Date | null;
                                set('reassessmentDue', value ? formatLocalDateTime(value) : '');
                            }}
                            showTime
                            hourFormat="12"
                            showIcon
                            showButtonBar
                            dateFormat="mm/dd/y"
                            placeholder="MM/DD/YY HH:MM"
                            className={APPOINTMENT_CALENDAR_CLASS}
                            inputClassName={APPOINTMENT_CALENDAR_INPUT}
                            panelClassName="risk-assessment-cal-panel"
                            panelStyle={{ maxWidth: 'min(21rem, calc(100vw - 1.5rem))', width: 'min(21rem, calc(100vw - 1.5rem))' }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <AppButton onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Assessment'}
                </AppButton>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export interface RiskAssessmentsProps {
    /** When true, omit the page title (e.g. nested under Nursing Flowsheet tabs). */
    embedded?: boolean;
}

const TABS = [
    { id: 'fall-risk',       label: 'Fall Risk (Morse)' },
    { id: 'pressure-injury', label: 'Pressure Injury (Braden)' },
    { id: 'pain-assessment', label: 'Pain Assessment' },
    { id: 'gcs',             label: 'Glasgow Coma Scale' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const RiskAssessments = ({ embedded = false }: RiskAssessmentsProps) => {
    const { moduleRootClass } = useFacesheetChartLayout();
    const patientId = usePatientId();
    const [activeTab, setActiveTab] = useState<TabId>('fall-risk');

    // encounterId = patientId for now (adjust if you have a separate encounterId)
    const encounterId = patientId;

    return (
        <div className={moduleRootClass}>
            {!embedded ? (
                <div className="mb-5">
                    <h3 className="text-xl font-semibold">Risk Assessments</h3>
                </div>
            ) : null}

            {/* Tabs */}
            <div className="mb-5 border-b border-gray-200 dark:border-white/10 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                <ul className="flex min-w-max sm:min-w-0 sm:flex-wrap gap-0 -mb-px">
                    {TABS.map((tab) => (
                        <li key={tab.id} className="shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Tab Content */}
            <div className="panel">
                {activeTab === 'fall-risk' && (
                    <MorseFallScale encounterId={encounterId} />
                )}
                {activeTab === 'pressure-injury' && (
                    <BradenScale encounterId={encounterId} />
                )}
                {activeTab === 'pain-assessment' && (
                    <PainAssessment encounterId={encounterId} />
                )}
                {activeTab === 'gcs' && (
                    <GlasgowComaScale encounterId={encounterId} />
                )}

            </div>
        </div>
    );
};

export default RiskAssessments;
