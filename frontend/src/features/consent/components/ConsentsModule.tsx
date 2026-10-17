import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../../store';
import { selectAdtEncounter } from '../../../store/adtEncounterSlice';
import { providerDisplayNameFromUser, providerSignUserIdFromUser } from '../../../utils/dischargeReadinessUser';
import type { ConsentRecord, CreateConsentPayload } from '../../../types/consent';
import { useConsents } from '../hooks/useConsents';
import { usePatientRights } from '../hooks/usePatientRights';
import { tenantIdFromUser } from '../utils/consentLinks';
import { CONSENT_SURFACE_CLASS } from '../constants/consentLayout';
import { ConsentsPageHeader } from './ConsentsPageHeader';
import { ConsentSummaryCards } from './ConsentSummaryCards';
import { ActiveConsentsTable } from './ActiveConsentsTable';
import { ObtainConsentModal } from './ObtainConsentModal';
import { ConsentPdfViewerModal } from './ConsentPdfViewerModal';
import { RevokeConsentModal } from './RevokeConsentModal';
import { HipaaPatientRightsPanel } from './HipaaPatientRightsPanel';
import { ConsentsTableSkeleton } from './ConsentsTableSkeleton';
import { ConsentsEmptyState, ConsentsErrorState } from './ConsentsStates';

type Props = {
    patientId: string;
    patientName?: string;
    patientMrn?: string;
};

export function ConsentsModule({ patientId, patientName, patientMrn }: Props) {
    const user = useSelector((s: IRootState) => s.auth.user);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));
    const encounterId = session?.encounterId?.trim() ?? `enc-${patientId}`;
    const tenantId = tenantIdFromUser(user);

    const witnessId = providerSignUserIdFromUser(user) || 'current-user';
    const witnessName = providerDisplayNameFromUser(user) || 'Current User';
    const obtainedBy = witnessId;
    const obtainedByName = witnessName;

    const {
        records,
        completeness,
        summary,
        lastUpdated,
        listQuery,
        isLoading,
        isError,
        errorMessage,
        createMutation,
        signMutation,
        revokeMutation,
        invalidate,
    } = useConsents(encounterId, patientId, tenantId);

    const rights = usePatientRights(patientId);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [reObtainRecord, setReObtainRecord] = useState<ConsentRecord | null>(null);
    const [pdfRecord, setPdfRecord] = useState<ConsentRecord | null>(null);
    const [revokeRecord, setRevokeRecord] = useState<ConsentRecord | null>(null);

    const encounterLabel = useMemo(() => {
        const eid = encounterId;
        if (!eid) return undefined;
        const tail = eid.length > 10 ? `…${eid.slice(-8)}` : eid;
        return `ENC ${tail}`;
    }, [encounterId]);

    const handleObtainSubmit = useCallback(
        async (payload: CreateConsentPayload) => {
            const pending: CreateConsentPayload = { ...payload, status: 'Pending' };
            const created = await createMutation.mutateAsync(pending);
            if (!created.ok) return;

            const signed = await signMutation.mutateAsync({
                consentId: created.data.consentId,
                payload: {
                    patientSignatureData: payload.patientSignatureData!,
                    witnessSignatureData: payload.witnessSignatureData!,
                    witnessId: payload.witnessId!,
                    witnessName: payload.witnessName!,
                    signedAt: payload.signedAt!,
                },
            });
            if (signed.ok) {
                setDrawerOpen(false);
                setReObtainRecord(null);
            }
        },
        [createMutation, signMutation],
    );

    const handleRevoke = (reason: string) => {
        if (!revokeRecord) return;
        revokeMutation.mutate(
            { consentId: revokeRecord.consentId, payload: { revokedReason: reason } },
            { onSuccess: () => setRevokeRecord(null) },
        );
    };

    const busy = createMutation.isPending || signMutation.isPending;

    return (
        <div className={`${CONSENT_SURFACE_CLASS} gap-0`}>
            <ConsentsPageHeader
                patientName={patientName}
                patientMrn={patientMrn}
                encounterId={encounterId}
                encounterLabel={encounterLabel}
                completeness={completeness}
                lastUpdated={lastUpdated}
                patientId={patientId}
                onObtainConsent={() => {
                    setReObtainRecord(null);
                    setDrawerOpen(true);
                }}
                onRefresh={() => void invalidate()}
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 p-4">
                    <ConsentSummaryCards counts={summary} loading={isLoading} />

                    {isError ? (
                        <ConsentsErrorState message={errorMessage} onRetry={() => void listQuery.refetch()} />
                    ) : isLoading ? (
                        <ConsentsTableSkeleton />
                    ) : records.length === 0 ? (
                        <ConsentsEmptyState
                            onObtain={() => {
                                setReObtainRecord(null);
                                setDrawerOpen(true);
                            }}
                        />
                    ) : (
                        <ActiveConsentsTable
                            records={records}
                            patientId={patientId}
                            onViewPdf={setPdfRecord}
                            onReObtain={(r) => {
                                setReObtainRecord(r);
                                setDrawerOpen(true);
                            }}
                            onRevoke={setRevokeRecord}
                        />
                    )}

                    <HipaaPatientRightsPanel
                        records={rights.records}
                        loading={rights.query.isPending}
                        patientId={patientId}
                        tenantId={tenantId}
                        onCreate={(p) => rights.createMutation.mutate(p)}
                    />
                </div>
            </div>

            <ObtainConsentModal
                open={drawerOpen}
                onClose={() => {
                    setDrawerOpen(false);
                    setReObtainRecord(null);
                }}
                loading={busy}
                witnessId={witnessId}
                witnessName={witnessName}
                obtainedBy={obtainedBy}
                obtainedByName={obtainedByName}
                reObtainFrom={reObtainRecord}
                patientId={patientId}
                encounterId={encounterId}
                tenantId={tenantId}
                onSubmit={handleObtainSubmit}
            />

            <ConsentPdfViewerModal open={Boolean(pdfRecord)} record={pdfRecord} onClose={() => setPdfRecord(null)} />

            <RevokeConsentModal
                open={Boolean(revokeRecord)}
                record={revokeRecord}
                loading={revokeMutation.isPending}
                onClose={() => setRevokeRecord(null)}
                onConfirm={handleRevoke}
            />
        </div>
    );
}
