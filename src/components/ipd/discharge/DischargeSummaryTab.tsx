import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { cn } from '@/lib/utils';
import type { DischargeSummaryState } from '../../../types/dischargeReadiness';

type Props = {
    summary: DischargeSummaryState;
    canEdit: boolean;
    canSign: boolean;
    /** Shown when the sign button is disabled because the user is not a provider or has no user id. */
    signDisabledExplanation?: string | null;
    onSaveDraft: (partial: Partial<DischargeSummaryState>) => Promise<boolean>;
    onSign: () => Promise<boolean>;
};

function signatureDisplayName(s: DischargeSummaryState): string {
    return (s.signedByName ?? s.signedBy ?? '').trim();
}

function withDrPrefix(name: string): string {
    const t = name.trim();
    if (!t) return '';
    if (/^dr\.?\s/i.test(t)) return t;
    if (/^[a-f\d]{24}$/i.test(t)) return t;
    return `Dr. ${t}`;
}

const dispositionOptions = ['Home', 'Skilled Nursing Facility', 'Acute Rehab', 'Hospice', 'Another acute hospital', 'AMA', 'Expired'];

function normalizeDispositionForSelect(raw: string | undefined | null): string {
    const t = (raw ?? '').trim();
    if (!t) return '';
    const exact = dispositionOptions.find((o) => o === t);
    if (exact) return exact;
    const ci = dispositionOptions.find((o) => o.toLowerCase() === t.toLowerCase());
    return ci ?? t;
}

type FormState = {
    admissionDiagnosis: string;
    hospitalCourse: string;
    finalDiagnoses: string;
    procedures: string;
    disposition: string;
    conditionAtDischarge: string;
    dischargeMedications: string;
    followUpInstructions: string;
};

function summaryToFormState(s: DischargeSummaryState): FormState {
    return {
        admissionDiagnosis: s.admissionDiagnosis ?? '',
        hospitalCourse: s.hospitalCourse ?? '',
        finalDiagnoses: s.finalDiagnoses ?? '',
        procedures: s.procedures ?? '',
        disposition: normalizeDispositionForSelect(s.disposition),
        conditionAtDischarge: s.conditionAtDischarge ?? '',
        dischargeMedications: s.dischargeMedications ?? '',
        followUpInstructions: s.followUpInstructions ?? '',
    };
}

function formStateToPartial(f: FormState): Partial<DischargeSummaryState> {
    return {
        admissionDiagnosis: f.admissionDiagnosis,
        hospitalCourse: f.hospitalCourse,
        finalDiagnoses: f.finalDiagnoses,
        procedures: f.procedures,
        disposition: f.disposition,
        conditionAtDischarge: f.conditionAtDischarge,
        dischargeMedications: f.dischargeMedications,
        followUpInstructions: f.followUpInstructions,
    };
}

function Req() {
    return (
        <span className="ml-1 text-red-600" aria-hidden>
            *
        </span>
    );
}

const DischargeSummaryTabInner = forwardRef<DischargeSummaryTabHandle, Props>(function DischargeSummaryTabInner(
    { summary, canEdit, canSign, signDisabledExplanation, onSaveDraft, onSign },
    ref,
) {
    const locked = summary.status === 'signed' || !canEdit;

    const [form, setForm] = useState<FormState>(() => summaryToFormState(summary));
    const [fieldErrors, setFieldErrors] = useState<DischargeSummaryRequiredErrors>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(summaryToFormState(summary));
        setFieldErrors({});
    }, [
        summary.admissionDiagnosis,
        summary.hospitalCourse,
        summary.finalDiagnoses,
        summary.procedures,
        summary.disposition,
        summary.conditionAtDischarge,
        summary.dischargeMedications,
        summary.followUpInstructions,
        summary.status,
        summary.signedAt,
        summary.signedByName,
    ]);

    const clearError = useCallback((key: DischargeSummaryRequiredKey) => {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const validateForm = useCallback((): boolean => {
        const { ok, errors } = validateDischargeSummaryRequired({
            admissionDiagnosis: form.admissionDiagnosis,
            hospitalCourse: form.hospitalCourse,
            finalDiagnoses: form.finalDiagnoses,
            disposition: form.disposition,
            conditionAtDischarge: form.conditionAtDischarge,
        });
        setFieldErrors(ok ? {} : errors);
        if (!ok) scrollToFirstDischargeSummaryError(errors);
        return ok;
    }, [form.admissionDiagnosis, form.hospitalCourse, form.finalDiagnoses, form.disposition, form.conditionAtDischarge]);

    useImperativeHandle(ref, () => ({
        validate: async () => validateForm(),
    }));

    const selectBase =
        'mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm dark:bg-gray-900 dark:text-gray-100 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

    return (
        <div className="space-y-4" data-discharge-summary-tab>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <span
                    className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                        summary.status === 'signed'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                >
                    {summary.status === 'signed' ? 'Signed' : 'Draft'}
                </span>
                {summary.status === 'signed' && summary.signedAt ? (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                        {signatureDisplayName(summary)
                            ? `Signed by ${withDrPrefix(signatureDisplayName(summary))} on ${new Date(summary.signedAt).toLocaleString()}`
                            : `Signed on ${new Date(summary.signedAt).toLocaleString()}`}
                    </span>
                ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div data-discharge-field="admissionDiagnosis">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Admission diagnosis / reason
                        <Req />
                    </label>
                    <Textarea
                        className={cn('mt-1', fieldErrors.admissionDiagnosis && 'border-destructive')}
                        rows={2}
                        disabled={locked}
                        aria-invalid={Boolean(fieldErrors.admissionDiagnosis)}
                        value={form.admissionDiagnosis}
                        onChange={(e) => {
                            const v = e.target.value;
                            setForm((prev) => ({ ...prev, admissionDiagnosis: v }));
                            clearError('admissionDiagnosis');
                        }}
                    />
                    {fieldErrors.admissionDiagnosis ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.admissionDiagnosis}</p>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Disposition</label>
                        <select
                            className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                            disabled={locked}
                            aria-invalid={Boolean(fieldErrors.disposition)}
                            value={form.disposition}
                            onChange={(e) => {
                                const v = e.target.value;
                                setForm((prev) => ({ ...prev, disposition: v }));
                                clearError('disposition');
                            }}
                        >
                            <option value="">Select disposition…</option>
                            {dispositionOptions.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div data-discharge-field="conditionAtDischarge">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Condition at discharge
                            <Req />
                        </label>
                        <Input
                            className={cn('mt-1', fieldErrors.conditionAtDischarge && 'border-destructive')}
                            disabled={locked}
                            aria-invalid={Boolean(fieldErrors.conditionAtDischarge)}
                            value={form.conditionAtDischarge}
                            onChange={(e) => {
                                const v = e.target.value;
                                setForm((prev) => ({ ...prev, conditionAtDischarge: v }));
                                clearError('conditionAtDischarge');
                            }}
                        />
                        {fieldErrors.conditionAtDischarge ? (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.conditionAtDischarge}</p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div data-discharge-field="hospitalCourse">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Hospital course
                    <Req />
                </label>
                <Textarea
                    className={cn('mt-1', fieldErrors.hospitalCourse && 'border-destructive')}
                    rows={6}
                    disabled={locked}
                    aria-invalid={Boolean(fieldErrors.hospitalCourse)}
                    value={form.hospitalCourse}
                    onChange={(e) => {
                        const v = e.target.value;
                        setForm((prev) => ({ ...prev, hospitalCourse: v }));
                        clearError('hospitalCourse');
                    }}
                />
                {fieldErrors.hospitalCourse ? <p className="mt-1 text-xs text-red-600">{fieldErrors.hospitalCourse}</p> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0" data-discharge-field="finalDiagnoses">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="ds-final-dx">
                        Final diagnoses (ICD-10-CM)
                        <Req />
                    </label>
                    <Textarea
                        id="ds-final-dx"
                        className={cn('mt-1 font-mono text-sm', fieldErrors.finalDiagnoses && 'border-destructive')}
                        rows={4}
                        disabled={locked}
                        placeholder='One per line. Mark principal first, e.g. Principal: J18.9 — Pneumonia, unspecified organism'
                        aria-invalid={Boolean(fieldErrors.finalDiagnoses)}
                        value={form.finalDiagnoses}
                        onChange={(e) => {
                            const v = e.target.value;
                            setForm((prev) => ({ ...prev, finalDiagnoses: v }));
                            clearError('finalDiagnoses');
                        }}
                    />
                    {fieldErrors.finalDiagnoses ? <p className="mt-1 text-xs text-red-600">{fieldErrors.finalDiagnoses}</p> : null}
                </div>
                <div className="min-w-0">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="ds-procedures">
                        Procedures
                    </label>
                    <Textarea
                        id="ds-procedures"
                        className="mt-1 font-mono text-sm"
                        rows={4}
                        disabled={locked}
                        placeholder="CPT / ICD-10-PCS lines, one procedure per line"
                        value={form.procedures}
                        onChange={(e) => setForm((prev) => ({ ...prev, procedures: e.target.value }))}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="ds-dc-meds">
                    Discharge medications
                </label>
                <Textarea
                    id="ds-dc-meds"
                    className="mt-1 text-sm"
                    rows={5}
                    disabled={locked}
                    placeholder="Each line: medication, strength, route, frequency, duration (e.g. Amoxicillin-clavulanate 875/125 mg — 1 tablet PO BID × 7 days)"
                    value={form.dischargeMedications}
                    onChange={(e) => setForm((prev) => ({ ...prev, dischargeMedications: e.target.value }))}
                />
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Follow-up &amp; instructions</label>
                <Textarea
                    className="mt-1"
                    rows={4}
                    disabled={locked}
                    value={form.followUpInstructions}
                    onChange={(e) => setForm((prev) => ({ ...prev, followUpInstructions: e.target.value }))}
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={locked} onClick={() => validateForm()}>
                    Check errors
                </Button>
                <Button
                    type="button"
                    disabled={locked || saving}
                    onClick={async () => {
                        setSaving(true);
                        await onSaveDraft(formStateToPartial(form));
                        setSaving(false);
                    }}
                >
                    {saving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                    type="button"
                    disabled={!canSign || summary.status === 'signed' || saving}
                    onClick={async () => {
                        if (!validateForm()) return;
                        setSaving(true);
                        const saved = await onSaveDraft(formStateToPartial(form));
                        if (saved) await onSign();
                        setSaving(false);
                    }}
                >
                    Sign discharge summary
                </Button>
            </div>
            {signDisabledExplanation && summary.status !== 'signed' ? (
                <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
                    {signDisabledExplanation}
                </p>
            ) : null}
            {!canEdit && summary.status !== 'signed' ? (
                <p className="text-sm text-gray-500">Your role cannot edit the discharge summary.</p>
            ) : null}
        </div>
    );
});

export const DischargeSummaryTab = memo(DischargeSummaryTabInner);
