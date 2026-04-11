import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Pencil, Plus, Trash2, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FacilityBed, FacilityRoom, FacilityWard } from '../../../types/facility';
import {
    getAllBeds,
    getAllRooms,
    getWards,
    mockCreateBed,
    mockCreateRoom,
    mockCreateWard,
    mockDeleteBed,
    mockDeleteRoom,
    mockDeleteWard,
    mockUpdateBed,
    mockUpdateRoom,
    mockUpdateWard,
} from '../../../services/rooms.service';
import { AppModal } from '../../../components/shared/AppModal';
import { SimpleDataTable } from '../../../components/shared/SimpleDataTable';
import { useCanEditPatientLocation } from '../../../hooks/useCanEditPatientLocation';
import { DEFAULT_ROOM_TYPE, ROOM_TYPES } from '../../../constants/facility';
import IconSearch from '@/components/Icon/IconSearch';

type TabId = 'wards' | 'rooms' | 'beds';

// Validation functions
const validateWardName = (name: string): { isValid: boolean; error: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { isValid: false, error: 'Ward name is required' };
    if (trimmed.length < 2) return { isValid: false, error: 'Minimum 2 characters required' };
    if (trimmed.length > 50) return { isValid: false, error: 'Maximum 50 characters allowed' };
    const nameRegex = /^[A-Za-z\s\-]+$/;
    if (!nameRegex.test(trimmed)) return { isValid: false, error: 'Only alphabets, spaces and hyphens allowed' };
    return { isValid: true, error: '' };
};

const validateRoomNumber = (roomNumber: string): { isValid: boolean; error: string } => {
    const trimmed = roomNumber.trim();
    if (!trimmed) return { isValid: false, error: 'Room number is required' };
    if (trimmed.length < 1) return { isValid: false, error: 'Minimum 1 character required' };
    if (trimmed.length > 20) return { isValid: false, error: 'Maximum 20 characters allowed' };
    const roomRegex = /^[A-Za-z0-9\s\-]+$/;
    if (!roomRegex.test(trimmed)) return { isValid: false, error: 'Only letters, numbers, spaces and hyphens allowed' };
    return { isValid: true, error: '' };
};

const validateBedName = (bedName: string): { isValid: boolean; error: string } => {
    const trimmed = bedName.trim();
    if (!trimmed) return { isValid: false, error: 'Bed name is required' };
    if (trimmed.length < 1) return { isValid: false, error: 'Minimum 1 character required' };
    if (trimmed.length > 30) return { isValid: false, error: 'Maximum 30 characters allowed' };
    const bedRegex = /^[A-Za-z0-9\s\-]+$/;
    if (!bedRegex.test(trimmed)) return { isValid: false, error: 'Only letters, numbers, spaces and hyphens allowed' };
    return { isValid: true, error: '' };
};


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

const FacilitySettingsPage = () => {
    const queryClient = useQueryClient();
    const canEdit = useCanEditPatientLocation();
    const [tab, setTab] = useState<TabId>('wards');

    const wardsQuery = useQuery({ queryKey: ['settings', 'facility', 'wards'], queryFn: getWards });
    const roomsQuery = useQuery({ queryKey: ['settings', 'facility', 'rooms'], queryFn: getAllRooms });
    const bedsQuery = useQuery({ queryKey: ['settings', 'facility', 'beds'], queryFn: getAllBeds });

    const wardNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const w of wardsQuery.data ?? []) m.set(String(w.id), w.name);
        return m;
    }, [wardsQuery.data]);

    const roomLabelById = useMemo(() => {
        const m = new Map<string, string>();
        for (const r of roomsQuery.data ?? []) m.set(String(r.id), r.name);
        return m;
    }, [roomsQuery.data]);

    const invalidateFacility = () => {
        void queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] });
        void queryClient.invalidateQueries({ queryKey: ['facility'] });
        void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
        void queryClient.invalidateQueries({ queryKey: ['beds', 'emr-list'] });
    };

    const [wardModal, setWardModal] = useState<{ mode: 'add' | 'edit'; ward?: FacilityWard } | null>(null);
    const [roomModal, setRoomModal] = useState<{ mode: 'add' | 'edit'; room?: FacilityRoom } | null>(null);
    const [bedModal, setBedModal] = useState<{ mode: 'add' | 'edit'; bed?: FacilityBed } | null>(null);

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

    const wardMut = useMutation({
        mutationFn: async (payload: { mode: 'add' | 'edit'; ward?: FacilityWard; name: string; code: string }) => {
            if (payload.mode === 'add') return mockCreateWard({ name: payload.name, code: payload.code || undefined });
            if (!payload.ward) throw new Error('Missing ward');
            return mockUpdateWard(String(payload.ward.id), { name: payload.name, code: payload.code });
        },
        onSuccess: () => {
            toast.success('Ward saved');
            setWardModal(null);
            invalidateFacility();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
    });

    const wardDel = useMutation({
        mutationFn: (id: string) => mockDeleteWard(id),
        onSuccess: () => {
            toast.success('Ward removed');
            invalidateFacility();
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
    });

    const roomMut = useMutation({
        mutationFn: async (payload: {
            mode: 'add' | 'edit';
            room?: FacilityRoom;
            roomNumber: string;
            wardId: string;
            roomType: string;
        }) => {
            if (payload.mode === 'add') {
                return mockCreateRoom({
                    wardId: payload.wardId,
                    roomNumber: payload.roomNumber,
                    roomType: payload.roomType,
                });
            }
            if (!payload.room) throw new Error('Missing room');
            return mockUpdateRoom(String(payload.room.id), {
                roomNumber: payload.roomNumber,
                wardId: payload.wardId,
                roomType: payload.roomType,
            });
        },
        onSuccess: () => {
            toast.success('Room saved');
            setRoomModal(null);
            invalidateFacility();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
    });

    const roomDel = useMutation({
        mutationFn: (id: string) => mockDeleteRoom(id),
        onSuccess: () => {
            toast.success('Room removed');
            invalidateFacility();
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
    });

    const bedMut = useMutation({
        mutationFn: async (payload: { mode: 'add' | 'edit'; bed?: FacilityBed; bedName: string; roomId: string }) => {
            if (payload.mode === 'add') return mockCreateBed({ roomId: payload.roomId, bedName: payload.bedName });
            if (!payload.bed) throw new Error('Missing bed');
            return mockUpdateBed(String(payload.bed.id), { bedName: payload.bedName, roomId: payload.roomId });
        },
        onSuccess: () => {
            toast.success('Bed saved');
            setBedModal(null);
            invalidateFacility();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
    });

    const bedDel = useMutation({
        mutationFn: (id: string) => mockDeleteBed(id),
        onSuccess: () => {
            toast.success('Bed removed');
            invalidateFacility();
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        },
    });

    const tabs: { id: TabId; label: string }[] = [
        { id: 'wards', label: 'Wards' },
        { id: 'rooms', label: 'Rooms' },
        { id: 'beds', label: 'Beds' },
    ];

    const handleDeleteWard = (ward: FacilityWard) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Ward',
            message: `Are you sure you want to delete ward "${ward.name}"? Nested rooms and beds may be removed per server rules. This action cannot be undone.`,
            onConfirm: () => wardDel.mutate(ward.id),
        });
    };

    const handleDeleteRoom = (room: FacilityRoom) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Room',
            message: `Are you sure you want to delete room "${room.name}"? This action cannot be undone.`,
            onConfirm: () => roomDel.mutate(room.id),
        });
    };

    const handleDeleteBed = (bed: FacilityBed) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Bed',
            message: `Are you sure you want to delete bed "${bed.name}"? This action cannot be undone.`,
            onConfirm: () => bedDel.mutate(bed.id),
        });
    };

    return (
        <div className="panel">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
                <a href="/app/dashboard" className="text-primary hover:underline">Dashboard</a>
                <span className="text-gray-400">/</span>
                <a href="/app/settings" className="text-primary hover:underline">Settings</a>
                <span className="text-gray-400">/</span>
                <span className="font-medium text-gray-900 dark:text-white">Facility</span>
            </div>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-primary/25">
                        <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facility management</h1>
                        {/* <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Configure wards, rooms, and beds. Data is loaded from Wards, Rooms, and Beds APIs (set{' '}
                            <code className="rounded bg-gray-100 px-1 dark:bg-white/10">VITE_USE_MOCK_FACILITY=true</code> for offline mock mode).
                        </p> */}
                    </div>
                </div>
            </div>

            {!canEdit ? (
                <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                    Read-only: your role cannot modify facility structure.
                </div>
            ) : null}

            <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-[#191e3a]">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            tab === t.id
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'wards' ? (
                <WardsSection
                    canEdit={canEdit}
                    loading={wardsQuery.isLoading}
                    wards={wardsQuery.data ?? []}
                    onAdd={() => setWardModal({ mode: 'add' })}
                    onEdit={(w) => setWardModal({ mode: 'edit', ward: w })}
                    onDelete={handleDeleteWard}
                    deleting={wardDel.isPending}
                />
            ) : null}

            {tab === 'rooms' ? (
                <RoomsSection
                    canEdit={canEdit}
                    loading={roomsQuery.isLoading}
                    rooms={roomsQuery.data ?? []}
                    wardNameById={wardNameById}
                    onAdd={() => setRoomModal({ mode: 'add' })}
                    onEdit={(r) => setRoomModal({ mode: 'edit', room: r })}
                    onDelete={handleDeleteRoom}
                    deleting={roomDel.isPending}
                />
            ) : null}

            {tab === 'beds' ? (
                <BedsSection
                    canEdit={canEdit}
                    loading={bedsQuery.isLoading}
                    beds={bedsQuery.data ?? []}
                    roomLabelById={roomLabelById}
                    onAdd={() => setBedModal({ mode: 'add' })}
                    onEdit={(b) => setBedModal({ mode: 'edit', bed: b })}
                    onDelete={handleDeleteBed}
                    deleting={bedDel.isPending}
                />
            ) : null}

            <WardFormModal
                open={wardModal !== null}
                mode={wardModal?.mode ?? 'add'}
                ward={wardModal?.ward}
                saving={wardMut.isPending}
                errorMessage={wardMut.isError && wardMut.error instanceof Error ? wardMut.error.message : null}
                onClose={() => {
                    wardMut.reset();
                    setWardModal(null);
                }}
                onSave={(name, code) => {
                    if (!wardModal) return;
                    wardMut.mutate({ mode: wardModal.mode, ward: wardModal.ward, name, code });
                }}
            />

            <RoomFormModal
                open={roomModal !== null}
                mode={roomModal?.mode ?? 'add'}
                room={roomModal?.room}
                wards={wardsQuery.data ?? []}
                saving={roomMut.isPending}
                errorMessage={roomMut.isError && roomMut.error instanceof Error ? roomMut.error.message : null}
                onClose={() => {
                    roomMut.reset();
                    setRoomModal(null);
                }}
                onSave={(wardId, roomNumber, roomType) => {
                    if (!roomModal) return;
                    roomMut.mutate({
                        mode: roomModal.mode,
                        room: roomModal.room,
                        wardId,
                        roomNumber,
                        roomType,
                    });
                }}
            />

            <BedFormModal
                open={bedModal !== null}
                mode={bedModal?.mode ?? 'add'}
                bed={bedModal?.bed}
                rooms={roomsQuery.data ?? []}
                wardNameById={wardNameById}
                saving={bedMut.isPending}
                errorMessage={bedMut.isError && bedMut.error instanceof Error ? bedMut.error.message : null}
                onClose={() => {
                    bedMut.reset();
                    setBedModal(null);
                }}
                onSave={(roomId, bedName) => {
                    if (!bedModal) return;
                    bedMut.mutate({ mode: bedModal.mode, bed: bedModal.bed, roomId, bedName });
                }}
            />

            <ConfirmationDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
                isDeleting={wardDel.isPending || roomDel.isPending || bedDel.isPending}
            />
        </div>
    );
};



function WardsSection({
    canEdit,
    loading,
    wards,
    onAdd,
    onEdit,
    onDelete,
    deleting,
}: {
    canEdit: boolean;
    loading: boolean;
    wards: FacilityWard[];
    onAdd: () => void;
    onEdit: (w: FacilityWard) => void;
    onDelete: (w: FacilityWard) => void;
    deleting: boolean;
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState("");
    const itemsPerPage = 5;

    // 1) First apply search on full list
const filteredItems = wards.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.code ?? "").toLowerCase().includes(search.toLowerCase())
);

// 2) Now pagination should apply on filtered list
const totalItems = filteredItems.length;
const totalPages = Math.ceil(totalItems / itemsPerPage);

const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;

// 3) Final items to show
const currentItems = filteredItems.slice(startIndex, endIndex);


    useEffect(() => {
        setCurrentPage(1);
    }, [wards.length, search]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Wards</h2>

         <div className="relative w-full md:max-w-md mr-auto">
                <input
                  type="text"
                  className="form-input pl-10 w-full"
                  placeholder="Search here"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
              </div>

                {canEdit ? (
                    <button type="button" onClick={onAdd}   
                     className="
    inline-flex items-center gap-2 text-sm font-medium
    px-4 py-2 rounded-md transition-all duration-200
    bg-[#F6F6FA] text-[#8B5E3C]   /* Normal state like Quick Add */
    hover:bg-[#8B5E3C] hover:text-white /* Hover like Add New */
    border border-transparent"

>
                        <Plus className="h-4 w-4" />
                        Add ward
                    </button>
                ) : null}
            </div>
            {loading ? (
                <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ) : (
                <>
                    <SimpleDataTable
                        columns={[
                            { key: 'name', header: 'Name', render: (w) => w.name },
                            { key: 'code', header: 'Code', render: (w) => w.code ?? '—' },
                            {
                                key: 'actions',
                                header: '',
                                className: 'w-28 text-right',
                                render: (w): import("react/jsx-runtime").JSX.Element | "—" =>
                                    canEdit ? (
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                title="Edit"
                                                onClick={() => onEdit(w)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Delete"
                                                disabled={deleting}
                                                onClick={() => onDelete(w)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        '—'
                                    ),
                            },
                        ]}
                        rows={currentItems}
                        rowKey={(w) => String(w.id)}
                        emptyMessage="No wards configured"
                    />
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredItems.length}
                        itemsPerPage={itemsPerPage}
                    />
                </>
            )}
        </div>
    );
}

function RoomsSection({
    canEdit,
    loading,
    rooms,
    wardNameById,
    onAdd,
    onEdit,
    onDelete,
    deleting,
}: {
    canEdit: boolean;
    loading: boolean;
    rooms: FacilityRoom[];
    wardNameById: Map<string, string>;
    onAdd: () => void;
    onEdit: (r: FacilityRoom) => void;
    onDelete: (r: FacilityRoom) => void;
    deleting: boolean;
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState("");
    const itemsPerPage = 5;

    const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.roomType ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (wardNameById.get(String(r.wardId)) ?? "").toLowerCase().includes(search.toLowerCase())
);

const totalItems = filteredRooms.length;
const totalPages = Math.ceil(totalItems / itemsPerPage);

const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;

const currentItems = filteredRooms.slice(startIndex, endIndex);


    useEffect(() => {
        setCurrentPage(1);
    }, [rooms.length]);

    return (

        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rooms</h2>
         
          <div className="relative w-full md:max-w-md mr-auto">
                <input
                  type="text"
                  className="form-input pl-10 w-full"
                  placeholder="Search here"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
              </div>
                {canEdit ? (
                    <button type="button" onClick={onAdd}       className="
    inline-flex items-center gap-2 text-sm font-medium
    px-4 py-2 rounded-md transition-all duration-200
    bg-[#F6F6FA] text-[#8B5E3C]   /* Normal state like Quick Add */
    hover:bg-[#8B5E3C] hover:text-white /* Hover like Add New */
    border border-transparent">
                        <Plus className="h-4 w-4" />
                        Add room
                    </button>
                ) : null}
            </div>
            {loading ? (
                <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ) : (
                <>
                    <SimpleDataTable
                        columns={[
                            { key: 'ward', header: 'Ward', render: (r) => wardNameById.get(String(r.wardId)) ?? '—' },
                            { key: 'name', header: 'Room number', render: (r) => r.name },
                            { key: 'roomType', header: 'Type', render: (r) => r.roomType ?? DEFAULT_ROOM_TYPE },
                            {
                                key: 'actions',
                                header: '',
                                className: 'w-28 text-right',
                                render: (r) =>
                                    canEdit ? (
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                title="Edit"
                                                onClick={() => onEdit(r)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Delete"
                                                disabled={deleting}
                                                onClick={() => onDelete(r)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        '—'
                                    ),
                            },
                        ]}
                        rows={currentItems}
                        rowKey={(r) => String(r.id)}
                        emptyMessage="No rooms configured"
                    />
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredRooms.length}
                        itemsPerPage={itemsPerPage}
                    />
                </>
            )}
        </div>
    );
}

function BedsSection({
    canEdit,
    loading,
    beds,
    roomLabelById,
    onAdd,
    onEdit,
    onDelete,
    deleting,
}: {
    canEdit: boolean;
    loading: boolean;
    beds: FacilityBed[];
    roomLabelById: Map<string, string>;
    onAdd: () => void;
    onEdit: (b: FacilityBed) => void;
    onDelete: (b: FacilityBed) => void;
    deleting: boolean;
}) {
    const [currentPage, setCurrentPage] = useState(1);
const [search, setSearch] = useState("");
const itemsPerPage = 5;

// 1) SEARCH should happen on full list
const filteredBeds = beds.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (roomLabelById.get(String(b.roomId)) ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (b.occupied ? "occupied" : "available").toLowerCase().includes(search.toLowerCase())
);
// 2) PAGINATION should apply on filteredBeds (not beds)
const totalItems = filteredBeds.length;
const totalPages = Math.ceil(totalItems / itemsPerPage);
const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;
// 3) Final list to show
const currentItems = filteredBeds.slice(startIndex, endIndex);
    useEffect(() => {
        setCurrentPage(1);
    }, [beds.length]);

    return (
        
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Beds</h2>
        
                  <div className="relative w-full md:max-w-md mr-auto">
                <input
                  type="text"
                  className="form-input pl-10 w-full"
                  placeholder="Search here"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
              </div>
                {canEdit ? (
                    <button type="button" onClick={onAdd}       className="
    inline-flex items-center gap-2 text-sm font-medium
    px-4 py-2 rounded-md transition-all duration-200
    bg-[#F6F6FA] text-[#8B5E3C]   /* Normal state like Quick Add */
    hover:bg-[#8B5E3C] hover:text-white /* Hover like Add New */
    border border-transparent">
                        <Plus className="h-4 w-4" />
                        Add bed
                    </button>
                ) : null}
            </div>
            {loading ? (
                <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ) : (
                <>
                    <SimpleDataTable
                        columns={[
                            { key: 'room', header: 'Room', render: (b) => roomLabelById.get(String(b.roomId)) ?? '—' },
                            { key: 'name', header: 'Bed', render: (b) => b.name },
                            {
                                key: 'occ',
                                header: 'Status',
                                render: (b) =>
                                    b.occupied ? (
                                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-200">
                                            Occupied
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                            Available
                                        </span>
                                    ),
                            },
                            {
                                key: 'actions',
                                header: '',
                                className: 'w-28 text-right',
                                render: (b) =>
                                    canEdit ? (
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                title="Edit"
                                                onClick={() => onEdit(b)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Delete"
                                                disabled={deleting}
                                                onClick={() => onDelete(b)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        '—'
                                    ),
                            },
                        ]}
                        rows={currentItems}
                        rowKey={(b) => String(b.id)}
                        emptyMessage="No beds configured"
                    />
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredBeds.length}
                        itemsPerPage={itemsPerPage}
                    />
                </>
            )}
        </div>
    );
}

function WardFormModal({
    open,
    mode,
    ward,
    saving,
    errorMessage,
    onClose,
    onSave,
}: {
    open: boolean;
    mode: 'add' | 'edit';
    ward?: FacilityWard;
    saving: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onSave: (name: string, code: string) => void;
}) {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [errors, setErrors] = useState<{ name?: string }>({});

    useEffect(() => {
        if (!open) return;
        setName(ward?.name ?? '');
        setCode(ward?.code ?? '');
        setErrors({});
    }, [open, ward]);

    const validateField = (field: 'name', value: string): string => {
        if (field === 'name') {
            return validateWardName(value).error;
        }
        return '';
    };

    const handleBlur = (field: 'name') => {
        const error = validateField(field, name);
        if (error) {
            setErrors((prev) => ({ ...prev, [field]: error }));
        }
    };

    const handleNameChange = (value: string) => {
        setName(value);
        if (errors.name) {
            setErrors((prev) => ({ ...prev, name: '' }));
        }
    };

    const handleSave = () => {
        const nameValidation = validateWardName(name);
        if (!nameValidation.isValid) {
            setErrors({ name: nameValidation.error });
            return;
        }
        onSave(name.trim(), code.trim());
    };

    const isValid = name.trim().length > 0 && !errors.name;

    return (
        <AppModal
            open={open}
            title={mode === 'add' ? 'Add ward' : 'Edit ward'}
            onClose={onClose}
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn btn-outline-primary">Cancel</button>
                    <button type="button" disabled={saving || !isValid} onClick={handleSave} className="btn btn-primary">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {errorMessage ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                        {errorMessage}
                    </p>
                ) : null}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ward name <span className="text-red-600">*</span>
                    </label>
                    <input
                        className={`form-input w-full ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        onBlur={() => handleBlur('name')}
                        placeholder="e.g. ICU"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Code (optional)</label>
                    <input className="form-input w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ICU" />
                </div>
            </div>
        </AppModal>
    );
}

function RoomFormModal({
    open,
    mode,
    room,
    wards,
    saving,
    errorMessage,
    onClose,
    onSave,
}: {
    open: boolean;
    mode: 'add' | 'edit';
    room?: FacilityRoom;
    wards: FacilityWard[];
    saving: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onSave: (wardId: string, roomNumber: string, roomType: string) => void;
}) {
    const [wardId, setWardId] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [roomType, setRoomType] = useState<string>(DEFAULT_ROOM_TYPE);
    const [errors, setErrors] = useState<{ roomNumber?: string }>({});

    useEffect(() => {
        if (!open) return;
        setRoomNumber(room?.name ?? '');
        setRoomType(room?.roomType ?? DEFAULT_ROOM_TYPE);
        setWardId(room ? String(room.wardId) : wards[0] ? String(wards[0].id) : '');
        setErrors({});
    }, [open, room, wards]);

    const validateField = (field: 'roomNumber', value: string): string => {
        if (field === 'roomNumber') {
            return validateRoomNumber(value).error;
        }
        return '';
    };

    const handleBlur = (field: 'roomNumber') => {
        const error = validateField(field, roomNumber);
        if (error) {
            setErrors((prev) => ({ ...prev, [field]: error }));
        }
    };

    const handleRoomNumberChange = (value: string) => {
        setRoomNumber(value);
        if (errors.roomNumber) {
            setErrors((prev) => ({ ...prev, roomNumber: '' }));
        }
    };

    const handleSave = () => {
        const roomValidation = validateRoomNumber(roomNumber);
        if (!roomValidation.isValid) {
            setErrors({ roomNumber: roomValidation.error });
            return;
        }
        if (!wardId) {
            toast.error('Please select a ward');
            return;
        }
        onSave(wardId.trim(), roomNumber.trim(), roomType);
    };

    const isValid = Boolean(wardId.trim() && roomNumber.trim() && roomType.trim() && wards.length > 0 && !errors.roomNumber);

    return (
        <AppModal
            open={open}
            title={mode === 'add' ? 'Add room' : 'Edit room'}
            onClose={onClose}
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn btn-outline-primary">Cancel</button>
                    <button type="button" disabled={saving || !isValid} onClick={handleSave} className="btn btn-primary">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {errorMessage ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                        {errorMessage}
                    </p>
                ) : null}
                {wards.length === 0 ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">Create a ward before adding rooms.</p>
                ) : null}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ward <span className="text-red-600">*</span>
                    </label>
                    <select
                        className="form-input w-full"
                        value={wardId}
                        onChange={(e) => setWardId(e.target.value)}
                        disabled={wards.length === 0}
                    >
                        <option value="">Select ward…</option>
                        {wards.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Room number <span className="text-red-600">*</span>
                    </label>
                    <input
                        className={`form-input w-full ${errors.roomNumber ? 'border-red-500 focus:border-red-500' : ''}`}
                        value={roomNumber}
                        onChange={(e) => handleRoomNumberChange(e.target.value)}
                        onBlur={() => handleBlur('roomNumber')}
                        placeholder="e.g. 301"
                    />
                    {errors.roomNumber && <p className="mt-1 text-xs text-red-500">{errors.roomNumber}</p>}
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Room type <span className="text-red-600">*</span>
                    </label>
                    <select className="form-input w-full" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                        {ROOM_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>
        </AppModal>
    );
}

function BedFormModal({
    open,
    mode,
    bed,
    rooms,
    wardNameById,
    saving,
    errorMessage,
    onClose,
    onSave,
}: {
    open: boolean;
    mode: 'add' | 'edit';
    bed?: FacilityBed;
    rooms: FacilityRoom[];
    wardNameById: Map<string, string>;
    saving: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onSave: (roomId: string, bedName: string) => void;
}) {
    const [roomId, setRoomId] = useState('');
    const [bedName, setBedName] = useState('');
    const [errors, setErrors] = useState<{ bedName?: string }>({});

    useEffect(() => {
        if (!open) return;
        setBedName(bed?.name ?? '');
        setRoomId(bed ? String(bed.roomId) : '');
        setErrors({});
    }, [open, bed, rooms]);

    const validateField = (field: 'bedName', value: string): string => {
        if (field === 'bedName') {
            return validateBedName(value).error;
        }
        return '';
    };

    const handleBlur = (field: 'bedName') => {
        const error = validateField(field, bedName);
        if (error) {
            setErrors((prev) => ({ ...prev, [field]: error }));
        }
    };

    const handleBedNameChange = (value: string) => {
        setBedName(value);
        if (errors.bedName) {
            setErrors((prev) => ({ ...prev, bedName: '' }));
        }
    };

    const handleSave = () => {
        const bedValidation = validateBedName(bedName);
        if (!bedValidation.isValid) {
            setErrors({ bedName: bedValidation.error });
            return;
        }
        if (!roomId) {
            toast.error('Please select a room');
            return;
        }
        onSave(roomId.trim(), bedName.trim());
    };

    const isValid = Boolean(roomId.trim() && bedName.trim() && rooms.length > 0 && !errors.bedName);

    return (
        <AppModal
            open={open}
            title={mode === 'add' ? 'Add bed' : 'Edit bed'}
            onClose={onClose}
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn btn-outline-primary">Cancel</button>
                    <button type="button" disabled={saving || !isValid} onClick={handleSave} className="btn btn-primary">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {errorMessage ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                        {errorMessage}
                    </p>
                ) : null}
                {rooms.length === 0 ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">Create at least one room before adding beds.</p>
                ) : null}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Room <span className="text-red-600">*</span>
                    </label>
                    <select
                        className="form-input w-full"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        disabled={rooms.length === 0}
                    >
                        <option value="">Select room…</option>
                        {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                                {wardNameById.get(String(r.wardId)) ?? 'Ward'} · {r.name}
                                {r.roomType ? ` (${r.roomType})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Bed name <span className="text-red-600">*</span>
                    </label>
                    <input
                        className={`form-input w-full ${errors.bedName ? 'border-red-500 focus:border-red-500' : ''}`}
                        value={bedName}
                        onChange={(e) => handleBedNameChange(e.target.value)}
                        onBlur={() => handleBlur('bedName')}
                        placeholder="e.g. Bed-A"
                    />
                    {errors.bedName && <p className="mt-1 text-xs text-red-500">{errors.bedName}</p>}
                </div>
            </div>
        </AppModal>
    );
}

export default FacilitySettingsPage;