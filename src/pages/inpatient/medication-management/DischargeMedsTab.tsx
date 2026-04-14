import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm, type FieldErrors, type Path } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { DischargeMedLine } from '../../../types/medicationManagement';
import {
    DISCHARGE_FREQUENCY_OPTIONS,
    DISCHARGE_MED_FORM_DEFAULTS,
    dischargeMedFieldDomId,
    dischargeMedsFormSchema,
    firstInvalidDischargeMedPath,
    getError,
    isDischargeMedsFormValuesValid,
    normalizeDischargeFrequency,
    emptyMedicationLine,
    type DischargeMedsFormValues,
} from './dischargeMedsForm.validation';

interface DischargeMedsTabProps {
    patientId: string;
    /** Required for live save to POST /api/discharges/:encounterId/medications */
    encounterId?: string;
}

const cellInputClassName =
    'h-9 w-full min-w-0 rounded border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800';

const cellInputInvalidClassName =
    'border-[#dc2626] ring-1 ring-[#dc2626]/30 focus:border-[#dc2626] focus:ring-[#dc2626]/40 dark:border-[#dc2626]';

const labelClassName = 'text-sm font-medium text-gray-700 dark:text-gray-300';

const errorTextClassName = 'text-[13px] leading-snug text-[#dc2626]';

const footerInputClassName =
    'h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800';

const footerInputInvalidClassName = cellInputInvalidClassName;

function RequiredMark() {
    return (
        <span className="ml-0.5 font-semibold text-[#dc2626]" aria-hidden="true">
            *
        </span>
    );
}

function getTouchedAt(touched: unknown, path: string): boolean {
    const segments = path.split('.');
    let current: unknown = touched;
    for (const seg of segments) {
        if (current == null || typeof current !== 'object') return false;
        current = (current as Record<string, unknown>)[seg];
    }
    return Boolean(current);
}

function shouldShowFieldError(
    errors: FieldErrors<DischargeMedsFormValues>,
    touchedFields: Partial<Record<string, unknown>> | undefined,
    submitCount: number,
    path: string
): boolean {
    return (getTouchedAt(touchedFields, path) || submitCount > 0) && Boolean(getError(errors, path));
}

export function DischargeMedsTab({ patientId, encounterId }: DischargeMedsTabProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shakeForm, setShakeForm] = useState(false);

    const eid = encounterId?.trim() ?? '';

    const {
        register,
        control,
        handleSubmit,
        watch,
        reset,
        setValue,
        getValues,
        setFocus,
        formState: { errors, touchedFields, submitCount },
    } = useForm<DischargeMedsFormValues>({
        resolver: yupResolver(dischargeMedsFormSchema),
        mode: 'onTouched',
        reValidateMode: 'onChange',
        defaultValues: DISCHARGE_MED_FORM_DEFAULTS,
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'medications',
    });

    const formValues = watch();
    const formIsValid = isDischargeMedsFormValuesValid(formValues);

    const touchAllFields = useCallback(() => {
        const v = getValues();
        v.medications.forEach((row, i) => {
            (Object.keys(row) as (keyof DischargeMedLine)[]).forEach((key) => {
                setValue(`medications.${i}.${key}`, row[key], { shouldTouch: true, shouldValidate: false });
            });
        });
        setValue('preparedBy', v.preparedBy, { shouldTouch: true, shouldValidate: false });
        setValue('reviewedBy', v.reviewedBy, { shouldTouch: true, shouldValidate: false });
    }, [getValues, setValue]);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const data = eid
                ? await medApi.getDischargeMedsForEncounter(eid, patientId)
                : await medApi.getDischargeMeds(patientId);
            const meds: DischargeMedLine[] =
                data.medications?.length > 0
                    ? data.medications.map((m) => ({
                          name: m.name ?? '',
                          dose: m.dose ?? '',
                          frequency: normalizeDischargeFrequency(m.frequency ?? '') || '',
                          duration: m.duration ?? '',
                          instructions: m.instructions ?? '',
                      }))
                    : [emptyMedicationLine()];
            reset({
                medications: meds,
                preparedBy: data.preparedBy ?? '',
                reviewedBy: data.reviewedBy ?? '',
                counsellingDone: Boolean(data.counsellingDone),
            });
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load discharge medications');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId, eid, reset]);

    useEffect(() => {
        void load();
    }, [load]);

    function addRow() {
        append(emptyMedicationLine());
    }

    function removeRow(index: number) {
        if (fields.length <= 1) return;
        remove(index);
    }

    const onInvalid = useCallback(
        (submitErrors: FieldErrors<DischargeMedsFormValues>) => {
            touchAllFields();
            setShakeForm(true);
            window.setTimeout(() => setShakeForm(false), 480);
            const medCount = getValues('medications').length;
            const first = firstInvalidDischargeMedPath(submitErrors, medCount);
            if (first) {
                setFocus(first as Path<DischargeMedsFormValues>);
                window.requestAnimationFrame(() => {
                    document.getElementById(dischargeMedFieldDomId(first))?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });
                });
            }
        },
        [getValues, setFocus, touchAllFields]
    );

    const onValid = async (values: DischargeMedsFormValues) => {
        if (!patientId) return;
        if (!eid) {
            toast.error('Select an active encounter before saving discharge medications.');
            return;
        }
        setSaving(true);
        try {
            await medApi.postDischargeMedsForEncounter(eid, {
                patientId,
                medications: values.medications.map((l) => ({
                    name: l.name.trim(),
                    dose: l.dose.trim(),
                    frequency: l.frequency.trim(),
                    duration: l.duration.trim(),
                    instructions: l.instructions.trim(),
                })),
                preparedBy: values.preparedBy.trim(),
                reviewedBy: values.reviewedBy.trim(),
                counsellingDone: values.counsellingDone,
            });
            toast.success('Discharge medication list saved');
            void load();
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const saveDisabled = saving || !eid || loading || !formIsValid;

    return (
        <div className="space-y-4">
            {!eid ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
                    Choose an <strong>active encounter</strong> above. Discharge medications are stored on the encounter for billing and
                    reconciliation.
                </div>
            ) : null}

            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Loading discharge list…
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit(onValid, onInvalid)}
                    noValidate
                    className={cn(
                        'space-y-4',
                        shakeForm && 'rounded-md shadow-[0_0_0_3px_rgba(220,38,38,0.2)] animate-form-shake'
                    )}
                >
                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                        <table className="min-w-[960px] w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/80">
                                <tr>
                                    <th className={`w-[18%] px-3 py-2 align-bottom ${labelClassName}`}>
                                        Medication name
                                        <RequiredMark />
                                    </th>
                                    <th className={`w-[12%] px-3 py-2 align-bottom ${labelClassName}`}>
                                        Dose
                                        <RequiredMark />
                                    </th>
                                    <th className={`w-[12%] px-3 py-2 align-bottom ${labelClassName}`}>
                                        Frequency
                                        <RequiredMark />
                                    </th>
                                    <th className={`w-[12%] px-3 py-2 align-bottom ${labelClassName}`}>
                                        Duration
                                        <RequiredMark />
                                    </th>
                                    <th className={`w-[28%] px-3 py-2 align-bottom ${labelClassName}`}>
                                        Instructions
                                        <RequiredMark />
                                    </th>
                                    <th className="w-[10%] px-3 py-2 align-bottom" aria-hidden="true" />
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field, i) => {
                                    const p = (suffix: keyof DischargeMedLine) => `medications.${i}.${suffix}` as const;
                                    const namePath = p('name');
                                    const dosePath = p('dose');
                                    const freqPath = p('frequency');
                                    const durPath = p('duration');
                                    const instPath = p('instructions');
                                    return (
                                        <tr key={field.id} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="align-top px-3 py-2">
                                                <div id={dischargeMedFieldDomId(namePath)} className="scroll-mt-24">
                                                    <input
                                                        id={`discharge-med-input-${i}-name`}
                                                        {...register(namePath)}
                                                        autoComplete="off"
                                                        disabled={!eid}
                                                        aria-invalid={shouldShowFieldError(
                                                            errors,
                                                            touchedFields,
                                                            submitCount,
                                                            namePath
                                                        )}
                                                        aria-describedby={
                                                            shouldShowFieldError(errors, touchedFields, submitCount, namePath)
                                                                ? `discharge-med-err-${i}-name`
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            cellInputClassName,
                                                            shouldShowFieldError(errors, touchedFields, submitCount, namePath) &&
                                                                cellInputInvalidClassName
                                                        )}
                                                    />
                                                    <div className="mt-1 min-h-[1.25rem]">
                                                        {shouldShowFieldError(errors, touchedFields, submitCount, namePath) ? (
                                                            <p
                                                                id={`discharge-med-err-${i}-name`}
                                                                role="alert"
                                                                className={errorTextClassName}
                                                            >
                                                                {getError(errors, namePath)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="align-top px-3 py-2">
                                                <div id={dischargeMedFieldDomId(dosePath)} className="scroll-mt-24">
                                                    <input
                                                        id={`discharge-med-input-${i}-dose`}
                                                        {...register(dosePath)}
                                                        placeholder="e.g. 10 mg"
                                                        autoComplete="off"
                                                        disabled={!eid}
                                                        aria-invalid={shouldShowFieldError(
                                                            errors,
                                                            touchedFields,
                                                            submitCount,
                                                            dosePath
                                                        )}
                                                        aria-describedby={
                                                            shouldShowFieldError(errors, touchedFields, submitCount, dosePath)
                                                                ? `discharge-med-err-${i}-dose`
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            cellInputClassName,
                                                            shouldShowFieldError(errors, touchedFields, submitCount, dosePath) &&
                                                                cellInputInvalidClassName
                                                        )}
                                                    />
                                                    <div className="mt-1 min-h-[1.25rem]">
                                                        {shouldShowFieldError(errors, touchedFields, submitCount, dosePath) ? (
                                                            <p
                                                                id={`discharge-med-err-${i}-dose`}
                                                                role="alert"
                                                                className={errorTextClassName}
                                                            >
                                                                {getError(errors, dosePath)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="align-top px-3 py-2">
                                                <div id={dischargeMedFieldDomId(freqPath)} className="scroll-mt-24">
                                                    <select
                                                        id={`discharge-med-input-${i}-frequency`}
                                                        {...register(freqPath)}
                                                        disabled={!eid}
                                                        aria-invalid={shouldShowFieldError(
                                                            errors,
                                                            touchedFields,
                                                            submitCount,
                                                            freqPath
                                                        )}
                                                        aria-describedby={
                                                            shouldShowFieldError(errors, touchedFields, submitCount, freqPath)
                                                                ? `discharge-med-err-${i}-frequency`
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            cellInputClassName,
                                                            shouldShowFieldError(errors, touchedFields, submitCount, freqPath) &&
                                                                cellInputInvalidClassName
                                                        )}
                                                    >
                                                        <option value="">Select frequency</option>
                                                        {DISCHARGE_FREQUENCY_OPTIONS.map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-1 min-h-[1.25rem]">
                                                        {shouldShowFieldError(errors, touchedFields, submitCount, freqPath) ? (
                                                            <p
                                                                id={`discharge-med-err-${i}-frequency`}
                                                                role="alert"
                                                                className={errorTextClassName}
                                                            >
                                                                {getError(errors, freqPath)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="align-top px-3 py-2">
                                                <div id={dischargeMedFieldDomId(durPath)} className="scroll-mt-24">
                                                    <input
                                                        id={`discharge-med-input-${i}-duration`}
                                                        {...register(durPath)}
                                                        placeholder="e.g. 5 or 5 days"
                                                        autoComplete="off"
                                                        disabled={!eid}
                                                        aria-invalid={shouldShowFieldError(
                                                            errors,
                                                            touchedFields,
                                                            submitCount,
                                                            durPath
                                                        )}
                                                        aria-describedby={
                                                            shouldShowFieldError(errors, touchedFields, submitCount, durPath)
                                                                ? `discharge-med-err-${i}-duration`
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            cellInputClassName,
                                                            shouldShowFieldError(errors, touchedFields, submitCount, durPath) &&
                                                                cellInputInvalidClassName
                                                        )}
                                                    />
                                                    <div className="mt-1 min-h-[1.25rem]">
                                                        {shouldShowFieldError(errors, touchedFields, submitCount, durPath) ? (
                                                            <p
                                                                id={`discharge-med-err-${i}-duration`}
                                                                role="alert"
                                                                className={errorTextClassName}
                                                            >
                                                                {getError(errors, durPath)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="align-top px-3 py-2">
                                                <div id={dischargeMedFieldDomId(instPath)} className="scroll-mt-24">
                                                    <input
                                                        id={`discharge-med-input-${i}-instructions`}
                                                        {...register(instPath)}
                                                        autoComplete="off"
                                                        disabled={!eid}
                                                        aria-invalid={shouldShowFieldError(
                                                            errors,
                                                            touchedFields,
                                                            submitCount,
                                                            instPath
                                                        )}
                                                        aria-describedby={
                                                            shouldShowFieldError(errors, touchedFields, submitCount, instPath)
                                                                ? `discharge-med-err-${i}-instructions`
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            cellInputClassName,
                                                            shouldShowFieldError(errors, touchedFields, submitCount, instPath) &&
                                                                cellInputInvalidClassName
                                                        )}
                                                    />
                                                    <div className="mt-1 min-h-[1.25rem]">
                                                        {shouldShowFieldError(errors, touchedFields, submitCount, instPath) ? (
                                                            <p
                                                                id={`discharge-med-err-${i}-instructions`}
                                                                role="alert"
                                                                className={errorTextClassName}
                                                            >
                                                                {getError(errors, instPath)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="align-top px-3 py-2">
                                                <div className="flex h-9 items-start pt-1">
                                                    <button
                                                        type="button"
                                                        className="text-xs text-red-600 hover:underline disabled:opacity-40"
                                                        disabled={!eid || fields.length <= 1}
                                                        onClick={() => removeRow(i)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="mt-1 min-h-[1.25rem]" aria-hidden="true" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        className="rounded-md border border-dashed border-gray-400 px-3 py-1.5 text-sm dark:border-gray-500 disabled:opacity-40"
                        disabled={!eid}
                        onClick={addRow}
                    >
                        Add medicine
                    </button>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div id={dischargeMedFieldDomId('preparedBy')} className="scroll-mt-24">
                            <label htmlFor="discharge-med-input-preparedBy" className={cn('mb-1 block', labelClassName)}>
                                Prepared by
                                <RequiredMark />
                            </label>
                            <input
                                id="discharge-med-input-preparedBy"
                                {...register('preparedBy')}
                                autoComplete="name"
                                disabled={!eid}
                                aria-invalid={shouldShowFieldError(errors, touchedFields, submitCount, 'preparedBy')}
                                aria-describedby={
                                    shouldShowFieldError(errors, touchedFields, submitCount, 'preparedBy')
                                        ? 'discharge-med-err-preparedBy'
                                        : undefined
                                }
                                className={cn(
                                    footerInputClassName,
                                    shouldShowFieldError(errors, touchedFields, submitCount, 'preparedBy') &&
                                        footerInputInvalidClassName
                                )}
                            />
                            <div className="mt-1 min-h-[1.25rem]">
                                {shouldShowFieldError(errors, touchedFields, submitCount, 'preparedBy') ? (
                                    <p id="discharge-med-err-preparedBy" role="alert" className={errorTextClassName}>
                                        {getError(errors, 'preparedBy')}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div id={dischargeMedFieldDomId('reviewedBy')} className="scroll-mt-24">
                            <label htmlFor="discharge-med-input-reviewedBy" className={cn('mb-1 block', labelClassName)}>
                                Reviewed by
                                <RequiredMark />
                            </label>
                            <input
                                id="discharge-med-input-reviewedBy"
                                {...register('reviewedBy')}
                                autoComplete="name"
                                disabled={!eid}
                                aria-invalid={shouldShowFieldError(errors, touchedFields, submitCount, 'reviewedBy')}
                                aria-describedby={
                                    shouldShowFieldError(errors, touchedFields, submitCount, 'reviewedBy')
                                        ? 'discharge-med-err-reviewedBy'
                                        : undefined
                                }
                                className={cn(
                                    footerInputClassName,
                                    shouldShowFieldError(errors, touchedFields, submitCount, 'reviewedBy') &&
                                        footerInputInvalidClassName
                                )}
                            />
                            <div className="mt-1 min-h-[1.25rem]">
                                {shouldShowFieldError(errors, touchedFields, submitCount, 'reviewedBy') ? (
                                    <p id="discharge-med-err-reviewedBy" role="alert" className={errorTextClassName}>
                                        {getError(errors, 'reviewedBy')}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                <input type="checkbox" {...register('counsellingDone')} disabled={!eid} />
                                Counselling done
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saveDisabled}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save discharge list'}
                    </button>
                </form>
            )}
        </div>
    );
}
