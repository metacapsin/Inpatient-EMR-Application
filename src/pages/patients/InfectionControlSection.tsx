import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { HAIEncounterTimeline } from '../../components/hai/HAIEncounterTimeline';
import { AddInfectionModal } from '../../components/infection/AddInfectionModal';
import { InfectionCard } from '../../components/infection/InfectionCard';
import { InfectionEmptyState } from '../../components/infection/InfectionEmptyState';
import { InfectionHeader } from '../../components/infection/InfectionHeader';
import { useInfectionControl } from '../../contexts/InfectionControlContext';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { haiEventFromInfectionChange } from '../../lib/haiEventFromInfection';
import { hasFormErrors, validateInfectionForm } from '../../lib/infectionControlUtils';
import { recordLocalHaiEvent } from '../../services/haiEvent.service';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import type { InfectionFormValues, InfectionRecord, IsolationType } from '../../types/infectionControl';

const DEMO_ENCOUNTER = 'ENC001';

type InfectionControlSectionProps = {
    /** Override patient id (e.g. embedded views). */
    patientIdOverride?: string;
};

export default function InfectionControlSection({ patientIdOverride }: InfectionControlSectionProps) {
    const { id: urlPatientId } = useParams<{ id: string }>();
    const patientId = (patientIdOverride ?? usePatientId() ?? urlPatientId ?? '').trim();
    const { moduleRootClass } = useFacesheetChartLayout();
    const queryClient = useQueryClient();
    const encounter = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = encounter?.encounterId?.trim() || DEMO_ENCOUNTER;
    const { getByPatientId, addRecord, updateRecord, deleteRecord } = useInfectionControl();

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<InfectionRecord | null>(null);

    const records = useMemo(() => {
        if (!patientId) return [];
        return [...getByPatientId(patientId)].sort((a, b) => {
            const statusOrder = { Active: 0, Monitoring: 1, Resolved: 2 };
            const sa = statusOrder[a.status] ?? 3;
            const sb = statusOrder[b.status] ?? 3;
            if (sa !== sb) return sa - sb;
            return b.detectedDate.localeCompare(a.detectedDate);
        });
    }, [patientId, getByPatientId]);

    const openAdd = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (record: InfectionRecord) => {
        setEditing(record);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
    };

    const handleSave = (form: InfectionFormValues) => {
        const errors = validateInfectionForm(form);
        if (hasFormErrors(errors)) {
            toast.error('Please complete all required fields');
            return;
        }

        const isolationType: IsolationType =
            form.isolationRequired && form.isolationType !== 'None'
                ? (form.isolationType as IsolationType)
                : form.isolationRequired
                  ? 'Contact'
                  : 'None';

        const payload = {
            patientId,
            encounterId: editing?.encounterId ?? encounterId,
            infectionType: form.infectionType.trim(),
            symptoms: form.symptoms.trim(),
            source: form.source.trim(),
            severity: form.severity as InfectionRecord['severity'],
            isolationRequired: form.isolationRequired,
            isolationType,
            notes: form.notes.trim(),
            status: form.status as InfectionRecord['status'],
            detectedDate: form.detectedDate,
        };

        let saved: InfectionRecord;
        if (editing) {
            updateRecord(editing.id, payload);
            saved = { ...editing, ...payload };
            const change =
                payload.status === 'Resolved'
                    ? 'resolved'
                    : payload.isolationRequired && !editing.isolationRequired
                      ? 'isolation'
                      : payload.severity !== editing.severity
                        ? 'severity'
                        : payload.status !== editing.status
                          ? 'status'
                          : 'updated';
            recordLocalHaiEvent(haiEventFromInfectionChange(saved, change));
            toast.success('Infection updated successfully');
        } else {
            saved = addRecord(payload);
            recordLocalHaiEvent(haiEventFromInfectionChange(saved, 'created'));
            if (payload.isolationRequired) {
                recordLocalHaiEvent(haiEventFromInfectionChange(saved, 'isolation'));
            }
            toast.success('Infection record created successfully');
        }
        void queryClient.invalidateQueries({ queryKey: ['haiEvent', 'encounter', encounterId] });
        void queryClient.invalidateQueries({ queryKey: ['haiEvent', 'summary'] });
        closeModal();
    };

    const handleDelete = (id: string) => {
        deleteRecord(id);
        toast.success('Infection removed successfully');
    };

    if (!patientId) {
        return (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </div>
        );
    }

    return (
        <div className={moduleRootClass}>
            <InfectionHeader onAdd={openAdd} />

            {records.length === 0 ? (
                <InfectionEmptyState />
            ) : (
                <div className="space-y-3">
                    {records.map((record) => (
                        <InfectionCard key={record.id} record={record} onEdit={openEdit} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            <div className="mt-6">
                <HAIEncounterTimeline encounterId={encounterId} />
            </div>

            <AddInfectionModal open={modalOpen} editing={editing} onClose={closeModal} onSave={handleSave} />
        </div>
    );
}
