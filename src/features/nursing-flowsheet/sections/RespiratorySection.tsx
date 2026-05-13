import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { MultiSelect } from 'primereact/multiselect';
import {
    COUGH_OPTIONS,
    LUNG_SOUND_CHECKBOX_OPTIONS,
    O2_DEVICE_OPTIONS,
    SPUTUM_COLOR_OPTIONS,
} from '../constants/clinicalOptions';
import { ClinicalField } from '../components/ClinicalField';
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
        <div className="grid grid-cols-12 gap-x-2 gap-y-1">
            <div className="col-span-12 md:col-span-2">
                <ClinicalField fieldId="rr" label="Respiratory rate" abnormal={sev('respiratory.respiratoryRate') !== 'normal'}>
                    <InputNumber
                        value={r.respiratoryRate}
                        onValueChange={(ev) => patchDocument({ respiratory: { ...r, respiratoryRate: ev.value ?? null } })}
                        min={4}
                        max={60}
                        disabled={isChartLocked}
                        className="w-full"
                        inputClassName="!text-[12px]"
                        useGrouping={false}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-2">
                <ClinicalField fieldId="spo2" label="O₂ saturation %" abnormal={sev('respiratory.spo2Percent') !== 'normal'}>
                    <InputNumber
                        value={r.spo2Percent}
                        onValueChange={(ev) => patchDocument({ respiratory: { ...r, spo2Percent: ev.value ?? null } })}
                        min={50}
                        max={100}
                        suffix="%"
                        disabled={isChartLocked}
                        className="w-full"
                        inputClassName="!text-[12px]"
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-5">
                <ClinicalField fieldId="o2-dev" label="O₂ delivery device">
                    <Dropdown
                        value={r.oxygenDeliveryDevice}
                        options={O2_DEVICE_OPTIONS}
                        onChange={(ev) =>
                            patchDocument({
                                respiratory: {
                                    ...r,
                                    oxygenDeliveryDevice: ev.value ?? '',
                                    o2FlowLpm: ev.value === 'Room Air' ? null : r.o2FlowLpm,
                                },
                            })
                        }
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            {showO2Flow ? (
                <div className="col-span-12 md:col-span-3">
                    <ClinicalField fieldId="o2-flow" label="O₂ flow (L/min)">
                        <InputNumber
                            value={r.o2FlowLpm}
                            onValueChange={(ev) => patchDocument({ respiratory: { ...r, o2FlowLpm: ev.value ?? null } })}
                            min={0}
                            max={80}
                            step={0.5}
                            disabled={isChartLocked}
                            className="w-full"
                            inputClassName="!text-[12px]"
                        />
                    </ClinicalField>
                </div>
            ) : (
                <div className="col-span-12 md:col-span-3" />
            )}
            <div className="col-span-12 md:col-span-6">
                <ClinicalField fieldId="lung-r" label="Lung sounds (right)">
                    <MultiSelect
                        value={r.lungSoundsRight}
                        options={LUNG_SOUND_CHECKBOX_OPTIONS}
                        onChange={(ev) => patchDocument({ respiratory: { ...r, lungSoundsRight: ev.value ?? [] } })}
                        display="chip"
                        className="w-full !text-[12px]"
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-6">
                <ClinicalField fieldId="lung-l" label="Lung sounds (left)">
                    <MultiSelect
                        value={r.lungSoundsLeft}
                        options={LUNG_SOUND_CHECKBOX_OPTIONS}
                        onChange={(ev) => patchDocument({ respiratory: { ...r, lungSoundsLeft: ev.value ?? [] } })}
                        display="chip"
                        className="w-full !text-[12px]"
                        disabled={isChartLocked}
                    />
                </ClinicalField>
            </div>
            <div className="col-span-12 md:col-span-4">
                <ClinicalField fieldId="cough" label="Cough">
                    <Dropdown
                        value={r.cough}
                        options={COUGH_OPTIONS}
                        onChange={(ev) =>
                            patchDocument({
                                respiratory: {
                                    ...r,
                                    cough: ev.value ?? '',
                                    productiveSputumColor: ev.value === 'Productive' ? r.productiveSputumColor : '',
                                },
                            })
                        }
                        disabled={isChartLocked}
                        className="w-full !text-[12px]"
                        placeholder="—"
                    />
                </ClinicalField>
            </div>
            {showSputum ? (
                <div className="col-span-12 md:col-span-4">
                    <ClinicalField fieldId="sputum-color" label="Sputum color (productive)">
                        <Dropdown
                            value={r.productiveSputumColor}
                            options={SPUTUM_COLOR_OPTIONS}
                            onChange={(ev) => patchDocument({ respiratory: { ...r, productiveSputumColor: ev.value ?? '' } })}
                            disabled={isChartLocked}
                            className="w-full !text-[12px]"
                            placeholder="—"
                        />
                    </ClinicalField>
                </div>
            ) : null}
        </div>
    );
}
