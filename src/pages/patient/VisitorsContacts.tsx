import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FaUser, FaClipboardList, FaPlus, FaTimes } from '../../lib/fa-icons';
import { Pencil, Trash2, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { usePatientId } from '../../hooks/usePatientId';
import type { ContactRoleUi, FamilyContactRecord, VisitorRecord, VisitorStatusUi } from '../../services/visitorsFamily.service';
import {
    createFamilyContactForPatient,
    createVisitorForPatient,
    deleteFamilyContactRecord,
    deleteVisitorRecord,
    fetchFamilyContactsForPatient,
    fetchVisitorsForPatient,
    updateFamilyContactRecord,
    updateVisitorRecord,
} from '../../services/visitorsFamily.service';

// Confirmation Dialog Component
const ConfirmationDialog = ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
    isDeleting,
}: {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting?: boolean;
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm">
            <div className="relative mx-auto w-full max-w-md animate-fadeIn p-4">
                <div className="relative rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                        </div>
                        <button
                            onClick={onCancel}
                            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700 dark:hover:bg-red-800"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Pagination Component
const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
}) => {
    if (totalPages <= 1) return null;

    const from = (currentPage - 1) * itemsPerPage + 1;
    const to = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>
                –<span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">{totalItems}</span>
            </p>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    title="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[5.5rem] text-center text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} / {totalPages}
                </span>
                <button
                    type="button"
                    title="Next page"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

function toDatetimeLocalValue(iso: string): string {
    if (!iso?.trim()) return '';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return iso.slice(0, 16);
    }
}

const statusBadge: Record<VisitorStatusUi, string> = {
    'checked-in': 'bg-success/10 text-success',
    'checked-out': 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
    scheduled: 'bg-primary/10 text-primary',
};

const statusLabel: Record<VisitorStatusUi, string> = {
    'checked-in': 'Checked In',
    'checked-out': 'Checked Out',
    scheduled: 'Scheduled',
};

function fmt(iso: string) {
    try {
        return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return iso;
    }
}

const EMPTY_VISITOR: Omit<VisitorRecord, 'id'> = {
    name: '',
    relationship: '',
    checkIn: '',
    status: 'scheduled',
    restrictions: '',
};

function VisitorModal({
    initial,
    onSave,
    onClose,
    saving,
}: {
    initial?: VisitorRecord;
    onSave: (v: Omit<VisitorRecord, 'id'>) => void;
    onClose: () => void;
    saving: boolean;
}) {
    const [form, setForm] = useState<Omit<VisitorRecord, 'id'>>(() =>
        initial
            ? {
                  ...initial,
                  checkIn: toDatetimeLocalValue(initial.checkIn),
                  checkOut: initial.checkOut ? toDatetimeLocalValue(initial.checkOut) : undefined,
              }
            : { ...EMPTY_VISITOR }
    );
    const set = (k: keyof Omit<VisitorRecord, 'id'>, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const valid = form.name.trim() && form.relationship.trim() && form.checkIn.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-[#0e1726]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between rounded-t-lg bg-primary p-4 text-white">
                    <h5 className="font-semibold">{initial ? 'Edit Visitor' : 'Add Visitor'}</h5>
                    <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-white/20">
                        <FaTimes />
                    </button>
                </div>
                <div className="space-y-4 p-5">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Visitor Name *</label>
                        <input className="form-input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Relationship *</label>
                        <input
                            className="form-input w-full"
                            value={form.relationship}
                            onChange={(e) => set('relationship', e.target.value)}
                            placeholder="e.g. Spouse, Parent"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Check-in *</label>
                            <input type="datetime-local" className="form-input w-full" value={form.checkIn} onChange={(e) => set('checkIn', e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Check-out</label>
                            <input
                                type="datetime-local"
                                className="form-input w-full"
                                value={form.checkOut ?? ''}
                                onChange={(e) => set('checkOut', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Status</label>
                        <select className="form-select w-full" value={form.status} onChange={(e) => set('status', e.target.value as VisitorStatusUi)}>
                            <option value="scheduled">Scheduled</option>
                            <option value="checked-in">Checked In</option>
                            <option value="checked-out">Checked Out</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Restrictions / Notes</label>
                        <input
                            className="form-input w-full"
                            value={form.restrictions ?? ''}
                            onChange={(e) => set('restrictions', e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-white-light p-4 dark:border-[#191e3a]">
                    <button type="button" className="btn btn-outline-primary" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" disabled={!valid || saving} onClick={() => onSave(form)}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const EMPTY_CONTACT: Omit<FamilyContactRecord, 'id'> = {
    name: '',
    relationship: '',
    role: 'Family',
    phone: '',
    email: '',
    isNOK: false,
};

function ContactModal({
    initial,
    onSave,
    onClose,
    saving,
}: {
    initial?: FamilyContactRecord;
    onSave: (c: Omit<FamilyContactRecord, 'id'>) => void;
    onClose: () => void;
    saving: boolean;
}) {
    const [form, setForm] = useState<Omit<FamilyContactRecord, 'id'>>(initial ? { ...initial } : { ...EMPTY_CONTACT });
    const set = (k: keyof Omit<FamilyContactRecord, 'id'>, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

    const valid = form.name.trim() && form.phone.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-[#0e1726]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between rounded-t-lg bg-primary p-4 text-white">
                    <h5 className="font-semibold">{initial ? 'Edit Contact' : 'Add Contact'}</h5>
                    <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-white/20">
                        <FaTimes />
                    </button>
                </div>
                <div className="space-y-4 p-5">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name *</label>
                        <input className="form-input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Relationship</label>
                            <input
                                className="form-input w-full"
                                value={form.relationship}
                                onChange={(e) => set('relationship', e.target.value)}
                                placeholder="e.g. Spouse"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Role</label>
                            <select className="form-select w-full" value={form.role} onChange={(e) => set('role', e.target.value as ContactRoleUi)}>
                                {(['Next of Kin', 'Guardian', 'Emergency Contact', 'Family', 'Other'] as ContactRoleUi[]).map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Phone *</label>
                        <input className="form-input w-full" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone number" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
                        <input type="email" className="form-input w-full" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="Optional" />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" className="form-checkbox" checked={form.isNOK} onChange={(e) => set('isNOK', e.target.checked)} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Next of Kin (NOK)</span>
                    </label>
                </div>
                <div className="flex justify-end gap-3 border-t border-white-light p-4 dark:border-[#191e3a]">
                    <button type="button" className="btn btn-outline-primary" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" disabled={!valid || saving} onClick={() => onSave(form)}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const VisitorsContacts: React.FC = () => {
    const { moduleRootClass } = useFacesheetChartLayout();
    const patientId = usePatientId();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'visitors' | 'contacts'>('visitors');
    const [visitorModal, setVisitorModal] = useState<{ open: boolean; editing?: VisitorRecord }>({ open: false });
    const [contactModal, setContactModal] = useState<{ open: boolean; editing?: FamilyContactRecord }>({ open: false });
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    // Pagination states
    const [visitorPage, setVisitorPage] = useState(1);
    const [contactPage, setContactPage] = useState(1);
    const itemsPerPage = 5;

    const visitorsQuery = useQuery({
        queryKey: ['inpatient', 'visitors', patientId],
        queryFn: () => fetchVisitorsForPatient(patientId!),
        enabled: Boolean(patientId?.trim()),
    });

    const contactsQuery = useQuery({
        queryKey: ['inpatient', 'family-contacts', patientId],
        queryFn: () => fetchFamilyContactsForPatient(patientId!),
        enabled: Boolean(patientId?.trim()),
    });

    const invalidateVisitors = () => void queryClient.invalidateQueries({ queryKey: ['inpatient', 'visitors', patientId] });
    const invalidateContacts = () => void queryClient.invalidateQueries({ queryKey: ['inpatient', 'family-contacts', patientId] });

    const saveVisitorMut = useMutation({
        mutationFn: async (payload: { editing?: VisitorRecord; data: Omit<VisitorRecord, 'id'> }) => {
            if (!patientId?.trim()) throw new Error('No patient selected.');
            if (payload.editing) {
                await updateVisitorRecord(payload.editing.id, patientId, payload.data);
            } else {
                await createVisitorForPatient(patientId, payload.data);
            }
        },
        onSuccess: () => {
            toast.success('Visitor saved');
            setVisitorModal({ open: false });
            invalidateVisitors();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
    });

    const deleteVisitorMut = useMutation({
        mutationFn: (id: string) => deleteVisitorRecord(id),
        onSuccess: () => {
            toast.success('Visitor removed');
            invalidateVisitors();
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
    });

    const saveContactMut = useMutation({
        mutationFn: async (payload: { editing?: FamilyContactRecord; data: Omit<FamilyContactRecord, 'id'> }) => {
            if (!patientId?.trim()) throw new Error('No patient selected.');
            if (payload.editing) {
                await updateFamilyContactRecord(payload.editing.id, patientId, payload.data);
            } else {
                await createFamilyContactForPatient(patientId, payload.data);
            }
        },
        onSuccess: () => {
            toast.success('Contact saved');
            setContactModal({ open: false });
            invalidateContacts();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
    });

    const deleteContactMut = useMutation({
        mutationFn: (id: string) => deleteFamilyContactRecord(id),
        onSuccess: () => {
            toast.success('Contact removed');
            invalidateContacts();
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
    });

    const visitors = visitorsQuery.data ?? [];
    const contacts = contactsQuery.data ?? [];
    const nok = contacts.find((c) => c.isNOK);
    const listError = visitorsQuery.error ?? contactsQuery.error;
    const listErrorMessage = listError instanceof Error ? listError.message : listError ? 'Failed to load data' : null;

    // Pagination calculations
    const visitorTotalPages = Math.ceil(visitors.length / itemsPerPage);
    const visitorStartIndex = (visitorPage - 1) * itemsPerPage;
    const visitorEndIndex = visitorStartIndex + itemsPerPage;
    const paginatedVisitors = visitors.slice(visitorStartIndex, visitorEndIndex);

    const contactTotalPages = Math.ceil(contacts.length / itemsPerPage);
    const contactStartIndex = (contactPage - 1) * itemsPerPage;
    const contactEndIndex = contactStartIndex + itemsPerPage;
    const paginatedContacts = contacts.slice(contactStartIndex, contactEndIndex);

    const handleDeleteVisitor = (visitor: VisitorRecord) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Visitor',
            message: `Are you sure you want to delete visitor "${visitor.name}"? This action cannot be undone.`,
            onConfirm: () => deleteVisitorMut.mutate(visitor.id),
        });
    };

    const handleDeleteContact = (contact: FamilyContactRecord) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Contact',
            message: `Are you sure you want to delete contact "${contact.name}"? This action cannot be undone.`,
            onConfirm: () => deleteContactMut.mutate(contact.id),
        });
    };

    return (
        <div className={moduleRootClass}>
            <div className="mb-5">
                <ul className="flex items-center gap-2 text-sm">
                    <li>
                        <Link to="/app/patients/list" className="text-primary hover:underline">
                            Patient List
                        </Link>
                    </li>
                    <li>/</li>
                    <li className="font-medium text-gray-900 dark:text-white">Visitors & Contacts</li>
                </ul>
            </div>

            {!patientId?.trim() ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                    Open a patient facesheet to load and manage visitors and family contacts for that chart.
                </div>
            ) : null}

            {patientId?.trim() && listErrorMessage ? (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
                    {listErrorMessage}
                </div>
            ) : null}

            {nok ? (
                <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                    <span className="font-semibold text-primary">NOK:</span>
                    <span className="text-gray-800 dark:text-gray-200">{nok.name}</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-600 dark:text-gray-400">{nok.relationship}</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-600 dark:text-gray-400">{nok.phone}</span>
                </div>
            ) : null}

            <div className="mb-5">
                <ul className="flex border-b border-white-light dark:border-[#191e3a]">
                    <li>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('visitors');
                                setVisitorPage(1);
                            }}
                            className={`flex items-center gap-2 border-b-2 border-transparent px-4 py-3 hover:text-primary ${activeTab === 'visitors' ? '!border-primary text-primary' : ''}`}
                        >
                            <FaUser className="h-4 w-4" /> Visitor Log
                        </button>
                    </li>
                    <li>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('contacts');
                                setContactPage(1);
                            }}
                            className={`flex items-center gap-2 border-b-2 border-transparent px-4 py-3 hover:text-primary ${activeTab === 'contacts' ? '!border-primary text-primary' : ''}`}
                        >
                            <FaClipboardList className="h-4 w-4" /> Family & Contacts
                        </button>
                    </li>
                </ul>
            </div>

            {activeTab === 'visitors' && patientId?.trim() ? (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Visitor log</h3>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm flex items-center gap-2"
                            disabled={visitorsQuery.isLoading}
                            onClick={() => setVisitorModal({ open: true })}
                        >
                            <FaPlus className="h-3 w-3" /> Add Visitor
                        </button>
                    </div>

                    {visitorsQuery.isLoading ? (
                        <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                    ) : visitors.length === 0 ? (
                        <p className="py-8 text-center text-gray-500 dark:text-gray-400">No visitors recorded.</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white-light dark:border-[#191e3a]">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Relationship</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Check-in</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Check-out</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Restrictions</th>
                                            <th className="px-3 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedVisitors.map((v) => (
                                            <tr key={v.id} className="border-b border-white-light hover:bg-gray-50 dark:border-[#191e3a] dark:hover:bg-white/5">
                                                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{v.name}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{v.relationship}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{fmt(v.checkIn)}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{v.checkOut ? fmt(v.checkOut) : '—'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadge[v.status]}`}>
                                                        {statusLabel[v.status]}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{v.restrictions || '—'}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                                            onClick={() => setVisitorModal({ open: true, editing: v })}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                                            disabled={deleteVisitorMut.isPending}
                                                            onClick={() => handleDeleteVisitor(v)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                currentPage={visitorPage}
                                totalPages={visitorTotalPages}
                                onPageChange={setVisitorPage}
                                totalItems={visitors.length}
                                itemsPerPage={itemsPerPage}
                            />
                        </>
                    )}
                </div>
            ) : null}

            {activeTab === 'contacts' && patientId?.trim() ? (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Family & Contacts</h3>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm flex items-center gap-2"
                            disabled={contactsQuery.isLoading}
                            onClick={() => setContactModal({ open: true })}
                        >
                            <FaPlus className="h-3 w-3" /> Add Contact
                        </button>
                    </div>

                    {contactsQuery.isLoading ? (
                        <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                    ) : contacts.length === 0 ? (
                        <p className="py-8 text-center text-gray-500 dark:text-gray-400">No contacts recorded.</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white-light dark:border-[#191e3a]">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Relationship</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Role</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Phone</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Email</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">NOK</th>
                                            <th className="px-3 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedContacts.map((c) => (
                                            <tr key={c.id} className="border-b border-white-light hover:bg-gray-50 dark:border-[#191e3a] dark:hover:bg-white/5">
                                                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{c.name}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.relationship}</td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{c.role}</span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.phone}</td>
                                                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{c.email || '—'}</td>
                                                <td className="px-3 py-2">
                                                    {c.isNOK ? (
                                                        <span className="inline-block rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">NOK</span>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                                            onClick={() => setContactModal({ open: true, editing: c })}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                                            disabled={deleteContactMut.isPending}
                                                            onClick={() => handleDeleteContact(c)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                currentPage={contactPage}
                                totalPages={contactTotalPages}
                                onPageChange={setContactPage}
                                totalItems={contacts.length}
                                itemsPerPage={itemsPerPage}
                            />
                        </>
                    )}
                </div>
            ) : null}

            {visitorModal.open ? (
                <VisitorModal
                    key={visitorModal.editing?.id ?? 'new-visitor'}
                    initial={visitorModal.editing}
                    saving={saveVisitorMut.isPending}
                    onSave={(data) => saveVisitorMut.mutate({ editing: visitorModal.editing, data })}
                    onClose={() => setVisitorModal({ open: false })}
                />
            ) : null}
            {contactModal.open ? (
                <ContactModal
                    key={contactModal.editing?.id ?? 'new-contact'}
                    initial={contactModal.editing}
                    saving={saveContactMut.isPending}
                    onSave={(data) => saveContactMut.mutate({ editing: contactModal.editing, data })}
                    onClose={() => setContactModal({ open: false })}
                />
            ) : null}

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
                isDeleting={deleteVisitorMut.isPending || deleteContactMut.isPending}
            />
        </div>
    );
};

export default VisitorsContacts;