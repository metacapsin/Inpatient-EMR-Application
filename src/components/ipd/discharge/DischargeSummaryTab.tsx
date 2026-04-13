import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import type { DischargeSummaryState } from '../../../types/dischargeReadiness';
import NewDropdown from '@/components/ui/NewDropdown';
import { useDischargeReadinessOptional } from '../../../contexts/DischargeReadinessContext';
import {
    scrollToFirstDischargeSummaryError,
    scrollToFirstReadinessIssue,
    validateDischargeSummaryRequired,
    type DischargeSummaryRequiredErrors,
    type DischargeSummaryRequiredKey,
} from '../../../utils/dischargeReadinessValidation';

export type DischargeSummaryTabHandle = {
    validate: () => Promise<boolean>;
};

type Props = {
    summary: DischargeSummaryState;
    canEdit: boolean;
    canSign: boolean;
    onSaveDraft: (partial: Partial<DischargeSummaryState>) => Promise<boolean>;
    onSign: () => Promise<boolean>;
};

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
    const ctx = useDischargeReadinessOptional();
    const locked = summary.status === 'signed' || !canEdit;

    const [form, setForm] = useState<FormState>(() => summaryToFormState(summary));
    const [fieldErrors, setFieldErrors] = useState<DischargeSummaryRequiredErrors>({});
    const [saving, setSaving] = useState(false);
    const [signing, setSigning] = useState(false);

    useEffect(() => {
        setLocal(summary);
    }, [summary]);

    useEffect(() => {
        if (!ctx || locked) return;
        ctx.setSummaryDraft(formStateToPartial(form));
    }, [form, locked, ctx]);

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
            dischargeMedications: form.dischargeMedications,
            followUpInstructions: form.followUpInstructions,
        });
        setFieldErrors(ok ? {} : errors);
        if (!ok) scrollToFirstDischargeSummaryError(errors);
        return ok;
    }, [form.admissionDiagnosis, form.hospitalCourse, form.finalDiagnoses, form.dischargeMedications, form.followUpInstructions]);

    useImperativeHandle(ref, () => ({
        validate: async () => validateForm(),
    }));

    const snapshot = ctx?.snapshot;
    const canSignByRules = snapshot?.canSignDischargeSummary ?? false;

    const signBlockerHint = useMemo(() => {
        if (summary.status === 'signed') return null;
        if (!canSign) return signDisabledExplanation ?? null;
        if (!snapshot) return null;
        if (!snapshot.canSignDischargeSummary) {
            const msgs = snapshot.hardBlockers
                .filter((g) => g.id !== 'gate-summary-signed')
                .map((g) => g.message);
            return msgs.length ? msgs.join(' · ') : 'Resolve readiness blockers before signing.';
        }
        return null;
    }, [summary.status, canSign, signDisabledExplanation, snapshot]);

    const signDisabled = !canSign || summary.status === 'signed' || saving || signing || !canSignByRules;
    const signTitle = signDisabled ? signBlockerHint ?? 'Signing is not available.' : undefined;

    const selectBase =
        'mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm dark:bg-gray-900 dark:text-gray-100 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        summary.status === 'signed'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                >
                    {summary.status === 'signed' ? `Signed ${summary.signedAt ? new Date(summary.signedAt).toLocaleString() : ''}` : 'Draft'}
                </span>
                {summary.signedBy ? <span className="text-xs text-gray-500">by {summary.signedBy}</span> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Admission diagnosis / reason</label>
                    <Textarea
                        className="mt-1"
                        rows={2}
                        disabled={locked}
                        value={local.admissionDiagnosis}
                        onChange={(e) => setLocal((s) => ({ ...s, admissionDiagnosis: e.target.value }))}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div data-discharge-field="disposition">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Disposition</label>
                        <select
                            className={cn(selectBase, 'border-gray-300 dark:border-gray-600')}
                            disabled={locked}
                            value={form.disposition}
                            onChange={(e) => setForm((prev) => ({ ...prev, disposition: e.target.value }))}
                        >
                            {dispositionOptions.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div data-discharge-field="conditionAtDischarge">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Condition at discharge</label>
                        <Input
                            className="mt-1"
                            disabled={locked}
                            value={form.conditionAtDischarge}
                            onChange={(e) => setForm((prev) => ({ ...prev, conditionAtDischarge: e.target.value }))}
                        />
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
                        placeholder="One code per line or inline (e.g. J18.9 — Pneumonia). Principal: J18.9 …"
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

            <div data-discharge-field="dischargeMedications">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="ds-dc-meds">
                    Discharge medications
                    <Req />
                </label>
                <Textarea
                    id="ds-dc-meds"
                    className={cn('mt-1 text-sm', fieldErrors.dischargeMedications && 'border-destructive')}
                    rows={5}
                    disabled={locked}
                    aria-invalid={Boolean(fieldErrors.dischargeMedications)}
                    placeholder="Each line: medication, strength, route, frequency, duration (e.g. Amoxicillin-clavulanate 875/125 mg — 1 tablet PO BID × 7 days)"
                    value={form.dischargeMedications}
                    onChange={(e) => {
                        const v = e.target.value;
                        setForm((prev) => ({ ...prev, dischargeMedications: v }));
                        clearError('dischargeMedications');
                    }}
                />
                {fieldErrors.dischargeMedications ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.dischargeMedications}</p>
                ) : null}
            </div>

            <div data-discharge-field="followUpInstructions">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Follow-up &amp; instructions
                    <Req />
                </label>
                <Textarea
                    className={cn('mt-1', fieldErrors.followUpInstructions && 'border-destructive')}
                    rows={4}
                    disabled={locked}
                    aria-invalid={Boolean(fieldErrors.followUpInstructions)}
                    value={form.followUpInstructions}
                    onChange={(e) => {
                        const v = e.target.value;
                        setForm((prev) => ({ ...prev, followUpInstructions: v }));
                        clearError('followUpInstructions');
                    }}
                />
                {fieldErrors.followUpInstructions ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.followUpInstructions}</p>
                ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    disabled={locked || saving}
                    onClick={async () => {
                        setSaving(true);
                        const ok = await onSaveDraft(formStateToPartial(form));
                        if (ok) ctx?.clearSummaryDraft();
                        setSaving(false);
                        return ok;
                    }}
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Saving…
                        </>
                    ) : (
                        'Save draft'
                    )}
                </Button>
                <span className={cn('inline-flex', signTitle && 'cursor-help')} title={signTitle ?? undefined}>
                    <Button
                        type="button"
                        disabled={signDisabled}
                        onClick={async () => {
                            if (!validateForm()) return;
                            if (snapshot && !snapshot.canSignDischargeSummary) {
                                toast.error('Resolve all readiness blockers before signing the discharge summary.');
                                scrollToFirstReadinessIssue(snapshot);
                                return;
                            }
                            setSigning(true);
                            try {
                                const saved = await onSaveDraft(formStateToPartial(form));
                                if (saved) {
                                    await onSign();
                                    ctx?.clearSummaryDraft();
                                }
                            } finally {
                                setSigning(false);
                            }
                        }}
                    >
                        {signing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                Signing…
                            </>
                        ) : (
                            'Sign discharge summary'
                        )}
                    </Button>
                </span>
            </div>
            {!canEdit && summary.status !== 'signed' ? (
                <p className="text-sm text-gray-500">Your role cannot edit the discharge summary.</p>
            ) : null}
        </div>
    );
}

export const DischargeSummaryTab = memo(DischargeSummaryTabInner);
