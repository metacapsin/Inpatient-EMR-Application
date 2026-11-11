import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Ban, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { ActionIconTooltip } from '../../components/ui/ActionIconTooltip';
import { ConfirmDialog, type ConfirmVariant } from '../../components/shared/ConfirmDialog';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';
import { DrugTypeahead, type DrugSelection } from '../../components/cds/DrugTypeahead';
import { ALLERGY_CLASSES, type AllergyClass } from '../../types/cds';
import {
    ALLERGY_CATEGORIES,
    ALLERGY_RECORD_TYPES,
    CLINICAL_STATUSES,
    CRITICALITIES,
    EXPOSURE_ROUTES,
    REACTION_OPTIONS,
    REACTION_SEVERITIES,
    REPORTED_BY_OPTIONS,
    VERIFICATION_STATUSES,
    type AllergyCategory,
    type AllergyClinicalStatus,
    type AllergyCriticality,
    type AllergyRecordType,
    type AllergyVerificationStatus,
    type ExposureRoute,
    type ReactionSeverity,
    type ReportedBy,
} from '../../types/allergies';

const iconBtnClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 disabled:opacity-40';

interface AllergyRecord {
    _id: string;
    allergyName?: string;
    allergyType?: string;
    recordType?: string;
    severity?: string;
    criticality?: string;
    reaction?: string;
    clinicalStatus?: string;
    verificationStatus?: string;
    onsetDate?: string;
    lastOccurrenceDate?: string;
    exposureRoute?: string;
    reportedBy?: string;
    clinicalNotes?: string;
    rxnormCode?: string;
    allergyClass?: string;
}

const EMPTY_DRUG: DrugSelection = { name: '', rxnormCode: null };
const ROWS_PER_PAGE = 10;
type ListTab = 'active' | 'history';

function formatDate(dateString?: string | null): string {
    if (!dateString?.trim()) return '—';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return format(d, 'MM/dd/yyyy');
    } catch {
        return dateString;
    }
}

function clinicalBadgeClass(status?: string): string {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'inactive':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'resolved':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        default:
            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
}

const Allergies: React.FC = () => {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const [allergies, setAllergies] = useState<AllergyRecord[]>([]);
    const [searchText, setSearchText] = useState('');
    const [listTab, setListTab] = useState<ListTab>('active');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [showAdd, setShowAdd] = useState(false);
    const [drug, setDrug] = useState<DrugSelection>(EMPTY_DRUG);
    const [allergyType, setAllergyType] = useState<AllergyCategory>('Drug');
    const [recordType, setRecordType] = useState<AllergyRecordType>('allergy');
    const [allergyClass, setAllergyClass] = useState<AllergyClass | ''>('');
    const [reactions, setReactions] = useState<string[]>([]);
    const [severity, setSeverity] = useState<ReactionSeverity | ''>('');
    const [criticality, setCriticality] = useState<AllergyCriticality | ''>('');
    const [clinicalStatus, setClinicalStatus] = useState<AllergyClinicalStatus>('active');
    const [verificationStatus, setVerificationStatus] = useState<AllergyVerificationStatus>('unconfirmed');
    const [onsetDate, setOnsetDate] = useState('');
    const [lastOccurrenceDate, setLastOccurrenceDate] = useState('');
    const [exposureRoute, setExposureRoute] = useState<ExposureRoute | ''>('');
    const [reportedBy, setReportedBy] = useState<ReportedBy | ''>('');
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        detail?: string;
        confirmLabel: string;
        variant: ConfirmVariant;
        action: 'delete' | 'inactive' | 'resolved' | 'reactivate';
        allergy: AllergyRecord | null;
    }>({
        open: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        variant: 'danger',
        action: 'delete',
        allergy: null,
    });

    const closeConfirm = () =>
        setConfirm((c) => ({ ...c, open: false, allergy: null }));

    const fetchAllergies = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError('');
        try {
            const response = await patientDataAPI.getAllAllergyList(patientId);
            const data = response.data?.data || response.data;
            if (!Array.isArray(data)) {
                setAllergies([]);
                return;
            }
            setAllergies(
                data.map((item: any) => ({
                    _id: item._id || item.id,
                    allergyName: item.allergyName || '',
                    allergyType: item.allergyType || 'Drug',
                    recordType: item.recordType || 'allergy',
                    reaction: item.reaction || '',
                    severity: item.severity || '',
                    criticality: item.criticality || '',
                    clinicalStatus:
                        item.clinicalStatus ||
                        (item.status === true || item.status === 'Active' ? 'active' : item.status === false ? 'inactive' : 'active'),
                    verificationStatus: item.verificationStatus || 'unconfirmed',
                    onsetDate: item.onsetDate || '',
                    lastOccurrenceDate: item.lastOccurrenceDate || '',
                    exposureRoute: item.exposureRoute || '',
                    reportedBy: item.reportedBy || '',
                    clinicalNotes: item.clinicalNotes || '',
                    rxnormCode: item.rxnormCode || '',
                    allergyClass: item.allergyClass || '',
                })),
            );
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch allergies');
            toast.error(err.response?.data?.message || 'Failed to fetch allergies');
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void fetchAllergies();
    }, [fetchAllergies]);

    const tabAllergies = useMemo(() => {
        if (listTab === 'active') return allergies.filter((a) => a.clinicalStatus === 'active');
        return allergies.filter((a) => a.clinicalStatus !== 'active');
    }, [allergies, listTab]);

    const activeCount = useMemo(() => allergies.filter((a) => a.clinicalStatus === 'active').length, [allergies]);
    const historyCount = allergies.length - activeCount;

    const filtered = useMemo(() => {
        const q = searchText.toLowerCase().trim();
        if (!q) return tabAllergies;
        return tabAllergies.filter((item) => {
            const hit = (v?: string) => v?.toLowerCase().includes(q);
            return (
                hit(item.allergyName) ||
                hit(item.allergyType) ||
                hit(item.recordType) ||
                hit(item.reaction) ||
                hit(item.severity) ||
                hit(item.clinicalStatus) ||
                hit(item.verificationStatus) ||
                hit(item.rxnormCode) ||
                hit(item.allergyClass) ||
                hit(item.clinicalNotes)
            );
        });
    }, [tabAllergies, searchText]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
    const paginated = useMemo(() => {
        const page = Math.min(currentPage, totalPages);
        const start = (page - 1) * ROWS_PER_PAGE;
        return filtered.slice(start, start + ROWS_PER_PAGE);
    }, [filtered, currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchText, listTab, patientId]);

    const resetAddForm = () => {
        setDrug(EMPTY_DRUG);
        setAllergyType('Drug');
        setRecordType('allergy');
        setAllergyClass('');
        setReactions([]);
        setSeverity('');
        setCriticality('');
        setClinicalStatus('active');
        setVerificationStatus('unconfirmed');
        setOnsetDate('');
        setLastOccurrenceDate('');
        setExposureRoute('');
        setReportedBy('');
        setClinicalNotes('');
        setFormError('');
        setSaving(false);
    };

    const openAdd = () => {
        resetAddForm();
        setShowAdd(true);
    };

    const closeAdd = () => {
        setShowAdd(false);
        resetAddForm();
    };

    const toggleReaction = (value: string) => {
        setReactions((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || saving) return;
        const name = drug.name.trim();
        if (!name) {
            setFormError('Select or enter an allergen.');
            return;
        }
        setFormError('');
        setSaving(true);
        try {
            await patientDataAPI.createAllergy({
                patientId,
                allergyName: name,
                allergyType,
                recordType,
                allergyClass: allergyClass || null,
                reaction: reactions.length ? reactions.join(', ') : null,
                severity: severity || null,
                criticality: criticality || null,
                clinicalStatus,
                verificationStatus,
                onsetDate: onsetDate || null,
                lastOccurrenceDate: lastOccurrenceDate || null,
                exposureRoute: exposureRoute || null,
                reportedBy: reportedBy || null,
                clinicalNotes: clinicalNotes.trim() || null,
                rxnormCode: drug.rxnormCode || null,
            });
            toast.success('Allergy added successfully');
            closeAdd();
            if (clinicalStatus === 'active') setListTab('active');
            else setListTab('history');
            await fetchAllergies();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to add allergy';
            setFormError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const buildUpdatePayload = (a: AllergyRecord, nextStatus: AllergyClinicalStatus) => ({
        allergyName: a.allergyName || 'Unknown',
        allergyType: (a.allergyType as AllergyCategory) || 'Drug',
        recordType: (a.recordType as AllergyRecordType) || 'allergy',
        reaction: a.reaction || null,
        severity: (a.severity as ReactionSeverity) || null,
        criticality: (a.criticality as AllergyCriticality) || null,
        clinicalStatus: nextStatus,
        verificationStatus: (a.verificationStatus as AllergyVerificationStatus) || 'unconfirmed',
        onsetDate: a.onsetDate || null,
        lastOccurrenceDate: a.lastOccurrenceDate || null,
        exposureRoute: (a.exposureRoute as ExposureRoute) || null,
        reportedBy: (a.reportedBy as ReportedBy) || null,
        clinicalNotes: a.clinicalNotes || null,
        rxnormCode: a.rxnormCode || null,
        allergyClass: a.allergyClass || null,
    });

    const askStatus = (a: AllergyRecord, nextStatus: AllergyClinicalStatus) => {
        if (nextStatus === 'inactive') {
            setConfirm({
                open: true,
                title: 'Mark allergy inactive',
                message: 'Inactive allergies stay in the chart history and no longer drive active CDS allergy checks.',
                detail: a.allergyName || 'Allergy record',
                confirmLabel: 'Mark inactive',
                variant: 'warning',
                action: 'inactive',
                allergy: a,
            });
            return;
        }
        if (nextStatus === 'resolved') {
            setConfirm({
                open: true,
                title: 'Mark allergy resolved',
                message: 'Resolved allergies remain in history for clinical review and audit.',
                detail: a.allergyName || 'Allergy record',
                confirmLabel: 'Mark resolved',
                variant: 'primary',
                action: 'resolved',
                allergy: a,
            });
            return;
        }
        setConfirm({
            open: true,
            title: 'Reactivate allergy',
            message: 'This allergy will return to the active list and may trigger clinical alerts again.',
            detail: a.allergyName || 'Allergy record',
            confirmLabel: 'Reactivate',
            variant: 'primary',
            action: 'reactivate',
            allergy: a,
        });
    };

    const askDelete = (a: AllergyRecord) => {
        setConfirm({
            open: true,
            title: 'Delete allergy',
            message: 'This permanently removes the allergy from the patient chart. This cannot be undone.',
            detail: a.allergyName || 'Allergy record',
            confirmLabel: 'Delete allergy',
            variant: 'danger',
            action: 'delete',
            allergy: a,
        });
    };

    const runConfirm = async () => {
        const a = confirm.allergy;
        if (!a || updatingId) return;
        setUpdatingId(a._id);
        try {
            if (confirm.action === 'delete') {
                await patientDataAPI.deleteAllergy(a._id);
                toast.success('Allergy deleted');
            } else {
                const nextStatus: AllergyClinicalStatus =
                    confirm.action === 'inactive' ? 'inactive' : confirm.action === 'resolved' ? 'resolved' : 'active';
                await patientDataAPI.updateAllergy(a._id, buildUpdatePayload(a, nextStatus));
                toast.success(
                    nextStatus === 'active'
                        ? 'Allergy reactivated'
                        : nextStatus === 'resolved'
                          ? 'Allergy marked resolved'
                          : 'Allergy marked inactive',
                );
                if (nextStatus === 'active') setListTab('active');
                else setListTab('history');
            }
            closeConfirm();
            await fetchAllergies();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setUpdatingId(null);
        }
    };

    if (!patientId?.trim()) {
        return (
            <div className={`${moduleRootClass} facesheet-module-route-root`}>
                <p className="py-12 text-center text-gray-500 dark:text-gray-400">
                    Open this module from a patient facesheet to load allergies.
                </p>
            </div>
        );
    }

    return (
        <div className={`${moduleRootClass} facesheet-module-route-root gap-3`}>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white sm:text-lg">
                        Allergies
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                        Drug and substance allergies for this patient
                    </p>
                </div>
                <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                    onClick={openAdd}
                >
                    Add Allergy
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
                        placeholder="Search allergen, reaction, class..."
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
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/95 text-[10px] font-bold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400">
                            <tr>
                                <th className="px-3 py-2.5">Allergen</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Category</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Type</th>
                                <th className="px-3 py-2.5">Reaction</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Severity</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Class</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Onset</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Verification</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-gray-500">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
                                            Loading allergies...
                                        </span>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center">
                                        <p className="mb-3 text-danger">{error}</p>
                                        <button
                                            type="button"
                                            className="inline-flex h-8 items-center rounded-md border border-primary px-3 text-xs font-semibold text-primary"
                                            onClick={() => void fetchAllergies()}
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                                        {tabAllergies.length === 0
                                            ? listTab === 'active'
                                                ? 'No active allergies. Add an allergy to get started.'
                                                : 'No inactive or resolved allergies yet.'
                                            : 'No allergies match your search.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((a, idx) => (
                                    <tr
                                        key={a._id}
                                        className={`transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.04] ${
                                            idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-white/[0.02]' : ''
                                        }`}
                                    >
                                        <td className="max-w-[220px] px-3 py-2">
                                            <div className="font-semibold text-gray-900 dark:text-gray-100">{a.allergyName || '—'}</div>
                                            {a.rxnormCode ? (
                                                <div className="font-mono text-[11px] text-gray-500">RxNorm {a.rxnormCode}</div>
                                            ) : null}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {a.allergyType || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                                            {a.recordType || '—'}
                                        </td>
                                        <td className="max-w-[200px] px-3 py-2 text-gray-600 dark:text-gray-300">
                                            <span className="line-clamp-2" title={a.reaction}>
                                                {a.reaction || '—'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {a.severity || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {a.allergyClass || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {formatDate(a.onsetDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2">
                                            <span
                                                className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${clinicalBadgeClass(a.clinicalStatus)}`}
                                            >
                                                {a.clinicalStatus || '—'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                                            {a.verificationStatus || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2">
                                            <div className="flex items-center justify-center gap-0.5">
                                                {a.clinicalStatus === 'active' ? (
                                                    <>
                                                        <ActionIconTooltip label="Mark inactive">
                                                            <button
                                                                type="button"
                                                                aria-label="Mark inactive"
                                                                className={iconBtnClass}
                                                                disabled={updatingId === a._id}
                                                                onClick={() => askStatus(a, 'inactive')}
                                                            >
                                                                <Ban className="h-3.5 w-3.5" aria-hidden />
                                                            </button>
                                                        </ActionIconTooltip>
                                                        <ActionIconTooltip label="Mark resolved">
                                                            <button
                                                                type="button"
                                                                aria-label="Mark resolved"
                                                                className={iconBtnClass}
                                                                disabled={updatingId === a._id}
                                                                onClick={() => askStatus(a, 'resolved')}
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                                            </button>
                                                        </ActionIconTooltip>
                                                    </>
                                                ) : (
                                                    <ActionIconTooltip label="Reactivate">
                                                        <button
                                                            type="button"
                                                            aria-label="Reactivate"
                                                            className={iconBtnClass}
                                                            disabled={updatingId === a._id}
                                                            onClick={() => askStatus(a, 'active')}
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                                                        </button>
                                                    </ActionIconTooltip>
                                                )}
                                                <ActionIconTooltip label="Delete">
                                                    <button
                                                        type="button"
                                                        aria-label="Delete"
                                                        className={iconBtnClass}
                                                        disabled={updatingId === a._id}
                                                        onClick={() => askDelete(a)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                    </button>
                                                </ActionIconTooltip>
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
                            {Math.min(Math.min(currentPage, totalPages) * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
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

            {showAdd ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
                    <div
                        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 dark:bg-[#0e1726] sm:max-w-2xl sm:rounded-xl sm:p-6 sm:shadow-lg"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-allergy-title"
                    >
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h4 id="add-allergy-title" className="text-lg font-semibold">
                                Add Allergy
                            </h4>
                            <button type="button" className="p-1.5" onClick={closeAdd} aria-label="Close" disabled={saving}>
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
                            <div>
                                <label htmlFor="allergy-drug" className="mb-1 block text-sm font-medium">
                                    Allergen / Substance
                                </label>
                                <DrugTypeahead
                                    id="allergy-drug"
                                    value={drug}
                                    onChange={setDrug}
                                    disabled={saving}
                                    placeholder="Search medication…"
                                    size="md"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Allergy Category</label>
                                    <select
                                        className="form-select w-full"
                                        value={allergyType}
                                        onChange={(e) => setAllergyType(e.target.value as AllergyCategory)}
                                        disabled={saving}
                                    >
                                        {ALLERGY_CATEGORIES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Allergy Type</label>
                                    <select
                                        className="form-select w-full"
                                        value={recordType}
                                        onChange={(e) => setRecordType(e.target.value as AllergyRecordType)}
                                        disabled={saving}
                                    >
                                        {ALLERGY_RECORD_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Allergy Class</label>
                                    <select
                                        className="form-select w-full"
                                        value={allergyClass}
                                        onChange={(e) => setAllergyClass(e.target.value as AllergyClass | '')}
                                        disabled={saving}
                                    >
                                        <option value="">Select class…</option>
                                        {ALLERGY_CLASSES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Reaction Severity</label>
                                    <select
                                        className="form-select w-full"
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value as ReactionSeverity | '')}
                                        disabled={saving}
                                    >
                                        <option value="">Select…</option>
                                        {REACTION_SEVERITIES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Criticality</label>
                                    <select
                                        className="form-select w-full"
                                        value={criticality}
                                        onChange={(e) => setCriticality(e.target.value as AllergyCriticality | '')}
                                        disabled={saving}
                                    >
                                        <option value="">Select…</option>
                                        {CRITICALITIES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Clinical Status</label>
                                    <select
                                        className="form-select w-full"
                                        value={clinicalStatus}
                                        onChange={(e) => setClinicalStatus(e.target.value as AllergyClinicalStatus)}
                                        disabled={saving}
                                    >
                                        {CLINICAL_STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Verification Status</label>
                                    <select
                                        className="form-select w-full"
                                        value={verificationStatus}
                                        onChange={(e) => setVerificationStatus(e.target.value as AllergyVerificationStatus)}
                                        disabled={saving}
                                    >
                                        {VERIFICATION_STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Exposure Route</label>
                                    <select
                                        className="form-select w-full"
                                        value={exposureRoute}
                                        onChange={(e) => setExposureRoute(e.target.value as ExposureRoute | '')}
                                        disabled={saving}
                                    >
                                        <option value="">Select…</option>
                                        {EXPOSURE_ROUTES.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Reported By</label>
                                    <select
                                        className="form-select w-full"
                                        value={reportedBy}
                                        onChange={(e) => setReportedBy(e.target.value as ReportedBy | '')}
                                        disabled={saving}
                                    >
                                        <option value="">Select…</option>
                                        {REPORTED_BY_OPTIONS.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Onset Date</label>
                                    <input
                                        type="date"
                                        className="form-input w-full"
                                        value={onsetDate}
                                        onChange={(e) => setOnsetDate(e.target.value)}
                                        disabled={saving}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Last Occurrence Date</label>
                                    <input
                                        type="date"
                                        className="form-input w-full"
                                        value={lastOccurrenceDate}
                                        onChange={(e) => setLastOccurrenceDate(e.target.value)}
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            <div>
                                <span className="mb-2 block text-sm font-medium">Reaction / Manifestation</span>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {REACTION_OPTIONS.map((r) => (
                                        <label key={r} className="inline-flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={reactions.includes(r)}
                                                onChange={() => toggleReaction(r)}
                                                disabled={saving}
                                            />
                                            {r}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Clinical Notes</label>
                                <textarea
                                    className="form-textarea w-full"
                                    rows={3}
                                    value={clinicalNotes}
                                    onChange={(e) => setClinicalNotes(e.target.value)}
                                    disabled={saving}
                                    placeholder="Additional clinical notes"
                                />
                            </div>

                            {formError ? (
                                <p className="text-sm text-danger" role="alert">
                                    {formError}
                                </p>
                            ) : null}

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-primary px-3.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                                    onClick={closeAdd}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    disabled={saving || !drug.name.trim()}
                                >
                                    {saving ? 'Saving...' : 'Save Allergy'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                detail={confirm.detail}
                confirmLabel={confirm.confirmLabel}
                variant={confirm.variant}
                busy={Boolean(updatingId && confirm.allergy && updatingId === confirm.allergy._id)}
                onCancel={closeConfirm}
                onConfirm={() => void runConfirm()}
            />
        </div>
    );
};

export default Allergies;
