import { useEffect, useMemo, useState } from 'react';
import AppButton from '../../../components/ui/AppButton';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';
import type { CreateRadiologyOrderPayload } from '../types/radiologyOrder.types';
import type { RadiologyOrderFormValues } from '../types/radiologyOrderForm.types';
import {
    bodyRegionsForModality,
    CONTRAST_OPTIONS,
    LATERALITY_OPTIONS,
    MODALITY_OPTIONS,
    PREGNANCY_STATUS_OPTIONS,
    RADIOLOGY_PRIORITIES,
    toSelectOptions,
    TRANSPORT_OPTIONS,
} from '../constants/radiologyOptions';
import { RADIOLOGY_SECTION_CARD_CLASS } from '../constants/radiologyLayout';
import {
    EMPTY_RADIOLOGY_ORDER_FORM,
    formValuesToCreatePayload,
    scheduledForFromIso,
    scheduledForToIso,
    validateCreateImagingOrder,
    type RadiologyOrderFormContext,
} from '../utils/radiologyOrderFormMappers';
import { Icd10MultiTypeahead, type Icd10Option } from './Icd10MultiTypeahead';

const FORM_GRID_CLASS = `${NFS_SECTION_GRID_CLASS} gap-y-5`;

type ImagingOrderEntryFormProps = {
    formContext: RadiologyOrderFormContext | null;
    initialValues: RadiologyOrderFormValues | null;
    draftLoading?: boolean;
    icdSuggestions?: Icd10Option[];
    disabled?: boolean;
    submitting?: boolean;
    savingDraft?: boolean;
    variant?: 'card' | 'embedded';
    onCreateOrder: (payload: CreateRadiologyOrderPayload) => Promise<void>;
    onSaveDraft: (form: RadiologyOrderFormValues) => Promise<void>;
    onCancel: () => void;
    onSaved?: () => void;
};

function applyFormValues(values: RadiologyOrderFormValues) {
    return { ...values, icd10Codes: [...values.icd10Codes] };
}

export function ImagingOrderEntryForm({
    formContext,
    initialValues,
    draftLoading,
    icdSuggestions = [],
    disabled,
    submitting,
    savingDraft,
    onCreateOrder,
    onSaveDraft,
    onCancel,
    onSaved,
    variant = 'card',
}: ImagingOrderEntryFormProps) {
    const [form, setForm] = useState<RadiologyOrderFormValues>(() =>
        initialValues ? applyFormValues(initialValues) : { ...EMPTY_RADIOLOGY_ORDER_FORM }
    );
    const [indicationError, setIndicationError] = useState('');
    const [hydratedKey, setHydratedKey] = useState<string | null>(null);

    const bodyRegionOptions = useMemo(() => bodyRegionsForModality(form.modality), [form.modality]);
    const priorityOptions = useMemo(() => toSelectOptions([...RADIOLOGY_PRIORITIES]), []);
    const scheduledFor = useMemo(() => scheduledForFromIso(form.scheduledForIso), [form.scheduledForIso]);

    const encounterId = formContext?.encounterId ?? '';
    const orderedByName = formContext?.orderedByName ?? '';

    useEffect(() => {
        if (draftLoading) return;
        const key = initialValues
            ? JSON.stringify(initialValues)
            : `empty-${encounterId}`;
        if (hydratedKey === key) return;
        setForm(initialValues ? applyFormValues(initialValues) : { ...EMPTY_RADIOLOGY_ORDER_FORM });
        setIndicationError('');
        setHydratedKey(key);
    }, [initialValues, draftLoading, encounterId, hydratedKey]);

    useEffect(() => {
        if (!form.modality) return;
        const regions = bodyRegionsForModality(form.modality).map((r) => r.value);
        if (form.bodyRegion && !regions.includes(form.bodyRegion)) {
            setForm((prev) => ({ ...prev, bodyRegion: '' }));
        }
    }, [form.modality, form.bodyRegion]);

    const patch = (partial: Partial<RadiologyOrderFormValues>) => {
        setForm((prev) => ({ ...prev, ...partial }));
    };

    const resetLocal = () => {
        setForm({ ...EMPTY_RADIOLOGY_ORDER_FORM });
        setIndicationError('');
        setHydratedKey(`cleared-${Date.now()}`);
    };

    const handleCancel = () => {
        resetLocal();
        onCancel();
    };

    const handleSaveDraft = async () => {
        if (!formContext || disabled) return;
        await onSaveDraft(form);
    };

    const handleCreate = async () => {
        if (!formContext || disabled) return;
        const validation = validateCreateImagingOrder(form);
        if (!validation.valid) {
            if (validation.indicationError) setIndicationError(validation.indicationError);
            return;
        }
        setIndicationError('');
        const payload = formValuesToCreatePayload(form, formContext);
        await onCreateOrder(payload);
        resetLocal();
        onSaved?.();
    };

    const handleSaveDraftClick = async () => {
        await handleSaveDraft();
    };

    const busy = submitting || savingDraft;

    const body = (
        <>
            <div className={FORM_GRID_CLASS}>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-modality"
                        label="Modality"
                        options={[...MODALITY_OPTIONS]}
                        value={form.modality}
                        onChange={(v) => patch({ modality: String(v) })}
                        disabled={disabled || draftLoading}
                        required
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-body-region"
                        label="Body Region"
                        options={bodyRegionOptions}
                        value={form.bodyRegion}
                        onChange={(v) => patch({ bodyRegion: String(v) })}
                        disabled={disabled || draftLoading || !form.modality}
                        required
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-laterality"
                        label="Laterality"
                        options={LATERALITY_OPTIONS}
                        value={form.laterality}
                        onChange={(v) => patch({ laterality: String(v) })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-contrast"
                        label="Contrast"
                        options={CONTRAST_OPTIONS}
                        value={form.contrast}
                        onChange={(v) => patch({ contrast: String(v) })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12">
                    <FlowsheetOutlinedTextarea
                        fieldId="rad-clinical-indication"
                        label="Clinical Indication"
                        value={form.clinicalIndication}
                        onChange={(v) => patch({ clinicalIndication: v })}
                        disabled={disabled || draftLoading}
                        placeholder="Reason for study…"
                    />
                    {indicationError ? (
                        <p className="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400">{indicationError}</p>
                    ) : null}
                </div>
                <div className="col-span-12 md:col-span-6">
                    <Icd10MultiTypeahead
                        fieldId="rad-icd10"
                        label="ICD-10 Code(s)"
                        value={form.icd10Codes}
                        onChange={(codes) => patch({ icd10Codes: codes })}
                        extraSuggestions={icdSuggestions}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-3">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-priority"
                        label="Priority"
                        options={priorityOptions}
                        value={form.priority}
                        onChange={(v) => patch({ priority: String(v) })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-9">
                    <FlowsheetOutlinedTextInput
                        fieldId="rad-lab-values"
                        label="Relevant Lab Values"
                        value={form.relevantLabValues}
                        onChange={(v) => patch({ relevantLabValues: v })}
                        disabled={disabled || draftLoading}
                        placeholder="e.g. Creatinine 1.2 mg/dL"
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-pregnancy"
                        label="Pregnancy Status"
                        options={PREGNANCY_STATUS_OPTIONS}
                        value={form.pregnancyStatus}
                        onChange={(v) => patch({ pregnancyStatus: String(v) })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="rad-transport"
                        label="Transport Required"
                        options={TRANSPORT_OPTIONS}
                        value={form.transportRequired}
                        onChange={(v) => patch({ transportRequired: String(v) })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedCalendar
                        fieldId="rad-schedule"
                        label="Schedule For"
                        value={scheduledFor}
                        onChange={(d) => patch({ scheduledForIso: scheduledForToIso(d) })}
                        disabled={disabled || draftLoading}
                        showTime
                    />
                </div>
                <div className="col-span-12">
                    <FlowsheetOutlinedTextarea
                        fieldId="rad-special-instructions"
                        label="Special Instructions"
                        value={form.specialInstructions}
                        onChange={(v) => patch({ specialInstructions: v })}
                        disabled={disabled || draftLoading}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <FlowsheetOutlinedTextInput
                        fieldId="rad-ordered-by"
                        label="Ordered By"
                        value={orderedByName}
                        onChange={() => {}}
                        readOnly
                        disabled
                    />
                </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
                <AppButton
                    type="button"
                    onClick={handleCancel}
                    disabled={disabled || busy || draftLoading}
                    className="!px-3 !py-1.5 text-xs"
                >
                    Cancel
                </AppButton>
                <AppButton
                    type="button"
                    onClick={() => void handleSaveDraftClick()}
                    disabled={disabled || busy || draftLoading || !encounterId}
                    className="!px-3 !py-1.5 text-xs"
                >
                    {savingDraft ? 'Saving…' : 'Save Draft'}
                </AppButton>
                <AppButton
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={disabled || busy || draftLoading || !encounterId}
                    className="!px-3 !py-1.5 text-xs font-semibold"
                >
                    {submitting ? 'Creating…' : 'Create Imaging Order'}
                </AppButton>
            </div>
        </>
    );

    if (variant === 'embedded') {
        return body;
    }

    return (
        <section className={`${RADIOLOGY_SECTION_CARD_CLASS} p-3.5 lg:p-4`}>
            <div className="mb-3 border-b border-gray-100 pb-2 dark:border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                    New imaging order
                </h3>
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                    Save a draft or create an order when required fields are complete
                </p>
            </div>
            {body}
        </section>
    );
}
