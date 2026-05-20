import { useEffect, useId, useState } from 'react';
import AppButton from '@/components/ui/AppButton';
import { AppModal } from '../../../components/shared/AppModal';
import type { NandaSearchResult } from '../types/carePlan.types';
import { CARE_PLAN_PRIORITIES, CARE_PLAN_DIAGNOSIS_STATUSES } from '../constants/carePlanOptions';
import { useCarePlan } from '../state/CarePlanContext';
import {
    CarePlanDropdown,
    CarePlanNandaSearch,
    CarePlanTextarea,
    CarePlanReadOnlyField,
} from './CarePlanStyledFields';

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

    return (
        <AppModal
            open={visible}
            title="Add NANDA diagnosis"
            description="Search the NANDA catalog and document etiology and evidence for this encounter."
            size="lg"
            onClose={onHide}
            footer={
                <div className="flex justify-end gap-2">
                    <AppButton type="button" onClick={onHide}>
                        Cancel
                    </AppButton>
                    <AppButton type="button" disabled={!selected?.code} onClick={submit}>
                        Add diagnosis
                    </AppButton>
                </div>
            }
        >
            <div className="grid gap-3">
                <CarePlanNandaSearch
                    fieldId={`${baseId}-nanda`}
                    label="NANDA diagnosis"
                    value={selected}
                    onChange={setSelected}
                    onSearch={searchNanda}
                    required
                />
                <CarePlanReadOnlyField
                    fieldId={`${baseId}-code`}
                    label="NANDA code"
                    value={selected?.code || ''}
                    placeholder="Auto-populated"
                />
                <CarePlanTextarea
                    fieldId={`${baseId}-related`}
                    label="Related to (etiology)"
                    value={relatedTo}
                    onChange={setRelatedTo}
                />
                <CarePlanTextarea
                    fieldId={`${baseId}-evidence`}
                    label="Evidenced by"
                    value={evidencedBy}
                    onChange={setEvidencedBy}
                />
                <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
        </AppModal>
    );
}
