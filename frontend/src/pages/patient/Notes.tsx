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
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import {
    CHART_NOTE_STATUSES,
    PROGRESS_NOTE_TYPE,
    deletePatientChartNote,
    fetchProviderOptions,
    formatVisitDateDisplay,
    listPatientChartNotes,
    markChartNoteInError,
    previewNoteText,
    restoreChartNote,
    type PatientChartNote,
} from '../../services/patientChartNotes.service';

const NOTE_TYPE_OPTIONS = [PROGRESS_NOTE_TYPE];

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

    const facesheetBase = patientId ? `/app/facesheet/${encodeURIComponent(patientId)}/notes` : '/app/notes';

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

    const confirmMarkInError = async (note: PatientChartNote) => {
        const reason = window.prompt('Reason for marking this note in error:');
        if (!reason || !reason.trim()) return;
        setBusyId(note.id);
        try {
            await markChartNoteInError(note.id, reason.trim());
            toast.success('Note marked in error');
            await loadNotes();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to mark note in error');
        } finally {
            setBusyId(null);
        }
    };

    const confirmRestore = async (note: PatientChartNote) => {
        if (!window.confirm('Restore this note?')) return;
        setBusyId(note.id);
        try {
            await restoreChartNote(note.id);
            toast.success('Note restored');
            await loadNotes();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to restore note');
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async (note: PatientChartNote) => {
        if (!window.confirm('Delete this draft note? This cannot be undone.')) return;
        setBusyId(note.id);
        try {
            await deletePatientChartNote(note.id);
            toast.success('Note deleted');
            await loadNotes();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to delete note');
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
                                                onClick={() => confirmMarkInError(note)}
                                            >
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Mark in Error
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success inline-flex items-center gap-1"
                                                disabled={busyId === note.id}
                                                onClick={() => confirmRestore(note)}
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
                                                onClick={() => confirmDelete(note)}
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
        </div>
    );
};

export default Notes;
