import React, { memo, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { ClaimPrepState } from '../../../types/dischargeReadiness';
import AppButton from '@/components/ui/AppButton';

type Props = {
    claimPrep: ClaimPrepState;
    billingReady: boolean;
    canEdit: boolean;
    onSaveClaimPrep: (patch: Partial<ClaimPrepState>) => Promise<boolean>;
    onSubmitClaim: () => Promise<boolean>;
};

function BillingTabInner({ claimPrep, billingReady, canEdit, onSaveClaimPrep, onSubmitClaim }: Props) {
    const [principalCode, setPrincipalCode] = useState(claimPrep.principalDxCode ?? '');
    const [principalDesc, setPrincipalDesc] = useState(claimPrep.principalDxDescription ?? '');
    const [procCodes, setProcCodes] = useState(claimPrep.procedureCodes.join(', '));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setPrincipalCode(claimPrep.principalDxCode ?? '');
        setPrincipalDesc(claimPrep.principalDxDescription ?? '');
        setProcCodes(claimPrep.procedureCodes.join(', '));
    }, [claimPrep]);

    const statusLabel: Record<ClaimPrepState['status'], string> = {
        not_ready: 'Not ready',
        ready: 'Ready to submit',
        submitted: 'Submitted',
        denied: 'Denied',
        paid: 'Paid',
    };

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
                    <div>
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
                        disabled={!canEdit || saving || claimPrep.status === 'submitted'}
                        onClick={async () => {
                            setSaving(true);
                            const codes = procCodes
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                            await onSaveClaimPrep({
                                principalDxCode: principalCode.trim() || null,
                                principalDxDescription: principalDesc.trim() || null,
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
                {!canEdit ? <p className="mt-2 text-sm text-gray-500">Your role cannot edit claim preparation.</p> : null}
            </div>
        </div>
    );
}

export const BillingTab = memo(BillingTabInner);
