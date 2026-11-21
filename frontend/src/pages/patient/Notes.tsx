import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Eye,
    FilePlus2,
    FileText,
    FolderOpen,
    Pencil,
    RotateCcw,
    Search,
    Trash2,
    User,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import {
    CHART_NOTE_STATUSES,
    PHASE1_NOTE_TYPES,
    deletePatientChartNote,
    fetchProviderOptions,
    formatVisitDateDisplay,
    listPatientChartNotes,
    markChartNoteInError,
    previewNoteText,
    restoreChartNote,
    type PatientChartNote,
} from '../../services/patientChartNotes.service';

const NOTE_TYPE_OPTIONS = [...PHASE1_NOTE_TYPES];

type NoteConfirmKind = 'delete' | 'restore' | 'markInError';

const Notes: React.FC = () => {
    const patientId = usePatientId();
    const navigate = useNavigate();
    const { moduleSurfaceClass } = useFacesheetChartLayout();

    const [notesList, setNotesList] = useState<PatientChartNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [providerFilter, setProviderFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{ kind: NoteConfirmKind; note: PatientChartNote } | null>(null);
    const [inErrorReason, setInErrorReason] = useState('');

    const facesheetBase = patientId ? `/app/facesheet/${encodeURIComponent(patientId)}/notes` : '/app/notes';
    const confirmBusy = Boolean(confirm && busyId === confirm.note.id);

    const loadNotes = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        try {
            const rows = await listPatientChartNotes({
                patientId,
                notesType: typeFilter || undefined,
                noteStatus: statusFilter || undefined,
                assignedProvider: providerFilter || undefined,
                includeInError: true,
            });
            setNotesList(rows);
            setCurrentPage(1);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to fetch notes');
        } finally {
            setLoading(false);
        }
    }, [patientId, typeFilter, statusFilter, providerFilter]);

    useEffect(() => {
        fetchProviderOptions()
            .then(setProviders)
            .catch(() => setProviders([]));
    }, []);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const filteredNotes = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return notesList;
        return notesList.filter((n) => {
            const hay = [
                n.notesType,
                n.notesText,
                n.assignedProvider?.name,
                n.providerSigned,
                n.noteStatus,
                n.createdByName,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [notesList, searchText]);

    const totalPages = Math.max(1, Math.ceil(filteredNotes.length / rowsPerPage));
    const page = Math.min(currentPage, totalPages);
    const paginated = filteredNotes.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    const openNote = (id: string) => navigate(`${facesheetBase}/${encodeURIComponent(id)}`);

    const closeConfirm = () => {
        if (confirmBusy) return;
        setConfirm(null);
        setInErrorReason('');
    };

    const openConfirm = (kind: NoteConfirmKind, note: PatientChartNote) => {
        setInErrorReason('');
        setConfirm({ kind, note });
    };

    const runConfirm = async () => {
        if (!confirm) return;
        const { kind, note } = confirm;
        if (kind === 'markInError' && inErrorReason.trim().length < 3) {
            toast.error('Enter a reason (at least 3 characters)');
            return;
        }
        setBusyId(note.id);
        try {
            if (kind === 'markInError') {
                await markChartNoteInError(note.id, inErrorReason.trim());
                toast.success('Note marked in error');
            } else if (kind === 'restore') {
                await restoreChartNote(note.id);
                toast.success('Note restored');
            } else {
                await deletePatientChartNote(note.id);
                toast.success('Note deleted');
            }
            setConfirm(null);
            setInErrorReason('');
            await loadNotes();
        } catch (err: any) {
            toast.error(
                err?.response?.data?.message ||
                    (kind === 'markInError'
                        ? 'Failed to mark note in error'
                        : kind === 'restore'
                          ? 'Failed to restore note'
                          : 'Failed to delete note'),
            );
        } finally {
            setBusyId(null);
        }
    };

    if (!patientId) {
        return (
            <div className={moduleSurfaceClass}>
                <p className="text-sm text-gray-600 dark:text-gray-300">Open a patient facesheet to view clinical notes.</p>
            </div>
        );
    }

    return (
        <div className={moduleSurfaceClass}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ul className="flex flex-wrap items-center gap-2 text-sm">
                    <li>
                        <Link to="/app/patients/list" className="text-primary hover:underline">
                            Patient List
                        </Link>
                    </li>
                    <li className="text-gray-400">/</li>
                    <li className="font-medium text-gray-900 dark:text-white">Notes</li>
                </ul>
                <Link to={`${facesheetBase}/create`} className="btn btn-primary inline-flex shrink-0 items-center gap-2">
                    <FilePlus2 className="h-4 w-4" />
                    Create note
                </Link>
            </div>

            <div className="panel mb-5">
                <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Clinical notes</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Encounter documentation, signatures, and chart notes for this patient.
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            <span>{filteredNotes.length}</span>
                            <span className="font-normal opacity-75">total</span>
                        </span>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">Quick search</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                className="form-input w-full pl-10"
                                placeholder="Filter by title, author, or content…"
                                value={searchText}
                                onChange={(e) => {
                                    setSearchText(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">Provider</label>
                        <select
                            className="form-select w-full"
                            value={providerFilter}
                            onChange={(e) => setProviderFilter(e.target.value)}
                        >
                            <option value="">Select Provider</option>
                            {providers.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">Note type</label>
                        <select className="form-select w-full" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                            <option value="">Select Type</option>
                            {NOTE_TYPE_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">Note status</label>
                        <select
                            className="form-select w-full"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Select Status</option>
                            {CHART_NOTE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-sm text-gray-500">Loading…</div>
                ) : paginated.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h5 className="mb-1 text-base font-semibold text-gray-700 dark:text-gray-200">No notes to show</h5>
                        <p className="mx-auto max-w-md text-sm text-gray-500">
                            Try clearing filters or search, or create a new note for this encounter.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {paginated.map((note) => (
                            <article
                                key={note.id}
                                className="rounded-xl border border-white-light bg-white p-4 shadow-sm transition hover:shadow-md dark:border-[#191e3a] dark:bg-[#0e1726]"
                            >
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                                            <h6 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                                                {note.notesType}
                                            </h6>
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    note.noteStatus === 'Completed'
                                                        ? 'bg-success/15 text-success'
                                                        : note.noteStatus === 'Marked in Error'
                                                          ? 'bg-danger/15 text-danger'
                                                          : 'bg-warning/15 text-warning'
                                                }`}
                                            >
                                                {note.noteStatus === 'Completed' ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                ) : note.noteStatus === 'Marked in Error' ? (
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Pencil className="h-3.5 w-3.5" />
                                                )}
                                                {note.noteStatus}
                                            </span>
                                        </div>
                                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {formatVisitDateDisplay(note.date)}
                                        </p>
                                    </div>
                                </div>

                                <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                    {previewNoteText(note.notesText) || 'No note text.'}
                                </p>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                                        <User className="h-3.5 w-3.5" />
                                        {note.assignedProvider?.name || 'Unknown'}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary inline-flex items-center gap-1"
                                            onClick={() => openNote(note.id)}
                                            disabled={busyId === note.id}
                                        >
                                            {note.noteStatus === 'Marked in Error' ? (
                                                <Eye className="h-3.5 w-3.5" />
                                            ) : (
                                                <FolderOpen className="h-3.5 w-3.5" />
                                            )}
                                            {note.noteStatus === 'Marked in Error' ? 'View' : 'Open'}
                                        </button>
                                        {note.noteStatus !== 'Marked in Error' ? (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-warning inline-flex items-center gap-1"
                                                disabled={busyId === note.id}
                                                onClick={() => openConfirm('markInError', note)}
                                            >
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Mark in Error
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success inline-flex items-center gap-1"
                                                disabled={busyId === note.id}
                                                onClick={() => openConfirm('restore', note)}
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                Restore
                                            </button>
                                        )}
                                        {note.noteStatus !== 'Completed' ? (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger inline-flex items-center gap-1"
                                                disabled={busyId === note.id}
                                                onClick={() => openConfirm('delete', note)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                {note.providerSigned ? (
                                    <div className="mt-3 border-t border-white-light pt-3 text-xs text-gray-500 dark:border-[#191e3a]">
                                        <strong>
                                            Electronically signed by {note.providerSigned}
                                            {note.signedDate ? ` on ${note.signedDate}` : ''}
                                            {note.signedTime ? ` ${note.signedTime}` : ''}
                                        </strong>
                                    </div>
                                ) : null}

                                {note.noteStatus === 'Marked in Error' && note.inErrorReason ? (
                                    <div className="mt-2 rounded-md bg-danger/5 px-3 py-2 text-xs text-danger">
                                        Reason: {note.inErrorReason}
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                )}

                {filteredNotes.length > 0 ? (
                    <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white-light pt-4 dark:border-[#191e3a] sm:flex-row">
                        <p className="text-xs text-gray-500">
                            Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredNotes.length)} of{' '}
                            {filteredNotes.length} notes
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className="form-select w-auto text-sm"
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                {[5, 10, 20].map((n) => (
                                    <option key={n} value={n}>
                                        {n} / page
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                disabled={page <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <span className="px-2 text-sm">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                disabled={page >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <ConfirmDialog
                open={confirm?.kind === 'delete'}
                title="Delete draft note"
                message="Delete this draft note? This cannot be undone."
                detail={confirm?.note.notesType}
                variant="danger"
                confirmLabel="Delete note"
                busy={confirmBusy}
                onCancel={closeConfirm}
                onConfirm={runConfirm}
            />

            <ConfirmDialog
                open={confirm?.kind === 'restore'}
                title="Restore note"
                message="Restore this note to the chart? It will return to draft or completed based on its prior signature."
                detail={confirm?.note.notesType}
                variant="primary"
                confirmLabel="Restore note"
                busy={confirmBusy}
                onCancel={closeConfirm}
                onConfirm={runConfirm}
            />

            <ConfirmDialog
                open={confirm?.kind === 'markInError'}
                title="Mark note in error"
                message="This note will remain in the chart as Marked in Error. Provide a clinical reason for the audit trail."
                detail={confirm?.note.notesType}
                variant="warning"
                confirmLabel="Mark in error"
                busy={confirmBusy}
                confirmDisabled={inErrorReason.trim().length < 3}
                onCancel={closeConfirm}
                onConfirm={runConfirm}
            >
                <div>
                    <label htmlFor="note-in-error-reason" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                        id="note-in-error-reason"
                        className="form-textarea min-h-[96px] w-full resize-y text-sm"
                        rows={3}
                        value={inErrorReason}
                        disabled={confirmBusy}
                        placeholder="Why is this note marked in error?"
                        onChange={(e) => setInErrorReason(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">Minimum 3 characters.</p>
                </div>
            </ConfirmDialog>
        </div>
    );
};

export default Notes;
