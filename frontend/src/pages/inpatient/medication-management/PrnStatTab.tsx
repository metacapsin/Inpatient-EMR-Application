import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import type { FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { PrnStatRecord } from '../../../types/medicationManagement';
import {
    PRN_STAT_FIELD_ORDER,
    PRN_STAT_FORM_DEFAULTS,
    defaultOrderedTimeLocal,
    getError,
    isPrnStatFormValuesValid,
    prnStatFormSchema,
    type PrnStatFormValues,
} from './prnStatForm.validation';

interface PrnStatTabProps {
    patientId: string;
    defaultGivenBy: string;
}

const inputClassName =
    'form-input h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800';

const inputInvalidClassName =
    'border-[#dc2626] ring-1 ring-[#dc2626]/30 focus:border-[#dc2626] focus:ring-[#dc2626]/40 dark:border-[#dc2626]';

const labelClassName = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

const errorTextClassName = 'text-[13px] leading-snug text-[#dc2626]';

function RequiredMark() {
    return (
        <span className="ml-0.5 font-semibold text-[#dc2626]" aria-hidden="true">
            *
        </span>
    );
}

export function PrnStatTab({ patientId, defaultGivenBy }: PrnStatTabProps) {
    const [records, setRecords] = useState<PrnStatRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [shakeForm, setShakeForm] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setFocus,
        formState: { errors, touchedFields, submitCount },
    } = useForm<PrnStatFormValues>({
        resolver: yupResolver(prnStatFormSchema),
        mode: 'onTouched',
        reValidateMode: 'onChange',
        defaultValues: {
            ...PRN_STAT_FORM_DEFAULTS,
            givenBy: defaultGivenBy,
            orderedTime: defaultOrderedTimeLocal(),
        },
    });

    const type = watch('type');
    const formValues = watch();

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const list = await medApi.getPrnStat(patientId);
            setRecords(list);
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load PRN/STAT history');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        reset((prev) => ({
            ...prev,
            givenBy: defaultGivenBy,
            orderedTime: defaultOrderedTimeLocal(),
        }));
    }, [defaultGivenBy, patientId, reset]);

    function shouldShowError(name: keyof PrnStatFormValues): boolean {
        return (Boolean(touchedFields[name]) || submitCount > 0) && Boolean(errors[name]);
    }

    const onInvalid = useCallback((submitErrors: FieldErrors<PrnStatFormValues>) => {
        setShakeForm(true);
        window.setTimeout(() => setShakeForm(false), 480);
        const firstInvalid = PRN_STAT_FIELD_ORDER.find((k) => submitErrors[k]);
        if (firstInvalid) {
            setFocus(firstInvalid);
            window.requestAnimationFrame(() => {
                document.getElementById(`prn-stat-field-${String(firstInvalid)}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            });
        }
    }, [setFocus]);

    const onValid = async (values: PrnStatFormValues) => {
        if (!patientId) return;
        setSaving(true);
        try {
            const orderedIso = new Date(values.orderedTime).toISOString();
            const lastIso = values.lastGivenTime?.trim()
                ? new Date(values.lastGivenTime).toISOString()
                : undefined;
            await medApi.postPrnStat({
                patientId,
                medicationName: values.medicationName.trim(),
                type: values.type,
                indication: values.indication.trim(),
                lastGivenTime: lastIso,
                interval: values.type === 'PRN' ? values.interval.trim() : undefined,
                maxDose: values.type === 'PRN' ? values.maxDose.trim() || undefined : undefined,
                orderedTime: orderedIso,
                urgencyLevel: values.type === 'STAT' ? values.urgencyLevel.trim() || undefined : undefined,
                givenBy: values.givenBy.trim(),
                doctorApproval: values.type === 'STAT' ? values.doctorApproval.trim() || undefined : undefined,
                remarks: values.remarks.trim() || undefined,
            });
            toast.success('PRN/STAT administration saved');
            reset({
                ...PRN_STAT_FORM_DEFAULTS,
                type: values.type,
                givenBy: defaultGivenBy.trim(),
                orderedTime: defaultOrderedTimeLocal(),
            });
            void load();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const formIsValid = isPrnStatFormValuesValid(formValues);
    const submitDisabled = saving || !patientId || !formIsValid;

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit(onValid, onInvalid)}
                noValidate
                className={cn(
                    'space-y-4 rounded-md border border-gray-200 p-4 transition-shadow dark:border-gray-700',
                    shakeForm && 'animate-form-shake shadow-[0_0_0_3px_rgba(220,38,38,0.2)]'
                )}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div id="prn-stat-field-type" className="scroll-mt-24">
                        <label htmlFor="prn-stat-input-type" className={labelClassName}>
                            Type
                            <RequiredMark />
                        </label>
                        <select
                            id="prn-stat-input-type"
                            {...register('type')}
                            aria-invalid={shouldShowError('type')}
                            aria-describedby={shouldShowError('type') ? 'prn-stat-input-type-error' : undefined}
                            className={cn(inputClassName, shouldShowError('type') && inputInvalidClassName)}
                        >
                            <option value="PRN">PRN</option>
                            <option value="STAT">STAT</option>
                        </select>
                        <div className="mt-1 min-h-[1.25rem]">
                            {shouldShowError('type') ? (
                                <p id="prn-stat-input-type-error" role="alert" className={errorTextClassName}>
                                    {getError(errors, 'type')}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="prn-stat-field-medicationName" className="scroll-mt-24">
                        <label htmlFor="prn-stat-input-medicationName" className={labelClassName}>
                            Medication name
                            <RequiredMark />
                        </label>
                        <input
                            id="prn-stat-input-medicationName"
                            {...register('medicationName')}
                            autoComplete="off"
                            aria-invalid={shouldShowError('medicationName')}
                            aria-describedby={
                                shouldShowError('medicationName') ? 'prn-stat-input-medicationName-error' : undefined
                            }
                            className={cn(inputClassName, shouldShowError('medicationName') && inputInvalidClassName)}
                        />
                        <div className="mt-1 min-h-[1.25rem]">
                            {shouldShowError('medicationName') ? (
                                <p id="prn-stat-input-medicationName-error" role="alert" className={errorTextClassName}>
                                    {getError(errors, 'medicationName')}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="prn-stat-field-indication" className="md:col-span-2 scroll-mt-24">
                        <label htmlFor="prn-stat-input-indication" className={labelClassName}>
                            Indication
                            <RequiredMark />
                        </label>
                        <input
                            id="prn-stat-input-indication"
                            {...register('indication')}
                            autoComplete="off"
                            aria-invalid={shouldShowError('indication')}
                            aria-describedby={
                                shouldShowError('indication') ? 'prn-stat-input-indication-error' : undefined
                            }
                            className={cn(inputClassName, shouldShowError('indication') && inputInvalidClassName)}
                        />
                        <div className="mt-1 min-h-[1.25rem]">
                            {shouldShowError('indication') ? (
                                <p id="prn-stat-input-indication-error" role="alert" className={errorTextClassName}>
                                    {getError(errors, 'indication')}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="prn-stat-field-orderedTime" className="scroll-mt-24">
                        <label htmlFor="prn-stat-input-orderedTime" className={labelClassName}>
                            Ordered time
                            <RequiredMark />
                        </label>
                        <input
                            id="prn-stat-input-orderedTime"
                            type="datetime-local"
                            {...register('orderedTime')}
                            aria-invalid={shouldShowError('orderedTime')}
                            aria-describedby={
                                shouldShowError('orderedTime') ? 'prn-stat-input-orderedTime-error' : undefined
                            }
                            className={cn(inputClassName, shouldShowError('orderedTime') && inputInvalidClassName)}
                        />
                        <div className="mt-1 min-h-[1.25rem]">
                            {shouldShowError('orderedTime') ? (
                                <p id="prn-stat-input-orderedTime-error" role="alert" className={errorTextClassName}>
                                    {getError(errors, 'orderedTime')}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="prn-stat-field-lastGivenTime" className="scroll-mt-24">
                        <label htmlFor="prn-stat-input-lastGivenTime" className={labelClassName}>
                            Last given (optional)
                        </label>
                        <input
                            id="prn-stat-input-lastGivenTime"
                            type="datetime-local"
                            {...register('lastGivenTime')}
                            className={inputClassName}
                        />
                        <div className="mt-1 min-h-[1.25rem]" />
                    </div>

                    {type === 'PRN' ? (
                        <>
                            <div id="prn-stat-field-interval" className="scroll-mt-24">
                                <label htmlFor="prn-stat-input-interval" className={labelClassName}>
                                    Interval
                                    <RequiredMark />
                                </label>
                                <input
                                    id="prn-stat-input-interval"
                                    {...register('interval')}
                                    placeholder="e.g. q4h"
                                    autoComplete="off"
                                    aria-invalid={shouldShowError('interval')}
                                    aria-describedby={
                                        shouldShowError('interval') ? 'prn-stat-input-interval-error' : undefined
                                    }
                                    className={cn(inputClassName, shouldShowError('interval') && inputInvalidClassName)}
                                />
                                <div className="mt-1 min-h-[1.25rem]">
                                    {shouldShowError('interval') ? (
                                        <p id="prn-stat-input-interval-error" role="alert" className={errorTextClassName}>
                                            {getError(errors, 'interval')}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <div id="prn-stat-field-maxDose" className="scroll-mt-24">
                                <label htmlFor="prn-stat-input-maxDose" className={labelClassName}>
                                    Max dose
                                </label>
                                <input
                                    id="prn-stat-input-maxDose"
                                    {...register('maxDose')}
                                    placeholder="e.g. 8"
                                    autoComplete="off"
                                    aria-invalid={shouldShowError('maxDose')}
                                    aria-describedby={
                                        shouldShowError('maxDose') ? 'prn-stat-input-maxDose-error' : undefined
                                    }
                                    className={cn(inputClassName, shouldShowError('maxDose') && inputInvalidClassName)}
                                />
                                <div className="mt-1 min-h-[1.25rem]">
                                    {shouldShowError('maxDose') ? (
                                        <p id="prn-stat-input-maxDose-error" role="alert" className={errorTextClassName}>
                                            {getError(errors, 'maxDose')}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div id="prn-stat-field-urgencyLevel" className="scroll-mt-24">
                                <label htmlFor="prn-stat-input-urgencyLevel" className={labelClassName}>
                                    Urgency level
                                </label>
                                <input
                                    id="prn-stat-input-urgencyLevel"
                                    {...register('urgencyLevel')}
                                    placeholder="e.g. Critical"
                                    autoComplete="off"
                                    className={inputClassName}
                                />
                                <div className="mt-1 min-h-[1.25rem]" />
                            </div>
                            <div id="prn-stat-field-doctorApproval" className="scroll-mt-24">
                                <label htmlFor="prn-stat-input-doctorApproval" className={labelClassName}>
                                    Doctor approval
                                </label>
                                <input
                                    id="prn-stat-input-doctorApproval"
                                    {...register('doctorApproval')}
                                    placeholder="Ordering provider"
                                    autoComplete="off"
                                    className={inputClassName}
                                />
                                <div className="mt-1 min-h-[1.25rem]" />
                            </div>
                        </>
                    )}

                    <div id="prn-stat-field-givenBy" className="scroll-mt-24">
                        <label htmlFor="prn-stat-input-givenBy" className={labelClassName}>
                            Given by
                            <RequiredMark />
                        </label>
                        <input
                            id="prn-stat-input-givenBy"
                            {...register('givenBy')}
                            autoComplete="name"
                            aria-invalid={shouldShowError('givenBy')}
                            aria-describedby={shouldShowError('givenBy') ? 'prn-stat-input-givenBy-error' : undefined}
                            className={cn(inputClassName, shouldShowError('givenBy') && inputInvalidClassName)}
                        />
                        <div className="mt-1 min-h-[1.25rem]">
                            {shouldShowError('givenBy') ? (
                                <p id="prn-stat-input-givenBy-error" role="alert" className={errorTextClassName}>
                                    {getError(errors, 'givenBy')}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="prn-stat-field-remarks" className="md:col-span-2 scroll-mt-24">
                        <label htmlFor="prn-stat-input-remarks" className={labelClassName}>
                            Remarks
                        </label>
                        <input
                            id="prn-stat-input-remarks"
                            {...register('remarks')}
                            autoComplete="off"
                            className={inputClassName}
                        />
                        <div className="mt-1 min-h-[1.25rem]" />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitDisabled}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Submit'}
                </button>
            </form>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Recent entries</h3>
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading…
                    </div>
                ) : records.length === 0 ? (
                    <p className="text-sm text-gray-500">No PRN/STAT records yet.</p>
                ) : (
                    <ul className="space-y-2 text-sm">
                        {records.map((r) => (
                            <li
                                key={r.id}
                                className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
                            >
                                <span className="font-medium">{r.medicationName}</span>{' '}
                                <span className="text-gray-500">({r.type})</span> — {r.indication}
                                <div className="mt-1 text-xs text-gray-500">
                                    {new Date(r.createdAt).toLocaleString()} · {r.givenBy}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
