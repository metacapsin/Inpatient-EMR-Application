import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { AppModal } from '../../../components/shared/AppModal';
import { patientDataAPI } from '../../../services/api';
import type { IRootState } from '../../../store';
import { selectAdtEncounter } from '../../../store/adtEncounterSlice';
import { tenantIdFromUser } from '../../consent/utils/consentLinks';
import type { PriorAuthFormValues, PriorAuthRecord } from '../types/priorAuth.types';
import { emptyPriorAuthForm, recordToFormValues } from '../Prior/priorAuthFormDefaults';
import { insuranceDefaultsFromDemographicsPayload } from '../Prior/priorAuthInsuranceFill';
import {
    createPriorAuth,
    fetchExpiringPriorAuths,
    fetchPriorAuthDashboard,
    getPriorAuthsByEncounter,
    updatePriorAuth,
} from '../services/priorAuth.service';
import { PriorAuthHeaderBadges } from './PriorAuthHeaderBadges';
import { PriorAuthEntryForm } from './PriorAuthEntryForm';
import { PriorAuthStatusCard } from './PriorAuthStatusCard';
import { PriorAuthExpiringAlerts } from './PriorAuthExpiringAlerts';
import { PriorAuthDashboardSummary } from './PriorAuthDashboardSummary';
import type { PriorAuthDashboardSummary as SummaryType, PriorAuthExpiringItem } from '../types/priorAuth.types';

type Props = {
    patientId: string;
};

export function PriorAuthModule({ patientId }: Props) {
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));
    const encounterId = session?.encounterId?.trim() ?? '';
    const tenantId = tenantIdFromUser(authUser);

    const [records, setRecords] = useState<PriorAuthRecord[]>([]);
    const [form, setForm] = useState<PriorAuthFormValues>(() => emptyPriorAuthForm());
    const [editingAuthId, setEditingAuthId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [summary, setSummary] = useState<SummaryType | null>(null);
    const [expiring, setExpiring] = useState<PriorAuthExpiringItem[]>([]);
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [insuranceDefaults, setInsuranceDefaults] = useState<{
        insurancePayer: string;
        payerName: string;
    } | null>(null);

    const loadInsuranceDefaults = useCallback(async () => {
        try {
            const res = await patientDataAPI.getPatientDemographics(patientId);
            const ins = insuranceDefaultsFromDemographicsPayload(res.data);
            setInsuranceDefaults(ins);
            setForm((f) => ({
                ...f,
                insurancePayer: f.insurancePayer || ins.insurancePayer,
                payerName: f.payerName || ins.payerName,
            }));
        } catch {
            /* keep dummy defaults */
        }
    }, [patientId]);

    const refresh = useCallback(async () => {
        if (!encounterId) {
            setRecords([]);
            return;
        }
        setLoading(true);
        try {
            const [listRes, dashRes, expRes] = await Promise.all([
                getPriorAuthsByEncounter(encounterId, patientId, tenantId),
                fetchPriorAuthDashboard(tenantId),
                fetchExpiringPriorAuths(tenantId),
            ]);
            if (listRes.ok) setRecords(listRes.data);
            if (dashRes.ok) setSummary(dashRes.data);
            if (expRes.ok) {
                setExpiring(
                    expRes.data.filter(
                        (e) => e.patientId === patientId || e.encounterId === encounterId
                    )
                );
            }
        } finally {
            setLoading(false);
        }
    }, [encounterId, patientId, tenantId]);

    useEffect(() => {
        void loadInsuranceDefaults();
    }, [loadInsuranceDefaults]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const patchForm = (patch: Partial<PriorAuthFormValues>) => {
        setForm((f) => ({ ...f, ...patch }));
    };

    const onCreate = async () => {
        if (!encounterId) {
            toast.error('Link an active encounter (ADT) before creating prior authorization.');
            return;
        }
        setBusy(true);
        try {
            const res = await createPriorAuth({ encounterId, patientId, tenantId, form });
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Prior authorization created');
            setEditingAuthId(null);
            setForm(
                emptyPriorAuthForm({
                    insurancePayer: form.insurancePayer,
                    payerName: form.payerName,
                })
            );
            setFormModalOpen(false);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const onUpdate = async () => {
        if (!editingAuthId || !encounterId) return;
        setBusy(true);
        try {
            const res = await updatePriorAuth(
                encounterId,
                editingAuthId,
                {
                    status: form.status,
                    authNumber: form.authNumber,
                    authStartDate: form.authStartDate,
                    authEndDate: form.authEndDate,
                    notes: form.notes,
                    denialReason: form.denialReason,
                },
                form
            );
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Prior authorization updated');
            setEditingAuthId(null);
            setFormModalOpen(false);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const closeFormModal = () => {
        setFormModalOpen(false);
        setEditingAuthId(null);
    };

    const openCreateModal = () => {
        setEditingAuthId(null);
        setForm(
            emptyPriorAuthForm(
                insuranceDefaults ?? {
                    insurancePayer: form.insurancePayer,
                    payerName: form.payerName,
                }
            )
        );
        setFormModalOpen(true);
    };

    const onEdit = (row: PriorAuthRecord) => {
        setEditingAuthId(row.authId);
        setForm(recordToFormValues(row));
        setFormModalOpen(true);
    };

    const onPeerToPeer = async (row: PriorAuthRecord) => {
        if (!encounterId) return;
        setBusy(true);
        try {
            const res = await updatePriorAuth(encounterId, row.authId, {
                status: 'Peer-to-Peer Requested',
            });
            if (!res.ok) toast.error(res.message);
            else {
                toast.success('Peer-to-peer requested');
                await refresh();
            }
        } finally {
            setBusy(false);
        }
    };

    const onMarkReceived = async (row: PriorAuthRecord) => {
        if (!encounterId) return;
        setBusy(true);
        try {
            const res = await updatePriorAuth(encounterId, row.authId, { status: 'Approved' });
            if (!res.ok) toast.error(res.message);
            else {
                toast.success('Authorization marked received');
                await refresh();
            }
        } finally {
            setBusy(false);
        }
    };

    const patientName = useSelector((s: IRootState) => s.facesheet.patient?.fullName);

    if (!encounterId) {
        return (
            <p className="text-sm text-amber-800 dark:text-amber-200">
                No active encounter on file. Open ADT to assign an encounter before managing prior authorization.
            </p>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {summary ? (
                <section>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                        Dashboard summary
                    </p>
                    <PriorAuthDashboardSummary summary={summary} />
                </section>
            ) : null}

            <PriorAuthExpiringAlerts
                items={expiring}
                patientNameById={patientName ? { [patientId]: patientName } : undefined}
            />

            <section className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Patient header
                </p>
                <PriorAuthHeaderBadges records={records} />
            </section>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Loading prior authorizations…
                </div>
            ) : (
                <PriorAuthStatusCard
                    rows={records}
                    busy={busy}
                    onCreate={openCreateModal}
                    onEdit={onEdit}
                    onPeerToPeer={(r) => void onPeerToPeer(r)}
                    onMarkReceived={(r) => void onMarkReceived(r)}
                />
            )}

            <AppModal
                open={formModalOpen}
                title={editingAuthId ? 'Edit Prior Authorization' : 'Prior Authorization Entry'}
                description={
                    editingAuthId
                        ? 'Update authorization details for this encounter.'
                        : 'Enter service, payer, and authorization details.'
                }
                onClose={closeFormModal}
                size="xl"
                className="max-w-4xl"
                bodyClassName="overflow-y-auto"
            >
                <PriorAuthEntryForm
                    values={form}
                    editingAuthId={editingAuthId}
                    busy={busy}
                    variant="embedded"
                    onChange={patchForm}
                    onCreate={() => void onCreate()}
                    onUpdate={() => void onUpdate()}
                    onCancel={closeFormModal}
                />
            </AppModal>
        </div>
    );
}
