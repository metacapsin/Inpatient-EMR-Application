import { useEffect, useId, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { AppModal } from '../../../components/shared/AppModal';
import type { NandaSearchResult } from '../types/carePlan.types';
import { CARE_PLAN_PRIORITIES, CARE_PLAN_DIAGNOSIS_STATUSES } from '../constants/carePlanOptions';
import { useCarePlan } from '../state/CarePlanContext';
import {
    CarePlanDropdown,
    CarePlanNandaSearch,
    CarePlanTextarea,
} from './CarePlanStyledFields';
import { CarePlanModalSection } from './CarePlanModalSection';
import { CarePlanSelectedDiagnosisCard } from './CarePlanSelectedDiagnosisCard';
import {
    CARE_PLAN_MODAL_ATTR_GRID_CLASS,
    CARE_PLAN_MODAL_BODY_CLASS,
} from '../constants/carePlanLayout';

type CarePlanAddDiagnosisDialogProps = {
    visible: boolean;
    onHide: () => void;
    prefill?: NandaSearchResult | null;
};

export function CarePlanAddDiagnosisDialog({ visible, onHide, prefill }: CarePlanAddDiagnosisDialogProps) {
    const { searchNanda, addDiagnosisFromNanda } = useCarePlan();
    const baseId = useId();
    const [selected, setSelected] = useState<NandaSearchResult | null>(prefill || null);
    const [relatedTo, setRelatedTo] = useState('');
    const [evidencedBy, setEvidencedBy] = useState('');
    const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
    const [status, setStatus] = useState<'Active' | 'Resolved' | 'Discontinued'>('Active');

    useEffect(() => {
        if (!visible) return;
        setSelected(prefill || null);
        setRelatedTo('');
        setEvidencedBy('');
        setPriority('Medium');
        setStatus('Active');
    }, [visible, prefill]);

    const submit = () => {
        if (!selected?.code || !selected.label) return;
        addDiagnosisFromNanda(selected, { relatedTo, evidencedBy, priority, status });
        onHide();
    };

    const canSubmit = Boolean(selected?.code && selected.label);

    return (
        <AppModal
            open={visible}
            title="Add NANDA diagnosis"
            description="Search the NANDA catalog and document etiology and evidence for this encounter."
            icon={<ClipboardList className="h-5 w-5" strokeWidth={2.25} />}
            size="xl"
            className="max-h-[min(92vh,760px)]"
            bodyClassName={CARE_PLAN_MODAL_BODY_CLASS}
            onClose={onHide}
            footer={
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="text-primary">*</span> NANDA diagnosis is required
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className="btn btn-outline-primary btn-sm min-w-[7.5rem]" onClick={onHide}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm min-w-[9.5rem]"
                            disabled={!canSubmit}
                            onClick={submit}
                        >
                            Add diagnosis
                        </button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-6 pb-1">
                <CarePlanModalSection
                    title="Diagnosis"
                    hint="Type to search the NANDA catalog, or open the list to browse diagnoses."
                >
                    <CarePlanNandaSearch
                        fieldId={`${baseId}-nanda`}
                        label="NANDA diagnosis"
                        value={selected}
                        onChange={setSelected}
                        onSearch={searchNanda}
                        required
                        variant="comfortable"
                    />
                    {selected?.code ? <CarePlanSelectedDiagnosisCard diagnosis={selected} /> : null}
                </CarePlanModalSection>

                <CarePlanModalSection
                    title="Clinical documentation"
                    hint="Describe contributing factors and assessment findings that support this nursing diagnosis."
                >
                    <div className="flex flex-col gap-4">
                        <CarePlanTextarea
                            fieldId={`${baseId}-related`}
                            label="Related to (etiology)"
                            value={relatedTo}
                            onChange={setRelatedTo}
                            rows={3}
                            placeholder="e.g. immobility, surgical procedure, moisture…"
                        />
                        <CarePlanTextarea
                            fieldId={`${baseId}-evidence`}
                            label="Evidenced by"
                            value={evidencedBy}
                            onChange={setEvidencedBy}
                            rows={3}
                            placeholder="e.g. Braden score, skin assessment findings…"
                        />
                    </div>
                </CarePlanModalSection>

                <CarePlanModalSection title="Plan attributes" hint="Set priority and status for this diagnosis on the care plan.">
                    <div className={CARE_PLAN_MODAL_ATTR_GRID_CLASS}>
                        <CarePlanDropdown
                            fieldId={`${baseId}-priority`}
                            label="Priority"
                            value={priority}
                            options={CARE_PLAN_PRIORITIES.map((p) => ({ label: p, value: p }))}
                            onChange={(v) => setPriority(String(v) as typeof priority)}
                        />
                        <CarePlanDropdown
                            fieldId={`${baseId}-status`}
                            label="Status"
                            value={status}
                            options={CARE_PLAN_DIAGNOSIS_STATUSES.map((s) => ({ label: s, value: s }))}
                            onChange={(v) => setStatus(String(v) as typeof status)}
                        />
                    </div>
                </CarePlanModalSection>
            </div>
        </AppModal>
    );
}
