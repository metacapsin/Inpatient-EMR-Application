import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import AppButton from '../../../components/ui/AppButton';
import { Button } from '../../../components/ui/button';
import NewDropdown from '../../../components/ui/NewDropdown';
import { ALLIED_HEALTH_DISCIPLINES, ALLIED_HEALTH_VISIT_TYPES } from '../constants/alliedHealthOptions';
import {
    fetchAlliedHealthNotesByEncounter,
    signAlliedHealthNote,
} from '../mock/alliedHealthNoteStore';
import type { AlliedHealthDiscipline, AlliedHealthNote, AlliedHealthVisitType } from '../types/alliedHealthNote.types';
import { AlliedHealthNoteFormModal } from './AlliedHealthNoteFormModal';

type Props = {
    patientId: string;
    encounterId: string;
};

const filterOptions = (values: readonly string[], allLabel: string) => [
    { value: '', label: allLabel },
    ...values.map((v) => ({ value: v, label: v })),
];

function formatVisitDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function AlliedHealthNotesTab({ patientId, encounterId }: Props) {
    const [disciplineFilter, setDisciplineFilter] = useState<AlliedHealthDiscipline | ''>('');
    const [visitTypeFilter, setVisitTypeFilter] = useState<AlliedHealthVisitType | ''>('');
    const [notes, setNotes] = useState<AlliedHealthNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<AlliedHealthNote | null>(null);
    const [viewReadonly, setViewReadonly] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchAlliedHealthNotesByEncounter(encounterId, {
                discipline: disciplineFilter,
                visitType: visitTypeFilter,
            });
            setNotes(list);
        } catch {
            toast.error('Could not load allied health notes');
        } finally {
            setLoading(false);
        }
    }, [encounterId, disciplineFilter, visitTypeFilter]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    function openAdd() {
        setEditingNote(null);
        setViewReadonly(false);
        setModalOpen(true);
    }

    function openEdit(note: AlliedHealthNote) {
        setEditingNote(note);
        setViewReadonly(false);
        setModalOpen(true);
    }

    function openView(note: AlliedHealthNote) {
        setEditingNote(note);
        setViewReadonly(true);
        setModalOpen(true);
    }

    async function handleLockAndSign(note: AlliedHealthNote) {
        try {
            await signAlliedHealthNote(note.id, new Date().toISOString());
            toast.success('Note signed and locked');
            await refresh();
        } catch {
            toast.error('Lock & sign failed');
        }
    }

    return (
        <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                    <div className="w-52">
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Discipline</label>
                        <NewDropdown
                            options={filterOptions(ALLIED_HEALTH_DISCIPLINES, 'All disciplines')}
                            value={disciplineFilter}
                            onChange={(v) => setDisciplineFilter(String(v) as AlliedHealthDiscipline | '')}
                            placeholder="All disciplines"
                        />
                    </div>
                    <div className="w-52">
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Visit Type</label>
                        <NewDropdown
                            options={filterOptions(ALLIED_HEALTH_VISIT_TYPES, 'All visit types')}
                            value={visitTypeFilter}
                            onChange={(v) => setVisitTypeFilter(String(v) as AlliedHealthVisitType | '')}
                            placeholder="All visit types"
                        />
                    </div>
                </div>
                <AppButton type="button" onClick={openAdd}>
                    + Add Note
                </AppButton>
            </div>

            {loading ? <p className="text-sm text-gray-500">Loading notes…</p> : null}

            <div className="space-y-2">
                {notes.length === 0 && !loading ? (
                    <p className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                        No allied health notes for this encounter.
                    </p>
                ) : null}
                {notes.map((note) => (
                    <div
                        key={note.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
                    >
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium text-gray-900 dark:text-white">{note.discipline}</p>
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="text-gray-500">Visit type:</span> {note.visitType}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="text-gray-500">Visit date:</span> {formatVisitDate(note.visitDateTime)}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="text-gray-500">Status:</span>{' '}
                                <span
                                    className={
                                        note.status === 'Signed'
                                            ? 'font-medium text-emerald-700 dark:text-emerald-400'
                                            : 'font-medium text-amber-700 dark:text-amber-400'
                                    }
                                >
                                    {note.status}
                                </span>
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="text-gray-500">Signed by:</span> {note.signedBy || '—'}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            {note.status === 'Draft' ? (
                                <>
                                    <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => openEdit(note)}>
                                        Edit
                                    </Button>
                                    <AppButton type="button" className="h-8 px-3 text-xs" onClick={() => void handleLockAndSign(note)}>
                                        Lock & Sign
                                    </AppButton>
                                </>
                            ) : (
                                <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => openView(note)}>
                                    View
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <AlliedHealthNoteFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                patientId={patientId}
                encounterId={encounterId}
                editingNote={editingNote}
                readonly={viewReadonly}
                onSaved={() => void refresh()}
            />
        </div>
    );
}
