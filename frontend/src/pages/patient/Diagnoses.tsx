import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Ban, CheckCircle2, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { ActionIconTooltip } from '../../components/ui/ActionIconTooltip';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';
import {
    createPatientProblem,
    listPatientProblems,
    searchIcd10,
    updateProblem,
    type Icd10SearchHit,
    type PatientProblem,
    type ProblemChronicity,
    type ProblemStatus,
} from '../../services/problemsApi';
import {
    actionToStatus,
    availableActions,
    canEditProblem,
    filterProblemsBySearch,
    formatStatusLabel,
    sortProblemsClinicalOrder,
    statusBadgeClass,
    toDateInputValue,
    type ProblemAction,
} from './problemListHelpers';

type ListTab = 'active' | 'history';

function actionLabel(action: ProblemAction): string {
    switch (action) {
        case 'entered_in_error':
            return 'Entered in Error';
        case 'reactivate':
            return 'Make Active';
        case 'inactivate':
            return 'Make Inactive';
        case 'resolve':
            return 'Resolve';
    }
}

function actionSuccessMessage(action: ProblemAction, code: string): string {
    switch (action) {
        case 'entered_in_error':
            return `${code} marked as entered in error`;
        case 'resolve':
            return `${code} resolved successfully`;
        case 'inactivate':
            return `${code} inactivated successfully`;
        case 'reactivate':
            return `${code} reactivated successfully`;
    }
}

function ActionIcon({ action }: { action: ProblemAction }) {
    const cls = 'h-3.5 w-3.5';
    switch (action) {
        case 'resolve':
            return <CheckCircle2 className={cls} aria-hidden />;
        case 'inactivate':
            return <Ban className={cls} aria-hidden />;
        case 'reactivate':
            return <RotateCcw className={cls} aria-hidden />;
        case 'entered_in_error':
            return <XCircle className={cls} aria-hidden />;
    }
}

const iconBtnClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 disabled:opacity-40';

const ROWS_PER_PAGE = 10;

const Diagnoses: React.FC = () => {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();

    const [problems, setProblems] = useState<PatientProblem[]>([]);
    const [listTab, setListTab] = useState<ListTab>('active');
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [showAdd, setShowAdd] = useState(false);
    const [icdQuery, setIcdQuery] = useState('');
    const [icdHits, setIcdHits] = useState<Icd10SearchHit[]>([]);
    const [icdSearching, setIcdSearching] = useState(false);
    const [selectedCode, setSelectedCode] = useState<Icd10SearchHit | null>(null);
    const [chronicity, setChronicity] = useState<ProblemChronicity | ''>('');
    const [onsetDate, setOnsetDate] = useState('');
    const [saving, setSaving] = useState(false);

    const [editing, setEditing] = useState<PatientProblem | null>(null);
    const [editStatus, setEditStatus] = useState<ProblemStatus>('active');
    const [editChronicity, setEditChronicity] = useState<ProblemChronicity | ''>('');
    const [editOnsetDate, setEditOnsetDate] = useState('');
    const [editResolvedDate, setEditResolvedDate] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    const searchSeq = useRef(0);
    const abortRef = useRef<AbortController | null>(null);

    const formatDate = useCallback((dateString?: string | null): string => {
        if (!dateString?.trim()) return '—';
        try {
            const date = new Date(dateString.length <= 10 ? `${dateString}T00:00:00` : dateString);
            if (isNaN(date.getTime())) return dateString;
            return format(date, 'MM/dd/yyyy');
        } catch {
            return dateString;
        }
    }, []);

    const fetchProblems = useCallback(async () => {
        if (!patientId?.trim()) {
            setProblems([]);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const rows = await listPatientProblems(patientId, { includeResolved: true });
            setProblems(rows);
        } catch (e: unknown) {
            const msg =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to load problem list';
            setProblems([]);
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void fetchProblems();
    }, [fetchProblems]);

    useEffect(() => {
        if (!showAdd) return;
        const q = icdQuery.trim();
        if (q.length < 1) {
            setIcdHits([]);
            setIcdSearching(false);
            return;
        }
        const seq = ++searchSeq.current;
        const t = window.setTimeout(() => {
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;
            setIcdSearching(true);
            void searchIcd10(q, ac.signal)
                .then((hits) => {
                    if (seq !== searchSeq.current) return;
                    setIcdHits(hits);
                })
                .catch((err: unknown) => {
                    if (
                        (err as { name?: string })?.name === 'CanceledError' ||
                        (err as { code?: string })?.code === 'ERR_CANCELED'
                    ) {
                        return;
                    }
                    if (seq !== searchSeq.current) return;
                    setIcdHits([]);
                })
                .finally(() => {
                    if (seq === searchSeq.current) setIcdSearching(false);
                });
        }, 280);
        return () => window.clearTimeout(t);
    }, [icdQuery, showAdd]);

    const tabProblems = useMemo(() => {
        if (listTab === 'active') return problems.filter((p) => p.status === 'active');
        return problems.filter((p) => p.status === 'inactive' || p.status === 'resolved');
    }, [problems, listTab]);

    const filtered = useMemo(
        () => sortProblemsClinicalOrder(filterProblemsBySearch(tabProblems, searchText)),
        [tabProblems, searchText]
    );

    const activeCount = useMemo(() => problems.filter((p) => p.status === 'active').length, [problems]);
    const historyCount = useMemo(
        () => problems.filter((p) => p.status === 'inactive' || p.status === 'resolved').length,
        [problems]
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
    const paginated = useMemo(() => {
        const page = Math.min(currentPage, totalPages);
        const start = (page - 1) * ROWS_PER_PAGE;
        return filtered.slice(start, start + ROWS_PER_PAGE);
    }, [filtered, currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchText, patientId, listTab]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const resetAddForm = () => {
        setIcdQuery('');
        setIcdHits([]);
        setSelectedCode(null);
        setChronicity('');
        setOnsetDate('');
        setSaving(false);
    };

    const openAdd = () => {
        resetAddForm();
        setShowAdd(true);
    };

    const closeAdd = () => {
        abortRef.current?.abort();
        setShowAdd(false);
        resetAddForm();
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !selectedCode || saving) return;
        setSaving(true);
        try {
            await createPatientProblem(patientId, {
                icd10Code: selectedCode.code,
                chronicity: chronicity || null,
                onsetDate: onsetDate || null,
            });
            toast.success(`${selectedCode.code} added to problem list`);
            closeAdd();
            setListTab('active');
            await fetchProblems();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to add problem';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (problem: PatientProblem) => {
        setEditing(problem);
        setEditStatus(problem.status);
        setEditChronicity(problem.chronicity ?? '');
        setEditOnsetDate(toDateInputValue(problem.onsetDate));
        setEditResolvedDate(toDateInputValue(problem.resolvedDate));
        setEditSaving(false);
    };

    const closeEdit = () => {
        setEditing(null);
        setEditSaving(false);
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing || editSaving) return;
        setEditSaving(true);
        try {
            await updateProblem(editing.id, {
                status: editStatus,
                chronicity: editChronicity || null,
                onsetDate: editOnsetDate || null,
                resolvedDate: editStatus === 'resolved' ? editResolvedDate || null : null,
            });
            toast.success(`${editing.icd10Code} updated successfully`);
            closeEdit();
            if (editStatus === 'active') setListTab('active');
            else if (editStatus === 'inactive' || editStatus === 'resolved') setListTab('history');
            await fetchProblems();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to update problem';
            toast.error(msg);
        } finally {
            setEditSaving(false);
        }
    };

    const handleAction = async (problem: PatientProblem, action: ProblemAction) => {
        if (updatingId) return;
        setUpdatingId(problem.id);
        try {
            await updateProblem(problem.id, { status: actionToStatus(action) });
            toast.success(actionSuccessMessage(action, problem.icd10Code));
            await fetchProblems();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                `Failed to ${actionLabel(action).toLowerCase()} problem`;
            toast.error(msg);
        } finally {
            setUpdatingId(null);
        }
    };

    if (!patientId?.trim()) {
        return (
            <div className={`${moduleRootClass} facesheet-module-route-root`}>
                <p className="py-12 text-center text-gray-500 dark:text-gray-400">
                    Open this module from a patient facesheet to load the problem list.
                </p>
            </div>
        );
    }

    return (
        <div className={`${moduleRootClass} facesheet-module-route-root gap-3`}>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white sm:text-lg">
                        Problem List
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                        ICD-10-CM medical problems for this patient
                    </p>
                </div>
                <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                    onClick={openAdd}
                >
                    Add problem
                </button>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-lg border border-gray-200/80 bg-gray-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <button
                        type="button"
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            listTab === 'active'
                                ? 'bg-primary text-white'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                        }`}
                        onClick={() => setListTab('active')}
                    >
                        Active ({activeCount})
                    </button>
                    <button
                        type="button"
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            listTab === 'history'
                                ? 'bg-primary text-white'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                        }`}
                        onClick={() => setListTab('history')}
                    >
                        Inactive / Resolved ({historyCount})
                    </button>
                </div>
                <div className="relative w-full sm:max-w-md">
                    <input
                        type="text"
                        className="form-input h-9 w-full py-2 pl-10 text-sm"
                        placeholder="Search by code or description..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <IconSearch className="h-4 w-4" />
                    </span>
                </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200/70 bg-white dark:border-white/[0.08] dark:bg-[#1a1a1a]">
                <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/95 text-[10px] font-bold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400">
                            <tr>
                                <th className="whitespace-nowrap px-3 py-2.5">Code</th>
                                <th className="px-3 py-2.5">Description</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Type</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Onset date</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Date changed</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
                                            Loading problems...
                                        </span>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center">
                                        <p className="mb-3 text-danger">{error}</p>
                                        <button
                                            type="button"
                                            className="inline-flex h-8 items-center rounded-md border border-primary px-3 text-xs font-semibold text-primary"
                                            onClick={() => void fetchProblems()}
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                                        {tabProblems.length === 0
                                            ? listTab === 'active'
                                                ? 'No active problems. Add an ICD-10-CM problem to get started.'
                                                : 'No inactive or resolved problems yet.'
                                            : 'No problems match your search.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((p, idx) => (
                                    <tr
                                        key={p.id}
                                        className={`transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.04] ${
                                            idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-white/[0.02]' : ''
                                        }`}
                                    >
                                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-primary">
                                            {p.icd10Code}
                                        </td>
                                        <td className="max-w-[280px] px-3 py-2 text-gray-900 dark:text-gray-100">
                                            <span className="line-clamp-2" title={p.icd10Description}>
                                                {p.icd10Description}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                                            {p.chronicity || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {formatDate(p.onsetDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {formatDate(p.updatedAt || p.createdAt)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2">
                                            <span
                                                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                                            >
                                                {formatStatusLabel(p.status)}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2">
                                            <div className="flex items-center justify-center gap-0.5">
                                                {canEditProblem(p.status) ? (
                                                    <ActionIconTooltip label="Edit">
                                                        <button
                                                            type="button"
                                                            aria-label="Edit"
                                                            className={iconBtnClass}
                                                            onClick={() => openEdit(p)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                                                        </button>
                                                    </ActionIconTooltip>
                                                ) : null}
                                                {availableActions(p.status).map((action) => (
                                                    <ActionIconTooltip key={action} label={actionLabel(action)}>
                                                        <button
                                                            type="button"
                                                            aria-label={actionLabel(action)}
                                                            disabled={updatingId === p.id}
                                                            className={iconBtnClass}
                                                            onClick={() => void handleAction(p, action)}
                                                        >
                                                            <ActionIcon action={action} />
                                                        </button>
                                                    </ActionIconTooltip>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 ? (
                    <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200/80 px-3 py-2.5 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Showing {(Math.min(currentPage, totalPages) - 1) * ROWS_PER_PAGE + 1}–
                            {Math.min(Math.min(currentPage, totalPages) * ROWS_PER_PAGE, filtered.length)} of{' '}
                            {filtered.length}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <button
                                type="button"
                                className="inline-flex h-8 items-center rounded-md border border-primary px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-40"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <span className="px-2 text-sm text-gray-700 dark:text-gray-300">
                                Page {Math.min(currentPage, totalPages)} of {totalPages}
                            </span>
                            <button
                                type="button"
                                className="inline-flex h-8 items-center rounded-md border border-primary px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-40"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {editing ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
                    <div
                        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 dark:bg-[#0e1726] sm:max-w-lg sm:rounded-xl sm:p-6 sm:shadow-lg"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-problem-title"
                    >
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h4 id="edit-problem-title" className="text-lg font-semibold">
                                Update problem
                            </h4>
                            <button type="button" className="p-1.5" onClick={closeEdit} aria-label="Close">
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mb-4 rounded border border-white-light p-3 dark:border-[#191e3a]">
                            <div className="font-semibold text-primary">{editing.icd10Code}</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">{editing.icd10Description}</div>
                            <p className="mt-1 text-xs text-gray-500">
                                ICD-10 code cannot be changed. Use Entered in Error and add a new problem if needed.
                            </p>
                        </div>
                        <form onSubmit={(e) => void handleEditSave(e)} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Status</label>
                                    <select
                                        className="form-select w-full"
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value as ProblemStatus)}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="entered_in_error">Entered in error</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Chronicity</label>
                                    <select
                                        className="form-select w-full"
                                        value={editChronicity}
                                        onChange={(e) => setEditChronicity(e.target.value as ProblemChronicity | '')}
                                    >
                                        <option value="">Unspecified</option>
                                        <option value="acute">Acute</option>
                                        <option value="chronic">Chronic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Onset date</label>
                                    <input
                                        type="date"
                                        className="form-input w-full"
                                        value={editOnsetDate}
                                        onChange={(e) => setEditOnsetDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Resolved date</label>
                                    <input
                                        type="date"
                                        className="form-input w-full"
                                        value={editResolvedDate}
                                        onChange={(e) => setEditResolvedDate(e.target.value)}
                                        disabled={editStatus !== 'resolved'}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-primary px-3.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                                    onClick={closeEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    disabled={editSaving}
                                >
                                    {editSaving ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showAdd ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
                    <div
                        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 dark:bg-[#0e1726] sm:max-w-lg sm:rounded-xl sm:p-6 sm:shadow-lg"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-problem-title"
                    >
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h4 id="add-problem-title" className="text-lg font-semibold">
                                Add problem
                            </h4>
                            <button type="button" className="p-1.5" onClick={closeAdd} aria-label="Close">
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">ICD-10-CM code</label>
                                {selectedCode ? (
                                    <div className="flex items-start justify-between gap-2 rounded border border-white-light p-3 dark:border-[#191e3a]">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-primary">{selectedCode.code}</div>
                                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                                {selectedCode.description}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="inline-flex h-8 items-center rounded-md border border-danger px-2 text-xs font-semibold text-danger"
                                            onClick={() => setSelectedCode(null)}
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            className="form-input w-full"
                                            placeholder="Search code or description..."
                                            value={icdQuery}
                                            onChange={(e) => setIcdQuery(e.target.value)}
                                            autoComplete="off"
                                        />
                                        {icdSearching ? (
                                            <p className="mt-2 text-xs text-gray-500">Searching...</p>
                                        ) : null}
                                        {icdHits.length > 0 ? (
                                            <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-white-light dark:border-[#191e3a]">
                                                {icdHits.map((hit) => (
                                                    <li key={hit.code}>
                                                        <button
                                                            type="button"
                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
                                                            onClick={() => {
                                                                setSelectedCode(hit);
                                                                setIcdQuery('');
                                                                setIcdHits([]);
                                                            }}
                                                        >
                                                            <span className="font-medium text-primary">{hit.code}</span>
                                                            <span className="ml-2 text-gray-700 dark:text-gray-300">
                                                                {hit.description}
                                                            </span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : icdQuery.trim() && !icdSearching ? (
                                            <p className="mt-2 text-xs text-gray-500">No matching codes</p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Chronicity</label>
                                    <select
                                        className="form-select w-full"
                                        value={chronicity}
                                        onChange={(e) => setChronicity(e.target.value as ProblemChronicity | '')}
                                    >
                                        <option value="">Unspecified</option>
                                        <option value="acute">Acute</option>
                                        <option value="chronic">Chronic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Onset date</label>
                                    <input
                                        type="date"
                                        className="form-input w-full"
                                        value={onsetDate}
                                        onChange={(e) => setOnsetDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-primary px-3.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                                    onClick={closeAdd}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    disabled={!selectedCode || saving}
                                >
                                    {saving ? 'Saving...' : 'Save problem'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Diagnoses;
