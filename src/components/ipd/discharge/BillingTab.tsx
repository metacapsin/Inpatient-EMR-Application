import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { ClaimPrepState } from '../../../types/dischargeReadiness';
import AppButton from '@/components/ui/AppButton';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { getClaimSubmitBlockedReason } from '../../../utils/dischargeReadinessValidation';

type Props = {
    claimPrep: ClaimPrepState;
    billingReady: boolean;
    canEdit: boolean;
    onSaveClaimPrep: (patch: Partial<ClaimPrepState>) => Promise<boolean>;
    onSubmitClaim: () => Promise<boolean>;
};

function BillingTabInner({ claimPrep, billingReady, canEdit, onSaveClaimPrep, onSubmitClaim }: Props) {
    const ctx = useDischargeReadiness();
    const { setClaimPrepDraft, clearClaimPrepDraft } = ctx;
    const [principalCode, setPrincipalCode] = useState(claimPrep.principalDxCode ?? '');
    const [principalDesc, setPrincipalDesc] = useState(claimPrep.principalDxDescription ?? '');
    const [procCodes, setProcCodes] = useState(claimPrep.procedureCodes.join(', '));
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const saveInFlight = useRef(false);
    const submitInFlight = useRef(false);

    useEffect(() => {
        setPrincipalCode(claimPrep.principalDxCode ?? '');
        setPrincipalDesc(claimPrep.principalDxDescription ?? '');
        setProcCodes(claimPrep.procedureCodes.join(', '));
    }, [claimPrep]);

    const procedureCodesParsed = useMemo(
        () =>
            procCodes
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        [procCodes],
    );

    useEffect(() => {
        if (claimPrep.status === 'submitted') {
            clearClaimPrepDraft();
            return;
        }
        setClaimPrepDraft({
            principalDxCode: principalCode.trim() || null,
            principalDxDescription: principalDesc.trim() || null,
            procedureCodes: procedureCodesParsed,
        });
    }, [principalCode, principalDesc, procedureCodesParsed, claimPrep.status, setClaimPrepDraft, clearClaimPrepDraft]);

    const submitBlockedReason = useMemo(
        () =>
            getClaimSubmitBlockedReason({
                payload: ctx.view,
                snapshot: ctx.snapshot,
                principalDxCodeForm: principalCode.trim(),
                canEdit,
                claimPrepStatus: claimPrep.status,
            }),
        [ctx.view, ctx.snapshot, principalCode, canEdit, claimPrep.status],
    );

    const statusLabel: Record<ClaimPrepState['status'], string> = {
        not_ready: 'Not ready',
        ready: 'Ready to submit',
        submitted: 'Submitted',
        denied: 'Denied',
        paid: 'Paid',
    };

    const submitDisabled =
        !canEdit || saving || submitting || claimPrep.status === 'submitted' || submitBlockedReason != null;

    return (
        <div className="space-y-6">
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
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Totals</h3>
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
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Principal ICD-10-CM</label>
                        <Input
                            className="mt-1 font-mono"
                            disabled={!canEdit || claimPrep.status === 'submitted'}
                            value={principalCode}
                            onChange={(e) => setPrincipalCode(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
                        <Input
                            className="mt-1"
                            disabled={!canEdit || claimPrep.status === 'submitted'}
                            value={principalDesc}
                            onChange={(e) => setPrincipalDesc(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">ICD-10-PCS (comma-separated)</label>
                        <Input
                            className="mt-1 font-mono"
                            disabled={!canEdit || claimPrep.status === 'submitted'}
                            value={procCodes}
                            onChange={(e) => setProcCodes(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton
                        type="button"
                        disabled={!canEdit || saving || submitting || claimPrep.status === 'submitted'}
                        onClick={async () => {
                            if (saveInFlight.current) return;
                            saveInFlight.current = true;
                            setSaving(true);
                            try {
                                const ok = await onSaveClaimPrep({
                                    principalDxCode: principalCode.trim() || null,
                                    principalDxDescription: principalDesc.trim() || null,
                                    procedureCodes: procedureCodesParsed,
                                });
                                if (ok) clearClaimPrepDraft();
                            } finally {
                                setSaving(false);
                                saveInFlight.current = false;
                            }
                        }}
                    >
                        {saving ? 'Saving…' : 'Save claim prep'}
                    </AppButton>
                    <Button
                        type="button"
                        disabled={submitDisabled}
                        title={submitBlockedReason ?? undefined}
                        onClick={async () => {
                            if (submitInFlight.current) return;
                            submitInFlight.current = true;
                            setSubmitting(true);
                            try {
                                const saved = await onSaveClaimPrep({
                                    principalDxCode: principalCode.trim() || null,
                                    principalDxDescription: principalDesc.trim() || null,
                                    procedureCodes: procedureCodesParsed,
                                });
                                if (saved) clearClaimPrepDraft();
                                if (!saved) return;
                                await onSubmitClaim();
                            } catch {
                                toast.error('Claim submission failed. Please try again.');
                            } finally {
                                setSubmitting(false);
                                submitInFlight.current = false;
                            }
                        }}
                    >
                        {submitting ? 'Submitting…' : 'Submit claim'}
                    </Button>
                </div>
                {submitBlockedReason && claimPrep.status !== 'submitted' ? (
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{submitBlockedReason}</p>
                ) : null}
                {!billingReady && claimPrep.status !== 'submitted' && canEdit ? (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Billing readiness (charges, eligibility, principal diagnosis) must be green in the header before submit.
                    </p>
                ) : null}
                {!canEdit ? <p className="mt-2 text-sm text-gray-500">Your role cannot edit claim preparation.</p> : null}
            </div>
        </div>
    );
}

export const BillingTab = memo(BillingTabInner);
