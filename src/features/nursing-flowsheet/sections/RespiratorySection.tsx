import {
    COUGH_OPTIONS,
    LUNG_SOUND_CHECKBOX_OPTIONS,
    O2_DEVICE_OPTIONS,
    SPUTUM_COLOR_OPTIONS,
} from '../constants/clinicalOptions';
import { ClinicalField } from '../components/ClinicalField';
import { FlowsheetLabeledDropdown, FlowsheetOutlinedInputNumber, FlowsheetOutlinedMultiSelect, NFS_SECTION_GRID_CLASS } from '../components/FlowsheetStyledFields';
import { fieldClinicalSeverity } from '../utils/clinicalSeverity';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';

export default function RespiratorySection() {
    const { state, patchDocument, isChartLocked } = useNursingFlowsheet();
    const f = state.document;
    const r = f.respiratory;
    const sev = (path: string) => fieldClinicalSeverity(path, f);
    const showO2Flow = r.oxygenDeliveryDevice && r.oxygenDeliveryDevice !== 'Room Air';
    const showSputum = r.cough === 'Productive';

    return (
        <div className={NFS_SECTION_GRID_CLASS}>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="rr" label="Respiratory rate" abnormal={sev('respiratory.respiratoryRate') !== 'normal'} omitLabel>
                    <FlowsheetOutlinedInputNumber
                        fieldId="rr"
                        label="Respiratory rate"
                        value={r.respiratoryRate}
                        onValueChange={(v) => patchDocument({ respiratory: { ...r, respiratoryRate: v } })}
                        min={4}
                        max={60}
                        disabled={isChartLocked}
                        useGrouping={false}
                        abnormal={sev('respiratory.respiratoryRate') !== 'normal'}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="spo2" label="O₂ saturation %" abnormal={sev('respiratory.spo2Percent') !== 'normal'} omitLabel>
                    <FlowsheetOutlinedInputNumber
                        fieldId="spo2"
                        label="O₂ saturation %"
                        value={r.spo2Percent}
                        onValueChange={(v) => patchDocument({ respiratory: { ...r, spo2Percent: v } })}
                        min={50}
                        max={100}
                        suffix="%"
                        disabled={isChartLocked}
                        abnormal={sev('respiratory.spo2Percent') !== 'normal'}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="o2-dev"
                    label="O₂ delivery device"
                    options={O2_DEVICE_OPTIONS}
                    value={r.oxygenDeliveryDevice}
                    onChange={(v) => {
                        const s = String(v);
                        patchDocument({
                            respiratory: {
                                ...r,
                                oxygenDeliveryDevice: s,
                                o2FlowLpm: s === 'Room Air' ? null : r.o2FlowLpm,
                            },
                        });
                    }}
                    disabled={isChartLocked}
                />
            </div>
            {showO2Flow ? (
                <div className="col-span-12 md:col-span-4">
                    <ClinicalField fieldId="o2-flow" label="O₂ flow (L/min)" omitLabel>
                        <FlowsheetOutlinedInputNumber
                            fieldId="o2-flow"
                            label="O₂ flow (L/min)"
                            value={r.o2FlowLpm}
                            onValueChange={(v) => patchDocument({ respiratory: { ...r, o2FlowLpm: v } })}
                            min={0}
                            max={80}
                            step={0.5}
                            disabled={isChartLocked}
                            useGrouping={false}
                        />
                    </ClinicalField>
                </div>
            ) : (
                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
            )}
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="lung-r" label="Lung sounds (right)" omitLabel>
                    <FlowsheetOutlinedMultiSelect
                        fieldId="lung-r"
                        label="Lung sounds (right)"
                        value={r.lungSoundsRight}
                        options={LUNG_SOUND_CHECKBOX_OPTIONS}
                        onChange={(next) => patchDocument({ respiratory: { ...r, lungSoundsRight: next } })}
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="lung-l" label="Lung sounds (left)" omitLabel>
                    <FlowsheetOutlinedMultiSelect
                        fieldId="lung-l"
                        label="Lung sounds (left)"
                        value={r.lungSoundsLeft}
                        options={LUNG_SOUND_CHECKBOX_OPTIONS}
                        onChange={(next) => patchDocument({ respiratory: { ...r, lungSoundsLeft: next } })}
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <FlowsheetLabeledDropdown
                    fieldId="cough"
                    label="Cough"
                    options={COUGH_OPTIONS}
                    value={r.cough}
                    onChange={(v) => {
                        const s = String(v);
                        patchDocument({
                            respiratory: {
                                ...r,
                                cough: s,
                                productiveSputumColor: s === 'Productive' ? r.productiveSputumColor : '',
                            },
                        });
                    }}
                    disabled={isChartLocked}
                />
            </div>
            {showSputum ? (
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="sputum-color"
                        label="Sputum color (productive)"
                        options={SPUTUM_COLOR_OPTIONS}
                        value={r.productiveSputumColor}
                        onChange={(v) => patchDocument({ respiratory: { ...r, productiveSputumColor: String(v) } })}
                        disabled={isChartLocked}
                    />
                </div>
            ) : (
                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
            )}
            <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
        </div>
    );
}
