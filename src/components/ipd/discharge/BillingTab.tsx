import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '@/lib/utils';
import type { ClaimPrepState } from '../../../types/dischargeReadiness';

type Props = {
    claimPrep: ClaimPrepState;
    billingReady: boolean;
    canEdit: boolean;
    onSaveClaimPrep: (patch: Partial<ClaimPrepState>) => Promise<boolean>;
    onSubmitClaim: () => Promise<boolean>;
};

type FormState = {
    principalDxCode: string;
    principalDxDescription: string;
    procedureCodesText: string;
};

function claimPrepToFormState(c: ClaimPrepState): FormState {
    return {
        principalDxCode: c.principalDxCode ?? '',
        principalDxDescription: c.principalDxDescription ?? '',
        procedureCodesText: c.procedureCodes.join(', '),
    };
}

function Req() {
    return (
        <span className="ml-1 text-red-600" aria-hidden>
            *
        </span>
    );
}

const BillingTabInner = forwardRef<BillingTabHandle, Props>(function BillingTabInner(
    { claimPrep, billingReady, canEdit, onSaveClaimPrep, onSubmitClaim },
    ref,
) {
    const [form, setForm] = useState<FormState>(() => claimPrepToFormState(claimPrep));
    const [principalError, setPrincipalError] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);

    const procedureKey = claimPrep.procedureCodes.join('\u0001');
    useEffect(() => {
        setForm(claimPrepToFormState(claimPrep));
        setPrincipalError(undefined);
    }, [claimPrep.principalDxCode, claimPrep.principalDxDescription, procedureKey]);

    const principalOkSubmitted = claimPrep.status !== 'submitted' || isValidPrincipalIcd(form.principalDxCode);

    const validateForm = useCallback((): boolean => {
        const msg = getPrincipalIcdValidationError(form.principalDxCode);
        setPrincipalError(msg);
        if (msg) scrollToPrincipalIcdField();
        return !msg;
    }, [form.principalDxCode]);

    useImperativeHandle(ref, () => ({
        validate: async () => validateForm(),
    }));

    const statusLabel: Record<ClaimPrepState['status'], string> = {
        not_ready: 'Not ready',
        ready: 'Ready to submit',
        submitted: 'Submitted',
        denied: 'Denied',
        paid: 'Paid',
    };

    return (
        <div className="space-y-6" data-billing-tab>
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">
                    Claim status: {statusLabel[claimPrep.status]}
                </span>
                {claimPrep.payerClaimId ? (
                    <span className="text-xs text-gray-600 dark:text-gray-400">Payer claim #{claimPrep.payerClaimId}</span>
                ) : null}
                {claimPrep.lastSubmittedAt ? (
                    <span className="text-xs text-gray-500">Submitted {new Date(claimPrep.lastSubmittedAt).toLocaleString()}</span>
                ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Totals (mock)</h3>
                    <dl className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Total charges</dt>
                            <dd className="font-medium">${claimPrep.totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Est. patient responsibility</dt>
                            <dd className="font-medium">
                                ${claimPrep.estimatedPatientResponsibility.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </dd>
                        </div>
                    </dl>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">UB-04 / 837I context</h3>
                    <dl className="mt-2 space-y-1 text-sm">
                        <div>
                            <dt className="text-xs uppercase text-gray-500">Claim frequency</dt>
                            <dd>{claimPrep.claimFrequency}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-500">Admission type</dt>
                            <dd>{claimPrep.admissionType}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Coding confirmation</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <div data-billing-field="principalDxCode">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Principal ICD-10-CM
                            <Req />
                        </label>
                        <Input
                            className={cn('mt-1 font-mono', principalError && 'border-destructive')}
                            disabled={!canEdit}
                            aria-invalid={Boolean(principalError)}
                            value={form.principalDxCode}
                            onChange={(e) => {
                                setForm((prev) => ({ ...prev, principalDxCode: e.target.value }));
                                setPrincipalError(undefined);
                            }}
                            onBlur={() => {
                                setForm((prev) => ({ ...prev, principalDxCode: normalizePrincipalIcdInput(prev.principalDxCode) }));
                            }}
                        />
                        {principalError ? <p className="mt-1 text-xs text-red-600">{principalError}</p> : null}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
                        <Input
                            className="mt-1"
                            disabled={!canEdit}
                            value={form.principalDxDescription}
                            onChange={(e) => setForm((prev) => ({ ...prev, principalDxDescription: e.target.value }))}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">ICD-10-PCS (comma-separated)</label>
                        <Input
                            className="mt-1 font-mono"
                            disabled={!canEdit}
                            value={form.procedureCodesText}
                            onChange={(e) => setForm((prev) => ({ ...prev, procedureCodesText: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={!canEdit || saving || !principalOkSubmitted}
                        onClick={async () => {
                            setSaving(true);
                            const codes = form.procedureCodesText
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                            await onSaveClaimPrep({
                                principalDxCode: normalizePrincipalIcdInput(form.principalDxCode) || null,
                                principalDxDescription: form.principalDxDescription.trim() || null,
                                procedureCodes: codes,
                            });
                            setSaving(false);
                        }}
                    >
                        {saving ? 'Saving…' : 'Save claim prep'}
                    </AppButton>
                    <Button
                        type="button"
                        disabled={!canEdit || saving || claimPrep.status === 'submitted' || !billingReady}
                        onClick={async () => {
                            setSaving(true);
                            await onSubmitClaim();
                            setSaving(false);
                        }}
                    >
                        Submit claim (mock)
                    </Button>
                </div>
                {!billingReady && claimPrep.status !== 'submitted' ? (
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                        Hard billing blockers remain — see readiness header before submitting.
                    </p>
                ) : null}
                {claimPrep.status === 'submitted' ? (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Claim was submitted; you can still correct the principal diagnosis and save. A valid ICD-10-CM code (e.g. J18.9) is
                        required before save.
                    </p>
                ) : null}
                {!canEdit ? <p className="mt-2 text-sm text-gray-500">Your role cannot edit claim preparation.</p> : null}
            </div>
        </div>
    );
});

export const BillingTab = memo(BillingTabInner);
