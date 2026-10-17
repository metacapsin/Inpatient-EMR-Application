import {
    EXTREMITY_MOVEMENT_OPTIONS,
    LEVEL_OF_CONSCIOUSNESS_OPTIONS,
    NEURO_ORIENTATION_OPTIONS,
    PUPIL_FINDING_OPTIONS,
} from '../constants/clinicalOptions';
import { ClinicalField } from '../components/ClinicalField';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedMultiSelect,
    NFS_FLOAT_FIELD_LABEL,
    NFS_SECTION_GRID_CLASS,
} from '../components/FlowsheetStyledFields';
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
        <div className={NFS_SECTION_GRID_CLASS}>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="loc"
                    label="Level of consciousness"
                    options={LEVEL_OF_CONSCIOUSNESS_OPTIONS}
                    value={n.levelOfConsciousness}
                    onChange={(v) => patchDocument({ neurological: { ...n, levelOfConsciousness: String(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="neuro-orient" label="Orientation" omitLabel>
                    <FlowsheetOutlinedMultiSelect
                        fieldId="neuro-orient"
                        label="Orientation"
                        value={n.orientation}
                        options={NEURO_ORIENTATION_OPTIONS}
                        onChange={(next) => patchDocument({ neurological: { ...n, orientation: next } })}
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="pupil-l"
                    label="Left pupil"
                    options={PUPIL_FINDING_OPTIONS}
                    value={n.leftPupil}
                    onChange={(v) => patchDocument({ neurological: { ...n, leftPupil: String(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="pupil-r"
                    label="Right pupil"
                    options={PUPIL_FINDING_OPTIONS}
                    value={n.rightPupil}
                    onChange={(v) => patchDocument({ neurological: { ...n, rightPupil: String(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="gcs-e"
                    label="GCS — Eye opening"
                    error={e['neurological.gcs']}
                    abnormal={fieldClinicalSeverity('neurological.gcsE', f) !== 'normal'}
                    options={GCS_E_OPTS}
                    value={n.gcsE ?? ''}
                    onChange={(v) => patchDocument({ neurological: { ...n, gcsE: typeof v === 'number' ? v : Number(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="gcs-v"
                    label="GCS — Verbal"
                    abnormal={fieldClinicalSeverity('neurological.gcsV', f) !== 'normal'}
                    options={GCS_V_OPTS}
                    value={n.gcsV ?? ''}
                    onChange={(v) => patchDocument({ neurological: { ...n, gcsV: typeof v === 'number' ? v : Number(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="gcs-m"
                    label="GCS — Motor"
                    abnormal={fieldClinicalSeverity('neurological.gcsM', f) !== 'normal'}
                    options={GCS_M_OPTS}
                    value={n.gcsM ?? ''}
                    onChange={(v) => patchDocument({ neurological: { ...n, gcsM: typeof v === 'number' ? v : Number(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="gcs-total" label="GCS total (auto)" omitLabel>
                    <div
                        className={`relative isolate flex h-8 min-h-8 items-center justify-center overflow-visible rounded-lg px-3 text-xs font-semibold shadow-sm tabular-nums ${gcsBorder}`}
                    >
                        <span className={NFS_FLOAT_FIELD_LABEL}>GCS total (auto)</span>
                        <div className="flex flex-1 items-center justify-center pt-[0.5625rem] tabular-nums" role="status" aria-live="polite">
                            {total == null ? '—' : total}
                        </div>
                    </div>
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="ext-mov"
                    label="Extremity movement"
                    options={EXTREMITY_MOVEMENT_OPTIONS}
                    value={n.extremityMovement}
                    onChange={(v) => patchDocument({ neurological: { ...n, extremityMovement: String(v) } })}
                    disabled={isChartLocked}
                />
            </div>
            <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
        </div>
    );
}
