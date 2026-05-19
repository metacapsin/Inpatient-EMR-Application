import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import NewDropdown from '../../../components/ui/NewDropdown';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import {
    findQuickImagingProcedure,
    QUICK_IMAGING_PROCEDURES,
} from '../../radiology/constants/quickImagingProcedures';
import type { CreateRadiologyOrderPayload, RadiologyPriority } from '../../radiology/types/radiologyOrder.types';
import type { RadiologyOrderFormValues } from '../../radiology/types/radiologyOrderForm.types';
import {
    EMPTY_RADIOLOGY_ORDER_FORM,
    formValuesToCreatePayload,
    type RadiologyOrderFormContext,
} from '../../radiology/utils/radiologyOrderFormMappers';

const PRIORITY_OPTIONS: { value: RadiologyPriority; label: string }[] = [
    { value: 'Routine', label: 'Routine' },
    { value: 'Urgent', label: 'Urgent' },
    { value: 'STAT', label: 'STAT' },
];

const PROCEDURE_OPTIONS = QUICK_IMAGING_PROCEDURES.map((p) => ({
    value: p.id,
    label: p.label,
    keywords: `${p.modality} ${p.bodyRegion} ${p.keywords ?? ''}`,
}));

export type InpatientRadiologyQuickOrderFormProps = {
    formContext: RadiologyOrderFormContext;
    disabled?: boolean;
    submitting?: boolean;
    onSubmit: (payload: CreateRadiologyOrderPayload) => Promise<void>;
    onCancel: () => void;
};

function buildFormFromQuickSelection(
    procedureId: string,
    priority: RadiologyPriority,
    clinicalIndication: string
): RadiologyOrderFormValues | null {
    const procedure = findQuickImagingProcedure(procedureId);
    if (!procedure) return null;
    return {
        ...EMPTY_RADIOLOGY_ORDER_FORM,
        modality: procedure.modality,
        bodyRegion: procedure.bodyRegion,
        contrast: procedure.contrast ?? '',
        clinicalIndication: clinicalIndication.trim(),
        priority,
        icd10Codes: [],
    };
}

export function InpatientRadiologyQuickOrderForm({
    formContext,
    disabled,
    submitting,
    onSubmit,
    onCancel,
}: InpatientRadiologyQuickOrderFormProps) {
    const [procedureId, setProcedureId] = useState('');
    const [priority, setPriority] = useState<RadiologyPriority>('Routine');
    const [clinicalIndication, setClinicalIndication] = useState('');
    const [indicationError, setIndicationError] = useState('');
    const [procedureError, setProcedureError] = useState('');

    const reset = () => {
        setProcedureId('');
        setPriority('Routine');
        setClinicalIndication('');
        setIndicationError('');
        setProcedureError('');
    };

    const handleSubmit = async () => {
        if (disabled || submitting) return;
        let hasError = false;
        if (!procedureId) {
            setProcedureError('Select a procedure');
            hasError = true;
        } else {
            setProcedureError('');
        }
        if (!clinicalIndication.trim()) {
            setIndicationError('Clinical indication is required');
            hasError = true;
        } else {
            setIndicationError('');
        }
        if (hasError) return;

        const form = buildFormFromQuickSelection(procedureId, priority, clinicalIndication);
        if (!form) {
            setProcedureError('Select a procedure');
            return;
        }

        const payload = formValuesToCreatePayload(form, formContext);
        await onSubmit(payload);
        reset();
    };

    return (
        <div className="flex min-h-0 flex-col gap-4">
            <div className="space-y-3">
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Procedure</label>
                    <SearchableSelect
                        options={PROCEDURE_OPTIONS}
                        value={procedureId}
                        onChange={(v) => {
                            setProcedureId(String(v));
                            if (procedureError) setProcedureError('');
                        }}
                        placeholder="Search radiology procedure…"
                        disabled={disabled || submitting}
                        allowEmpty
                        emptyRowLabel="Select procedure…"
                    />
                    {procedureError ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{procedureError}</p>
                    ) : null}
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label>
                    <NewDropdown
                        options={PRIORITY_OPTIONS}
                        value={priority}
                        onChange={(v) => setPriority(v as RadiologyPriority)}
                        placeholder="Priority"
                        disabled={disabled || submitting}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Clinical indication
                    </label>
                    <textarea
                        rows={3}
                        value={clinicalIndication}
                        onChange={(e) => {
                            setClinicalIndication(e.target.value);
                            if (indicationError) setIndicationError('');
                        }}
                        disabled={disabled || submitting}
                        placeholder="Reason for study (required)…"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                    {indicationError ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{indicationError}</p>
                    ) : null}
                </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <AppButton
                    type="button"
                    disabled={disabled || !procedureId || submitting}
                    onClick={() => void handleSubmit()}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" aria-hidden />
                            Placing…
                        </>
                    ) : (
                        'Place radiology order'
                    )}
                </AppButton>
                <button
                    type="button"
                    className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    disabled={submitting}
                    onClick={() => {
                        reset();
                        onCancel();
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
