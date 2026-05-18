import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppModal } from '../../../components/shared/AppModal';
import NewDropdown from '../../../components/ui/NewDropdown';
import {
    NOTCHED_FIELD_FRAME_CLASS,
    NOTCHED_FIELD_LABEL_OVERLAY_CLASS,
} from '../../../lib/notchedFieldLabels';
import {
    createShift,
    deleteShift,
    listShiftTypes,
    listStaff,
    updateShift,
} from '../../../services/staffScheduling.service';
import type { FacilityWard } from '../../../types/facility';
import type { StaffShift, StaffShiftInput, StaffMember, ShiftType } from '../../../types/staffScheduling.types';

export interface ShiftFormDefaults {
    staffId?: string;
    wardId?: string;
    shiftTypeId?: string;
    startAt?: string;
    endAt?: string;
}

interface ShiftFormModalProps {
    open: boolean;
    shift: StaffShift | null;
    wards: FacilityWard[];
    canManage: boolean;
    defaults?: ShiftFormDefaults;
    onClose: () => void;
    onSaved: () => void;
}

const FORM_FIELD_INPUT =
    'h-10 w-full border-0 bg-transparent px-3 pb-2 pt-[1.125rem] text-[14px] font-medium text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100';

const FORM_TEXTAREA =
    'min-h-[100px] w-full resize-y border-0 bg-transparent px-3 pb-3 pt-7 text-[14px] font-medium text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100';

function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
    if (!value) return new Date().toISOString();
    return new Date(value).toISOString();
}

const dropdownFieldProps = {
    fieldSize: 'md' as const,
    variant: 'outlined' as const,
    appendMenuToBody: true,
    className: 'w-full min-w-0',
};

export function ShiftFormModal({
    open,
    shift,
    wards,
    canManage,
    defaults,
    onClose,
    onSaved,
}: ShiftFormModalProps) {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [busy, setBusy] = useState(false);
    const [staffId, setStaffId] = useState('');
    const [wardId, setWardId] = useState('');
    const [shiftTypeId, setShiftTypeId] = useState('');
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [status, setStatus] = useState<'scheduled' | 'open' | 'cancelled'>('scheduled');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        void Promise.all([listStaff(), listShiftTypes()]).then(([s, t]) => {
            setStaff(s);
            setShiftTypes(t);
        });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (shift) {
            setStaffId(shift.staffId ?? '');
            setWardId(shift.wardId);
            setShiftTypeId(shift.shiftTypeId);
            setStartAt(toLocalInput(shift.startAt));
            setEndAt(toLocalInput(shift.endAt));
            setStatus(shift.status);
            setNotes(shift.notes ?? '');
        } else {
            setStaffId(defaults?.staffId ?? '');
            setWardId(defaults?.wardId ?? (wards[0] ? String(wards[0].id) : ''));
            setShiftTypeId(defaults?.shiftTypeId ?? 'st-day');
            setStartAt(defaults?.startAt ? toLocalInput(defaults.startAt) : toLocalInput(new Date().toISOString()));
            setEndAt(defaults?.endAt ? toLocalInput(defaults.endAt) : '');
            setStatus('scheduled');
            setNotes('');
        }
    }, [open, shift, defaults, wards]);

    const staffOptions = useMemo(
        () => [
            { value: '', label: 'Unassigned (open shift)' },
            ...staff.map((s) => ({ value: s.id, label: s.displayName })),
        ],
        [staff]
    );

    const wardOptions = wards.map((w) => ({
        value: String(w.id),
        label: w.code ? `${w.name} (${w.code})` : w.name,
    }));

    const typeOptions = shiftTypes.map((t) => ({ value: t.id, label: t.label }));

    const applyShiftTypeTimes = (typeId: string) => {
        const st = shiftTypes.find((t) => t.id === typeId);
        if (!st || !startAt) return;
        const base = new Date(startAt);
        const [sh, sm] = st.startTime.split(':').map(Number);
        const [eh, em] = st.endTime.split(':').map(Number);
        base.setHours(sh, sm, 0, 0);
        const end = new Date(base);
        if (eh < sh || (eh === sh && em <= sm)) end.setDate(end.getDate() + 1);
        end.setHours(eh, em, 0, 0);
        setStartAt(toLocalInput(base.toISOString()));
        setEndAt(toLocalInput(end.toISOString()));
    };

    const buildPayload = (): StaffShiftInput => ({
        staffId: staffId || null,
        wardId,
        shiftTypeId,
        startAt: fromLocalInput(startAt),
        endAt: fromLocalInput(endAt || startAt),
        status: staffId ? status : 'open',
        notes: notes.trim() || undefined,
    });

    const onSubmit = async () => {
        if (!canManage) {
            toast.error('You do not have permission to manage staff schedules.');
            return;
        }
        if (!wardId || !shiftTypeId) {
            toast.error('Ward and shift type are required.');
            return;
        }
        setBusy(true);
        try {
            const payload = buildPayload();
            if (shift) await updateShift(shift.id, payload);
            else await createShift(payload);
            toast.success(shift ? 'Shift updated' : 'Shift created');
            onSaved();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to save shift');
        } finally {
            setBusy(false);
        }
    };

    const onDelete = async () => {
        if (!shift || !canManage) return;
        if (!window.confirm('Delete this shift?')) return;
        setBusy(true);
        try {
            await deleteShift(shift.id);
            toast.success('Shift deleted');
            onSaved();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete shift');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppModal
            open={open}
            title={shift ? 'Edit shift' : 'Add shift'}
            description={canManage ? undefined : 'View only — contact an administrator to make changes.'}
            onClose={onClose}
            size="lg"
            footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {shift && canManage ? (
                            <button
                                type="button"
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                                disabled={busy}
                                onClick={() => void onDelete()}
                            >
                                Delete
                            </button>
                        ) : null}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </button>
                        {canManage ? (
                            <button
                                type="button"
                                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                                disabled={busy}
                                onClick={() => void onSubmit()}
                            >
                                {busy ? 'Saving…' : 'Save shift'}
                            </button>
                        ) : null}
                    </div>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                <div className="min-w-0">
                    <NewDropdown
                        {...dropdownFieldProps}
                        id="shift-form-staff"
                        label="Staff"
                        options={staffOptions}
                        value={staffId}
                        placeholder="Select staff"
                        onChange={(v) => setStaffId(String(v))}
                        disabled={!canManage}
                    />
                </div>

                <div className="min-w-0">
                    <NewDropdown
                        {...dropdownFieldProps}
                        id="shift-form-ward"
                        label="Ward"
                        options={wardOptions}
                        value={wardId}
                        placeholder="Select ward"
                        onChange={(v) => setWardId(String(v))}
                        disabled={!canManage}
                    />
                </div>

                <div className="min-w-0">
                    <NewDropdown
                        {...dropdownFieldProps}
                        id="shift-form-type"
                        label="Shift type"
                        options={typeOptions}
                        value={shiftTypeId}
                        placeholder="Select shift type"
                        onChange={(v) => {
                            const id = String(v);
                            setShiftTypeId(id);
                            applyShiftTypeTimes(id);
                        }}
                        disabled={!canManage}
                    />
                </div>

                <div className="min-w-0">
                    <NewDropdown
                        {...dropdownFieldProps}
                        id="shift-form-status"
                        label="Status"
                        options={[
                            { value: 'scheduled', label: 'Scheduled' },
                            { value: 'open', label: 'Open' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ]}
                        value={status}
                        placeholder="Select status"
                        onChange={(v) => setStatus(v as typeof status)}
                        disabled={!canManage || !staffId}
                    />
                </div>

                <div className="min-w-0">
                    <div className={NOTCHED_FIELD_FRAME_CLASS}>
                        <span className={NOTCHED_FIELD_LABEL_OVERLAY_CLASS}>Start</span>
                        <input
                            type="datetime-local"
                            className={FORM_FIELD_INPUT}
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            disabled={!canManage}
                        />
                    </div>
                </div>

                <div className="min-w-0">
                    <div className={NOTCHED_FIELD_FRAME_CLASS}>
                        <span className={NOTCHED_FIELD_LABEL_OVERLAY_CLASS}>End</span>
                        <input
                            type="datetime-local"
                            className={FORM_FIELD_INPUT}
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                            disabled={!canManage}
                        />
                    </div>
                </div>

                <div className="min-w-0 md:col-span-2">
                    <div className={NOTCHED_FIELD_FRAME_CLASS}>
                        <span className={NOTCHED_FIELD_LABEL_OVERLAY_CLASS}>Notes</span>
                        <textarea
                            className={FORM_TEXTAREA}
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={!canManage}
                            placeholder="Optional notes…"
                        />
                    </div>
                </div>
            </div>
        </AppModal>
    );
}
