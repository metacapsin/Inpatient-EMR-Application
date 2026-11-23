import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Paginator, type PaginatorPageChangeEvent } from 'primereact/paginator';
import { Tag } from 'primereact/tag';
import {
    AlertTriangle,
    Calendar,
    Eye,
    FilePlus2,
    FileText,
    FolderOpen,
    RotateCcw,
    Search,
    Trash2,
    User,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import {
    NoteStatusTag,
    NotesListSkeleton,
    notesDropdownOptionTemplate,
    notesDropdownValueTemplate,
    syncOverlayWidth,
} from '../../features/chart-notes/notesUi';
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
    const [first, setFirst] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{ kind: NoteConfirmKind; note: PatientChartNote } | null>(null);
    const [inErrorReason, setInErrorReason] = useState('');

    const facesheetBase = patientId ? `/app/facesheet/${encodeURIComponent(patientId)}/notes` : '/app/notes';
    const confirmBusy = Boolean(confirm && busyId === confirm.note.id);
    const providerDdRef = useRef<Dropdown>(null);
    const typeDdRef = useRef<Dropdown>(null);
    const statusDdRef = useRef<Dropdown>(null);

    const onDropdownShow = (ref: React.RefObject<Dropdown | null>, panelClass: string) => () => {
        syncOverlayWidth(ref.current?.getElement?.() ?? null, `.${panelClass}`, '--notes-dd-w');
    };

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
            setFirst(0);
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

    const paginated = filteredNotes.slice(first, first + rowsPerPage);

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

    const onPageChange = (e: PaginatorPageChangeEvent) => {
        setFirst(e.first);
        setRowsPerPage(e.rows);
    };

    const providerOptions = useMemo(
        () => [{ label: 'All providers', value: '' }, ...providers.map((p) => ({ label: p.name, value: p.id }))],
        [providers],
    );
    const typeOptions = useMemo(
        () => [{ label: 'All types', value: '' }, ...NOTE_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))],
        [],
    );
    const statusOptions = useMemo(
        () => [{ label: 'All statuses', value: '' }, ...CHART_NOTE_STATUSES.map((s) => ({ label: s, value: s }))],
        [],
    );

    if (!patientId) {
        return (
            <div className={moduleSurfaceClass}>
                <p className="text-sm text-gray-600 dark:text-gray-300">Open a patient facesheet to view clinical notes.</p>
            </div>
        );
    }

    return (
        <div className={`${moduleSurfaceClass} notes-module w-full min-w-0`}>
            <div className="mb-5 flex flex-col gap-3 pr-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                    <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <Link to="/app/patients/list" className="text-primary hover:underline">
                            Patient List
                        </Link>
                        <span aria-hidden>/</span>
                        <span className="font-medium text-gray-900 dark:text-white">Clinical Notes</span>
                    </nav>
                    <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Clinical Notes</h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Encounter documentation, signatures, and chart notes for this patient.
                    </p>
                </div>
                <div className="notes-header-actions">
                    <Link to={`${facesheetBase}/create`} className="inline-flex">
                        <Button label="Create note" icon={<FilePlus2 className="mr-1.5 h-4 w-4" />} className="p-button-sm" />
                    </Link>
                </div>
            </div>

            <div className="overflow-visible rounded-xl border border-emr-border/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0e1726]">
                <div className="rounded-t-xl border-b border-emr-border/70 bg-[#faf8f6] px-4 py-4 dark:border-white/10 dark:bg-[#161311]">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Tag
                            value={`${filteredNotes.length} total`}
                            className="!bg-primary/10 !text-primary !text-xs !font-semibold"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0">
                            <label htmlFor="notes-quick-search" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Quick search
                            </label>
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
                                <InputText
                                    id="notes-quick-search"
                                    value={searchText}
                                    className="w-full !pl-9"
                                    placeholder="Title, author, or content…"
                                    onChange={(e) => {
                                        setSearchText(e.target.value);
                                        setFirst(0);
                                    }}
                                />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="notes-provider-filter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Provider
                            </label>
                            <Dropdown
                                ref={providerDdRef}
                                inputId="notes-provider-filter"
                                value={providerFilter}
                                options={providerOptions}
                                onChange={(e) => setProviderFilter(e.value || '')}
                                className="w-full"
                                panelClassName="notes-dd-panel notes-dd-panel-provider"
                                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                                placeholder="All providers"
                                itemTemplate={notesDropdownOptionTemplate}
                                valueTemplate={notesDropdownValueTemplate}
                                onShow={onDropdownShow(providerDdRef, 'notes-dd-panel-provider')}
                            />
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="notes-type-filter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Note type
                            </label>
                            <Dropdown
                                ref={typeDdRef}
                                inputId="notes-type-filter"
                                value={typeFilter}
                                options={typeOptions}
                                onChange={(e) => setTypeFilter(e.value || '')}
                                className="w-full"
                                panelClassName="notes-dd-panel notes-dd-panel-type"
                                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                                placeholder="All types"
                                itemTemplate={notesDropdownOptionTemplate}
                                valueTemplate={notesDropdownValueTemplate}
                                onShow={onDropdownShow(typeDdRef, 'notes-dd-panel-type')}
                            />
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="notes-status-filter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Note status
                            </label>
                            <Dropdown
                                ref={statusDdRef}
                                inputId="notes-status-filter"
                                value={statusFilter}
                                options={statusOptions}
                                onChange={(e) => setStatusFilter(e.value || '')}
                                className="w-full"
                                panelClassName="notes-dd-panel notes-dd-panel-status"
                                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                                placeholder="All statuses"
                                itemTemplate={notesDropdownOptionTemplate}
                                valueTemplate={notesDropdownValueTemplate}
                                onShow={onDropdownShow(statusDdRef, 'notes-dd-panel-status')}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {loading ? (
                        <NotesListSkeleton count={3} />
                    ) : paginated.length === 0 ? (
                        <div className="py-14 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <FileText className="h-6 w-6" />
                            </div>
                            <h2 className="mb-1 text-base font-semibold text-gray-800 dark:text-gray-100">No notes to show</h2>
                            <p className="mx-auto max-w-md text-sm text-gray-500">
                                Try clearing filters or search, or create a new note for this encounter.
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {paginated.map((note) => (
                                <li key={note.id}>
                                    <article className="rounded-xl border border-emr-border/80 bg-white p-4 transition hover:border-primary/30 hover:shadow-sm dark:border-white/10 dark:bg-[#12100e]">
                                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-[15px]">
                                                        {note.notesType}
                                                    </h2>
                                                    <NoteStatusTag status={note.noteStatus} />
                                                </div>
                                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                                                    <span>{formatVisitDateDisplay(note.date)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                            {previewNoteText(note.notesText) || 'No note text.'}
                                        </p>

                                        <div className="flex flex-col gap-3 border-t border-emr-border/60 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                                                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                <span className="truncate">{note.assignedProvider?.name || 'Unknown'}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    className="notes-action-btn"
                                                    label={note.noteStatus === 'Marked in Error' ? 'View' : 'Open'}
                                                    icon={
                                                        note.noteStatus === 'Marked in Error' ? (
                                                            <Eye className="mr-1 h-3.5 w-3.5" />
                                                        ) : (
                                                            <FolderOpen className="mr-1 h-3.5 w-3.5" />
                                                        )
                                                    }
                                                    onClick={() => openNote(note.id)}
                                                    disabled={busyId === note.id}
                                                />
                                                {note.noteStatus !== 'Marked in Error' ? (
                                                    <Button
                                                        type="button"
                                                        size="small"
                                                        severity="warning"
                                                        outlined
                                                        className="notes-action-btn"
                                                        label="Mark in Error"
                                                        icon={<AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                                                        disabled={busyId === note.id}
                                                        onClick={() => openConfirm('markInError', note)}
                                                    />
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="small"
                                                        severity="success"
                                                        outlined
                                                        className="notes-action-btn"
                                                        label="Restore"
                                                        icon={<RotateCcw className="mr-1 h-3.5 w-3.5" />}
                                                        disabled={busyId === note.id}
                                                        onClick={() => openConfirm('restore', note)}
                                                    />
                                                )}
                                                {note.noteStatus !== 'Completed' ? (
                                                    <Button
                                                        type="button"
                                                        size="small"
                                                        severity="danger"
                                                        outlined
                                                        className="notes-action-btn"
                                                        label="Delete"
                                                        icon={<Trash2 className="mr-1 h-3.5 w-3.5" />}
                                                        disabled={busyId === note.id}
                                                        onClick={() => openConfirm('delete', note)}
                                                    />
                                                ) : null}
                                            </div>
                                        </div>

                                        {note.providerSigned ? (
                                            <p className="mt-3 text-xs text-gray-500">
                                                <strong>
                                                    Electronically signed by {note.providerSigned}
                                                    {note.signedDate ? ` on ${note.signedDate}` : ''}
                                                    {note.signedTime ? ` ${note.signedTime}` : ''}
                                                </strong>
                                            </p>
                                        ) : null}

                                        {note.noteStatus === 'Marked in Error' && note.inErrorReason ? (
                                            <div className="mt-2 rounded-md bg-danger/5 px-3 py-2 text-xs text-danger" role="status">
                                                Reason: {note.inErrorReason}
                                            </div>
                                        ) : null}
                                    </article>
                                </li>
                            ))}
                        </ul>
                    )}

                    {filteredNotes.length > 0 ? (
                        <div className="mt-4 border-t border-emr-border/70 pt-2 dark:border-white/10">
                            <Paginator
                                first={first}
                                rows={rowsPerPage}
                                totalRecords={filteredNotes.length}
                                rowsPerPageOptions={[5, 10, 20]}
                                onPageChange={onPageChange}
                                template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                                currentPageReportTemplate="Showing {first} to {last} of {totalRecords} notes"
                                className="!justify-between !bg-transparent !border-0 !px-0"
                            />
                        </div>
                    ) : null}
                </div>
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
