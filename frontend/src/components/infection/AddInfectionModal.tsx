import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppModal } from '../shared/AppModal';
import AppButton from '@/components/ui/AppButton';
import {
    INFECTION_SOURCES,
    INFECTION_STATUSES,
    INFECTION_SEVERITIES,
    INFECTION_TYPES,
    ISOLATION_TYPES,
    createEmptyInfectionForm,
} from '../../data/infectionControlMockData';
import type { InfectionFormErrors, InfectionFormValues, InfectionRecord } from '../../types/infectionControl';
import {
    hasFormErrors,
    infectionToFormValues,
    isInfectionFormValid,
    validateInfectionForm,
} from '../../lib/infectionControlUtils';

const FORM_ID = 'infection-record-form';

const labelClass = 'text-xs font-semibold text-gray-600 dark:text-gray-400';
const inputClass =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100';

type AddInfectionModalProps = {
    open: boolean;
    editing: InfectionRecord | null;
    onClose: () => void;
    onSave: (values: InfectionFormValues) => void;
};

export function AddInfectionModal({ open, editing, onClose, onSave }: AddInfectionModalProps) {
    const [form, setForm] = useState<InfectionFormValues>(createEmptyInfectionForm);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const validationErrors = useMemo(() => validateInfectionForm(form), [form]);
    const canSubmit = useMemo(() => isInfectionFormValid(form), [form]);

    const visibleErrors: InfectionFormErrors = submitAttempted ? validationErrors : {};

    useEffect(() => {
        if (!open) return;
        setForm(editing ? infectionToFormValues(editing) : createEmptyInfectionForm());
        setSubmitAttempted(false);
    }, [open, editing]);

    const updateField = useCallback(<K extends keyof InfectionFormValues>(key: K, value: InfectionFormValues[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const persist = useCallback(() => {
        const nextErrors = validateInfectionForm(form);
        if (hasFormErrors(nextErrors)) {
            setSubmitAttempted(true);
            if (import.meta.env.DEV) {
                console.debug('[InfectionControl] validation failed', { form, nextErrors });
            }
            return;
        }
        if (import.meta.env.DEV) {
            console.debug('[InfectionControl] saving record', form);
        }
        onSave(form);
    }, [form, onSave]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        persist();
    };

    const handleSaveClick = () => {
        persist();
    };

    const isolationOptions = ISOLATION_TYPES.filter((t) => t !== 'None');

    return (
        <AppModal
            open={open}
            title={editing ? 'Edit infection record' : 'Add infection record'}
            description="Document infection type, precautions, and monitoring status."
            onClose={onClose}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <AppButton type="button" onClick={onClose} className="!h-9 !text-xs">
                        Cancel
                    </AppButton>
                    <AppButton
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSaveClick}
                        className="!h-9 !text-xs"
                    >
                        Save
                    </AppButton>
                </div>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                    <label htmlFor="inf-type" className={labelClass}>
                        Infection type <span className="text-red-500">*</span>
                    </label>
                    <select
                        id="inf-type"
                        name="infectionType"
                        required
                        value={form.infectionType}
                        onChange={(e) => updateField('infectionType', e.target.value)}
                        className={inputClass}
                        aria-invalid={Boolean(visibleErrors.infectionType)}
                    >
                        <option value="">Select type…</option>
                        {INFECTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    {visibleErrors.infectionType ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                            {visibleErrors.infectionType}
                        </p>
                    ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="inf-severity" className={labelClass}>
                            Severity <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="inf-severity"
                            name="severity"
                            required
                            value={form.severity}
                            onChange={(e) =>
                                updateField('severity', e.target.value as InfectionFormValues['severity'])
                            }
                            className={inputClass}
                            aria-invalid={Boolean(visibleErrors.severity)}
                        >
                            <option value="">Select…</option>
                            {INFECTION_SEVERITIES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                        {visibleErrors.severity ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                                {visibleErrors.severity}
                            </p>
                        ) : null}
                    </div>
                    <div>
                        <label htmlFor="inf-status" className={labelClass}>
                            Status <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="inf-status"
                            name="status"
                            required
                            value={form.status}
                            onChange={(e) => updateField('status', e.target.value as InfectionFormValues['status'])}
                            className={inputClass}
                            aria-invalid={Boolean(visibleErrors.status)}
                        >
                            <option value="">Select…</option>
                            {INFECTION_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                        {visibleErrors.status ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                                {visibleErrors.status}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div>
                    <label htmlFor="inf-detected" className={labelClass}>
                        Detection date
                    </label>
                    <input
                        id="inf-detected"
                        name="detectedDate"
                        type="date"
                        value={form.detectedDate}
                        onChange={(e) => updateField('detectedDate', e.target.value)}
                        className={inputClass}
                    />
                </div>

                <div>
                    <label htmlFor="inf-symptoms" className={labelClass}>
                        Symptoms
                    </label>
                    <textarea
                        id="inf-symptoms"
                        name="symptoms"
                        rows={2}
                        value={form.symptoms}
                        onChange={(e) => updateField('symptoms', e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Fever, cough"
                    />
                </div>

                <div>
                    <label htmlFor="inf-source" className={labelClass}>
                        Source
                    </label>
                    <select
                        id="inf-source"
                        name="source"
                        value={form.source}
                        onChange={(e) => updateField('source', e.target.value)}
                        className={inputClass}
                    >
                        {INFECTION_SOURCES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Isolation required</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Triggers isolation badge on bed board</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                        <input
                            type="checkbox"
                            name="isolationRequired"
                            className="peer sr-only"
                            checked={form.isolationRequired}
                            onChange={(e) => {
                                const on = e.target.checked;
                                setForm((prev) => ({
                                    ...prev,
                                    isolationRequired: on,
                                    isolationType:
                                        on && (prev.isolationType === 'None' || !prev.isolationType)
                                            ? 'Contact'
                                            : on
                                              ? prev.isolationType
                                              : 'None',
                                }));
                            }}
                        />
                        <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/40 dark:bg-gray-600" />
                        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                    </label>
                </div>

                {form.isolationRequired ? (
                    <div>
                        <label htmlFor="inf-isolation-type" className={labelClass}>
                            Isolation type
                        </label>
                        <select
                            id="inf-isolation-type"
                            name="isolationType"
                            value={form.isolationType === 'None' ? 'Contact' : form.isolationType}
                            onChange={(e) =>
                                updateField('isolationType', e.target.value as InfectionFormValues['isolationType'])
                            }
                            className={inputClass}
                        >
                            {isolationOptions.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <div>
                    <label htmlFor="inf-notes" className={labelClass}>
                        Notes
                    </label>
                    <textarea
                        id="inf-notes"
                        name="notes"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => updateField('notes', e.target.value)}
                        className={inputClass}
                        placeholder="PPE, signage, EVS instructions…"
                    />
                </div>
            </form>
        </AppModal>
    );
}
