import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { AppModal } from '../../../components/shared/AppModal';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import AppButton from '../../../components/ui/AppButton';
import type { IRootState } from '../../../store';
import { providerDisplayNameFromUser, providerSignUserIdFromUser } from '../../../utils/dischargeReadinessUser';
import { activateCodeEvent, listOnShiftStaffForCodeEvent } from '../../../services/codeEventService';
import { announceCodeEventToUnit } from '../utils/codeEventBroadcast';
import { fromDatetimeLocalValue, isWithinCalledAtEditWindow, toDatetimeLocalValue } from '../utils/codeEventFormatters';
import { CALLED_AT_EDIT_WINDOW_MS, CODE_EVENT_TYPES } from '../constants/codeEventOptions';
import type { CodeEventType } from '../../../types/codeEvent';
import { DEFAULT_CODE_EVENT_UNIT_ID } from '../config/codeEventMock.config';
import { getPatientsList, type PatientListItem } from '../../../services/patient.service';
import { listActiveEncounters, type ActiveEncounterRow } from '../../../services/adt.service';

export type CodeActivateContext = {
    patientId?: string;
    encounterId?: string;
    patientName?: string;
    patientMrn?: string;
    location?: string;
    tenantId?: string;
    unitId?: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    context?: CodeActivateContext;
    onActivated?: (eventId: string) => void;
};

const fieldClass =
    'h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

export function CodeActivateModal({ open, onClose, context, onActivated }: Props) {
    const navigate = useNavigate();
    const user = useSelector((s: IRootState) => s.auth.user);
    const calledBy = providerSignUserIdFromUser(user);
    const calledByName = providerDisplayNameFromUser(user) || 'Clinical user';

    const [eventType, setEventType] = useState<CodeEventType>('Code Blue');
    const [patientId, setPatientId] = useState(context?.patientId ?? '');
    const [encounterId, setEncounterId] = useState(context?.encounterId ?? '');
    const [location, setLocation] = useState(context?.location ?? '');
    const [calledAt, setCalledAt] = useState(() => new Date().toISOString());
    const [teamLeadId, setTeamLeadId] = useState('');
    const [announceToUnit, setAnnounceToUnit] = useState(true);
    const [busy, setBusy] = useState(false);
    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [encounters, setEncounters] = useState<ActiveEncounterRow[]>([]);
    const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);

    const tenantId = useMemo(() => {
        if (context?.tenantId) return context.tenantId;
        try {
            const raw = localStorage.getItem('user');
            if (!raw) return 'tenant-demo';
            const u = JSON.parse(raw) as { tenant?: { id?: string }; tenantId?: string };
            return String(u.tenant?.id ?? u.tenantId ?? 'tenant-demo');
        } catch {
            return 'tenant-demo';
        }
    }, [context?.tenantId]);

    useEffect(() => {
        if (!open) return;
        setEventType('Code Blue');
        setPatientId(context?.patientId ?? '');
        setEncounterId(context?.encounterId ?? '');
        setLocation(context?.location ?? '');
        setCalledAt(new Date().toISOString());
        setAnnounceToUnit(true);
    }, [open, context]);

    useEffect(() => {
        if (!open) return;
        void getPatientsList({ page: 1, limit: 500, status: 'active', sortBy: 'patient', sortOrder: 'asc' })
            .then((r) => setPatients(r.items))
            .catch(() => toast.error('Could not load patients'));
        void listOnShiftStaffForCodeEvent().then(setStaff).catch(() => setStaff([]));
    }, [open]);

    useEffect(() => {
        if (!patientId) {
            setEncounters([]);
            return;
        }
        void listActiveEncounters({ patientId })
            .then((res) => {
                if (res.ok) setEncounters(res.data);
                else setEncounters([]);
            })
            .catch(() => setEncounters([]));
    }, [patientId]);

    const teamLeadName = staff.find((s) => s.id === teamLeadId)?.name ?? '';

    const patientLabel = useMemo(() => {
        if (context?.patientName) return context.patientName;
        const p = patients.find((x) => x.id === patientId);
        return p?.name ?? '';
    }, [context?.patientName, patients, patientId]);

    const calledAtEditable = isWithinCalledAtEditWindow(calledAt);

    const handleActivate = useCallback(async () => {
        if (!patientId || !encounterId) {
            toast.error('Select patient and encounter');
            return;
        }
        if (!location.trim()) {
            toast.error('Enter current location');
            return;
        }
        if (!teamLeadId) {
            toast.error('Select team lead');
            return;
        }
        setBusy(true);
        try {
            const record = await activateCodeEvent(
                {
                    patientId,
                    encounterId,
                    tenantId,
                    eventType,
                    location: location.trim(),
                    calledBy,
                    calledByName,
                    calledAt,
                    teamLeadId,
                    teamLeadName,
                    announceToUnit,
                },
                {
                    patientName: patientLabel,
                    patientMrn: context?.patientMrn,
                    unitId: context?.unitId ?? DEFAULT_CODE_EVENT_UNIT_ID,
                }
            );
            if (announceToUnit) {
                announceCodeEventToUnit({
                    type: 'code_event_activated',
                    eventId: record.id,
                    unitId: context?.unitId ?? DEFAULT_CODE_EVENT_UNIT_ID,
                    eventType,
                    location: location.trim(),
                    patientId,
                });
            }
            toast.success(`${eventType} activated`);
            onActivated?.(record.id);
            onClose();
            navigate(`/app/inpatient/code-event/${record.id}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Activation failed');
        } finally {
            setBusy(false);
        }
    }, [
        patientId,
        encounterId,
        tenantId,
        eventType,
        location,
        calledBy,
        calledByName,
        calledAt,
        teamLeadId,
        teamLeadName,
        announceToUnit,
        patientLabel,
        context,
        announceToUnit,
        onActivated,
        onClose,
        navigate,
    ]);

    return (
        <AppModal
            open={open}
            title="Activate emergency event"
            description="Code Blue · Rapid Response · Stroke · STEMI · Sepsis · OB"
            onClose={() => !busy && onClose()}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={onClose}>
                        Cancel
                    </button>
                    <AppButton type="button" disabled={busy} onClick={() => void handleActivate()}>
                        {busy ? 'Activating…' : 'Activate Event'}
                    </AppButton>
                </div>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Event type</label>
                    <select className={fieldClass} value={eventType} onChange={(e) => setEventType(e.target.value as CodeEventType)}>
                        {CODE_EVENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Patient</label>
                    <SearchableSelect
                        allowEmpty
                        emptyRowLabel="Select patient…"
                        placeholder="Search patient…"
                        value={patientId}
                        disabled={Boolean(context?.patientId)}
                        options={patients.map((p) => ({
                            value: p.id,
                            label: `${p.name}${p.mrn ? ` · MRN ${p.mrn}` : ''}`,
                            keywords: `${p.name} ${p.mrn || ''} ${p.id}`,
                        }))}
                        onChange={(v) => {
                            setPatientId(String(v));
                            setEncounterId('');
                        }}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Encounter</label>
                    <SearchableSelect
                        allowEmpty
                        emptyRowLabel={patientId ? 'Select encounter…' : 'Select patient first'}
                        placeholder="Active encounter…"
                        value={encounterId}
                        disabled={!patientId || Boolean(context?.encounterId)}
                        options={encounters.map((e) => ({
                            value: e.id,
                            label: e.patientName ? `${e.patientName} · ${e.id.slice(-8)}` : e.id.slice(-12),
                            keywords: e.id,
                        }))}
                        onChange={(v) => setEncounterId(String(v))}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Current location</label>
                    <input className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room / bed" />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Called by</label>
                    <input className={fieldClass} value={calledByName} readOnly disabled />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Time called
                        {!calledAtEditable ? (
                            <span className="ml-1 font-normal text-gray-400">(locked after 5 min)</span>
                        ) : null}
                    </label>
                    <input
                        type="datetime-local"
                        className={fieldClass}
                        value={toDatetimeLocalValue(calledAt)}
                        disabled={!calledAtEditable}
                        onChange={(e) => {
                            const next = fromDatetimeLocalValue(e.target.value);
                            const base = new Date(context?.patientId ? calledAt : new Date().toISOString()).getTime();
                            if (Math.abs(new Date(next).getTime() - base) <= CALLED_AT_EDIT_WINDOW_MS) {
                                setCalledAt(next);
                            }
                        }}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Team lead</label>
                    <select className={fieldClass} value={teamLeadId} onChange={(e) => setTeamLeadId(e.target.value)}>
                        <option value="">Select on-shift staff…</option>
                        {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.role})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-end sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            role="switch"
                            className="h-5 w-9 shrink-0 appearance-none rounded-full bg-gray-300 transition checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-gray-600"
                            style={{
                                backgroundImage: announceToUnit
                                    ? 'linear-gradient(to right, transparent 50%, var(--tw-gradient-from, #97704f) 50%)'
                                    : undefined,
                            }}
                            checked={announceToUnit}
                            onChange={(e) => setAnnounceToUnit(e.target.checked)}
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                            <span className="font-semibold">Announce to unit</span>
                            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                Broadcast to unit staff (websocket when available)
                            </span>
                        </span>
                    </label>
                </div>
            </div>
        </AppModal>
    );
}
