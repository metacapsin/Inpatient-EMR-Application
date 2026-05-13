import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import {
    EXTREMITY_MOVEMENT_OPTIONS,
    LEVEL_OF_CONSCIOUSNESS_OPTIONS,
    NEURO_ORIENTATION_OPTIONS,
    PUPIL_FINDING_OPTIONS,
} from '../constants/clinicalOptions';
import { ClinicalField } from '../components/ClinicalField';
import { fieldClinicalSeverity, gcsTotalSeverity } from '../utils/clinicalSeverity';
import { gcsTotal } from '../types/nursingFlowsheet.types';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';

const GCS_E_OPTS = [
    { label: '4 = Spontaneous', value: 4 },
    { label: '3 = To Voice', value: 3 },
    { label: '2 = To Pain', value: 2 },
    { label: '1 = None', value: 1 },
];
const GCS_V_OPTS = [
    { label: '5 = Oriented', value: 5 },
    { label: '4 = Confused', value: 4 },
    { label: '3 = Inappropriate', value: 3 },
    { label: '2 = Incomprehensible', value: 2 },
    { label: '1 = None', value: 1 },
];
const GCS_M_OPTS = [
    { label: '6 = Obeys', value: 6 },
    { label: '5 = Localizes', value: 5 },
    { label: '4 = Withdraws', value: 4 },
    { label: '3 = Flexion', value: 3 },
    { label: '2 = Extension', value: 2 },
    { label: '1 = None', value: 1 },
];

export default function NeurologicalSection() {
    const { state, patchDocument, isChartLocked } = useNursingFlowsheet();
    const f = state.document;
    const n = f.neurological;
    const e = state.validationErrors;
    const total = gcsTotal(n.gcsE, n.gcsV, n.gcsM);
    const gcsSev = gcsTotalSeverity(total);
    const gcsBorder =
        gcsSev === 'critical'
            ? 'border-red-500/80 bg-red-50/90 text-red-900 dark:bg-red-950/40 dark:text-red-100'
            : gcsSev === 'warning'
              ? 'border-amber-500/70 bg-amber-50/90 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100'
              : 'border-emerald-500/60 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100';

    return (
        <div className="grid grid-cols-12 gap-x-2 gap-y-1">
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="loc" label="Level of consciousness">
                    <Dropdown
                        value={n.levelOfConsciousness}
                        options={LEVEL_OF_CONSCIOUSNESS_OPTIONS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, levelOfConsciousness: ev.value ?? '' } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-8">
                <ClinicalField fieldId="neuro-orient" label="Orientation">
                    <MultiSelect
                        value={n.orientation}
                        options={NEURO_ORIENTATION_OPTIONS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, orientation: ev.value ?? [] } })}
                        display="chip"
                        className="w-full !text-[12px]"
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-6">
                <ClinicalField fieldId="pupil-l" label="Left pupil">
                    <Dropdown
                        value={n.leftPupil}
                        options={PUPIL_FINDING_OPTIONS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, leftPupil: ev.value ?? '' } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-6">
                <ClinicalField fieldId="pupil-r" label="Right pupil">
                    <Dropdown
                        value={n.rightPupil}
                        options={PUPIL_FINDING_OPTIONS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, rightPupil: ev.value ?? '' } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField
                    fieldId="gcs-e"
                    label="GCS — Eye opening"
                    error={e['neurological.gcs']}
                    abnormal={fieldClinicalSeverity('neurological.gcsE', f) !== 'normal'}
                >
                    <Dropdown
                        value={n.gcsE}
                        options={GCS_E_OPTS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, gcsE: ev.value ?? null } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="gcs-v" label="GCS — Verbal" abnormal={fieldClinicalSeverity('neurological.gcsV', f) !== 'normal'}>
                    <Dropdown
                        value={n.gcsV}
                        options={GCS_V_OPTS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, gcsV: ev.value ?? null } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="gcs-m" label="GCS — Motor" abnormal={fieldClinicalSeverity('neurological.gcsM', f) !== 'normal'}>
                    <Dropdown
                        value={n.gcsM}
                        options={GCS_M_OPTS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, gcsM: ev.value ?? null } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="gcs-total" label="GCS total (auto)">
                    <div
                        className={`flex h-[2.25rem] items-center rounded-md border px-2 text-[13px] font-semibold tabular-nums ${gcsBorder}`}
                        aria-live="polite"
                    >
                        {total == null ? '—' : total}
                    </div>
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-8">
                <ClinicalField fieldId="ext-mov" label="Extremity movement">
                    <Dropdown
                        value={n.extremityMovement}
                        options={EXTREMITY_MOVEMENT_OPTIONS}
                        onChange={(ev) => patchDocument({ neurological: { ...n, extremityMovement: ev.value ?? '' } })}
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
        </div>
    );
}
