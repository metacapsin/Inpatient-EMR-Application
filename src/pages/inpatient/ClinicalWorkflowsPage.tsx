import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { IRootState } from '../../store';
import * as clinicalApi from '../../features/clinical-workflows/api/clinicalApi';
import {
    canCreateOrders,
    canNursingActions,
    canSignPhysicianNote,
    normalizeRoles,
} from '../../features/clinical-workflows/clinicalRole';
import type {
    ClinicalAlertRow,
    CpoeOrderRow,
    InpatientVitalRow,
    NursingNoteRow,
    PhysicianNote,
} from '../../features/clinical-workflows/types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { getPatientsList, type PatientListItem } from '../../services/patient.service';
import { listActiveEncounters, type ActiveEncounterRow } from '../../services/adt.service';
import NewDropdown from '@/components/ui/NewDropdown';
import AppButton from '@/components/ui/AppButton';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

type TabId = 'physician' | 'nursing' | 'vitals' | 'orders' | 'alerts';

const selectClass =
    'h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

function formatNursingNoteWhen(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatEncounterLabel(enc: ActiveEncounterRow): string {
    const idTail = enc.id.length > 8 ? enc.id.slice(-8) : enc.id;
    const bedRaw = enc.currentBedId != null ? String(enc.currentBedId) : '';
    const bed = bedRaw ? (bedRaw.length > 6 ? bedRaw.slice(-6) : bedRaw) : '—';
    let ts = '';
    if (enc.admissionTimestamp) {
        const d = new Date(enc.admissionTimestamp as string);
        if (!Number.isNaN(d.getTime())) ts = d.toLocaleString();
    }
    return ts ? `…${idTail} · Bed …${bed} · ${ts}` : `…${idTail} · Bed …${bed}`;
}

const NOTE_TEMPLATES: { value: string; label: string }[] = [
    { value: 'hp', label: 'H&P' },
    { value: 'progress', label: 'Progress Note' },
    { value: 'discharge_summary', label: 'Discharge Summary' },
    { value: 'consult', label: 'Consult' },
];

function ClinicalWorkflowsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';
    const encounterId = searchParams.get('encounterId') || '';

    const authRole = useSelector((s: IRootState) => s.auth.role);
    const user = useSelector((s: IRootState) => s.auth.user);
    const rolesNorm = useMemo(() => normalizeRoles(authRole, user), [authRole, user]);
    const showSign = canSignPhysicianNote(rolesNorm);
    const showOrders = canCreateOrders(rolesNorm);
    const showNursing = canNursingActions(rolesNorm);

    const [tab, setTab] = useState<TabId>('physician');
    const [loading, setLoading] = useState(false);

    const [notes, setNotes] = useState<PhysicianNote[]>([]);
    const [noteType, setNoteType] = useState('progress');
    const [hpi, setHpi] = useState('');
    const [ros, setRos] = useState('');
    const [assessment, setAssessment] = useState('');
    const [plan, setPlan] = useState('');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [addendumText, setAddendumText] = useState('');

    const [nursingShift, setNursingShift] = useState<'morning' | 'evening' | 'night'>('morning');
    const [nursingText, setNursingText] = useState('');
    const [nursingNotes, setNursingNotes] = useState<NursingNoteRow[]>([]);
    const [selectedNursingNoteId, setSelectedNursingNoteId] = useState<string | null>(null);

    const [handoverTo, setHandoverTo] = useState('');
    const [sbarS, setSbarS] = useState('');
    const [sbarB, setSbarB] = useState('');
    const [sbarA, setSbarA] = useState('');
    const [sbarR, setSbarR] = useState('');

    const [vitalType, setVitalType] = useState<'HR' | 'BP' | 'Temp' | 'SpO2' | 'RR'>('HR');
    const [vitalValue, setVitalValue] = useState('');
    const [vitalSecondary, setVitalSecondary] = useState('');
    const [vitals, setVitals] = useState<InpatientVitalRow[]>([]);
    const [chartVitalType, setChartVitalType] = useState<string>('HR');

    const [orderTab, setOrderTab] = useState<'medication' | 'lab' | 'imaging'>('medication');
    const [orderPriority, setOrderPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
    const [orderJson, setOrderJson] = useState('{}');
    const [orders, setOrders] = useState<CpoeOrderRow[]>([]);

    const [alerts, setAlerts] = useState<ClinicalAlertRow[]>([]);

    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(false);
    const [encounters, setEncounters] = useState<ActiveEncounterRow[]>([]);
    const [encountersLoading, setEncountersLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setPatientsLoading(true);
        void getPatientsList({
            page: 1,
            limit: 500,
            status: 'active',
            sortBy: 'patient',
            sortOrder: 'asc',
        })
            .then((res) => {
                if (!cancelled) setPatients(res.items);
            })
            .catch(() => {
                if (!cancelled) toast.error('Could not load patients');
            })
            .finally(() => {
                if (!cancelled) setPatientsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!patientId) {
            setEncounters([]);
            return;
        }
        let cancelled = false;
        setEncountersLoading(true);
        void listActiveEncounters({ patientId })
            .then((res) => {
                if (cancelled) return;
                if (res.ok) setEncounters(res.data);
                else toast.error(res.message);
            })
            .catch(() => {
                if (!cancelled) toast.error('Could not load active encounters');
            })
            .finally(() => {
                if (!cancelled) setEncountersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [patientId]);

    const patientInList = patientId && patients.some((p) => p.id === patientId);
    const encounterInList = encounterId && encounters.some((e) => e.id === encounterId);

    const refreshPhysician = useCallback(async () => {
        if (!patientId) return;
        const res = await clinicalApi.fetchPhysicianNotes(patientId, encounterId || undefined);
        if (res.status === 'success' && Array.isArray(res.data)) setNotes(res.data as PhysicianNote[]);
    }, [patientId, encounterId]);

    const refreshNursing = useCallback(async () => {
        if (!patientId) return;
        const res = await clinicalApi.fetchNursingNotes(patientId, encounterId || undefined);
        if (res.status === 'success' && Array.isArray(res.data)) setNursingNotes(res.data as NursingNoteRow[]);
    }, [patientId, encounterId]);

    const refreshVitals = useCallback(async () => {
        if (!patientId) return;
        const res = await clinicalApi.fetchVitals(patientId, encounterId || undefined);
        if (res.status === 'success' && Array.isArray(res.data)) setVitals(res.data as InpatientVitalRow[]);
    }, [patientId, encounterId]);

    const refreshOrders = useCallback(async () => {
        if (!patientId) return;
        const res = await clinicalApi.fetchOrders(patientId, encounterId || undefined);
        if (res.status === 'success' && Array.isArray(res.data)) setOrders(res.data as CpoeOrderRow[]);
    }, [patientId, encounterId]);

    const refreshAlerts = useCallback(async () => {
        if (!patientId) return;
        const res = await clinicalApi.fetchClinicalAlerts(patientId);
        if (res.status === 'success' && Array.isArray(res.data)) setAlerts(res.data as ClinicalAlertRow[]);
    }, [patientId]);

    useEffect(() => {
        if (!patientId || !encounterId) return;
        void (async () => {
            setLoading(true);
            try {
                await Promise.all([
                    refreshPhysician(),
                    refreshNursing(),
                    refreshVitals(),
                    refreshOrders(),
                    refreshAlerts(),
                ]);
            } catch (e) {
                console.error(e);
                toast.error('Failed to load clinical data');
            } finally {
                setLoading(false);
            }
        })();
    }, [patientId, encounterId, refreshPhysician, refreshNursing, refreshVitals, refreshOrders, refreshAlerts]);

    useEffect(() => {
        setSelectedNursingNoteId(null);
    }, [patientId, encounterId]);

    const chartData = useMemo(() => {
        const filtered = vitals.filter((v) => v.type === chartVitalType).slice(0, 48);
        const chronological = [...filtered].reverse();
        return {
            labels: chronological.map((v) => new Date(v.recordedAt).toLocaleString()),
            datasets: [
                {
                    label: chartVitalType,
                    data: chronological.map((v) => v.value),
                    borderColor:
                        chartVitalType === 'SpO2'
                            ? 'rgb(59, 130, 246)'
                            : chartVitalType === 'HR'
                              ? 'rgb(239, 68, 68)'
                              : 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.25,
                },
            ],
        };
    }, [vitals, chartVitalType]);

    const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && a.status === 'open');

    async function saveDraft() {
        if (!patientId || !encounterId) {
            toast.error('Select patient and active encounter');
            return;
        }
        try {
            if (selectedNoteId) {
                await clinicalApi.updatePhysicianNote(selectedNoteId, {
                    content: { hpi, ros, assessment, plan },
                });
                toast.success('Draft updated');
            } else {
                const res = await clinicalApi.createPhysicianNote({
                    patientId,
                    encounterId,
                    type: noteType,
                    content: { hpi, ros, assessment, plan },
                });
                if (res.data && typeof res.data === 'object' && 'id' in res.data) {
                    setSelectedNoteId(String((res.data as PhysicianNote).id));
                }
                toast.success('Draft created');
            }
            await refreshPhysician();
        } catch (e: unknown) {
            toast.error('Save failed');
        }
    }

    async function signNote() {
        if (!selectedNoteId) {
            toast.error('Save a draft first or select a note');
            return;
        }
        try {
            await clinicalApi.signPhysicianNote(selectedNoteId);
            toast.success('Note signed');
            await refreshPhysician();
        } catch {
            toast.error('Sign failed');
        }
    }

    async function submitAddendum() {
        if (!selectedNoteId || !addendumText.trim()) return;
        try {
            await clinicalApi.addPhysicianNoteAddendum(selectedNoteId, addendumText.trim());
            setAddendumText('');
            toast.success('Addendum saved');
            await refreshPhysician();
        } catch {
            toast.error('Addendum failed');
        }
    }

    async function submitNursing() {
        if (!patientId || !encounterId) {
            toast.error('Set patientId and encounterId');
            return;
        }
        try {
            await clinicalApi.createNursingNote({
                patientId,
                encounterId,
                shift: nursingShift,
                notes: nursingText,
            });
            setNursingText('');
            toast.success('Nursing note saved');
            await refreshNursing();
        } catch {
            toast.error('Nursing note failed');
        }
    }

    async function submitHandover() {
        if (!patientId || !encounterId || !handoverTo.trim()) {
            toast.error('Patient, encounter, and receiving nurse id required');
            return;
        }
        try {
            await clinicalApi.createHandover({
                patientId,
                encounterId,
                toNurseId: handoverTo.trim(),
                shift: nursingShift,
                sbar: {
                    situation: sbarS,
                    background: sbarB,
                    assessment: sbarA,
                    recommendation: sbarR,
                },
            });
            toast.success('Handover saved');
        } catch {
            toast.error('Handover failed');
        }
    }

    async function submitVital() {
        if (!patientId || !encounterId) {
            toast.error('Set patientId and encounterId');
            return;
        }
        const v = Number(vitalValue);
        if (!Number.isFinite(v)) {
            toast.error('Invalid value');
            return;
        }
        const body: Record<string, unknown> = {
            patientId,
            encounterId,
            type: vitalType,
            value: v,
            source: 'manual',
        };
        if (vitalType === 'BP') {
            const d = Number(vitalSecondary);
            if (!Number.isFinite(d)) {
                toast.error('Diastolic required for BP');
                return;
            }
            body.secondaryValue = d;
        }
        try {
            await clinicalApi.createVital(body);
            toast.success('Vital recorded');
            setVitalValue('');
            setVitalSecondary('');
            await refreshVitals();
            await refreshAlerts();
        } catch {
            toast.error('Vital save failed');
        }
    }

    async function submitOrder() {
        let details: Record<string, unknown>;
        try {
            details = JSON.parse(orderJson || '{}');
        } catch {
            toast.error('Order details must be valid JSON');
            return;
        }
        try {
            await clinicalApi.createOrder({
                patientId,
                encounterId,
                type: orderTab,
                priority: orderPriority,
                details,
            });
            toast.success('Order created');
            await refreshOrders();
            await refreshAlerts();
        } catch {
            toast.error('Order failed');
        }
    }

    async function advanceOrder(o: CpoeOrderRow, status: string) {
        try {
            await clinicalApi.updateOrderStatus(o.id, status);
            toast.success('Order updated');
            await refreshOrders();
            await refreshAlerts();
        } catch {
            toast.error('Status update failed');
        }
    }

    function setPatientSelection(nextPatientId: string) {
        const next = new URLSearchParams(searchParams);
        if (nextPatientId) next.set('patientId', nextPatientId);
        else next.delete('patientId');
        next.delete('encounterId');
        setSearchParams(next);
    }

    function setEncounterSelection(nextEncounterId: string) {
        const next = new URLSearchParams(searchParams);
        if (nextEncounterId) next.set('encounterId', nextEncounterId);
        else next.delete('encounterId');
        setSearchParams(next);
    }

    function renderPatientEncounterForm(introText?: boolean) {
        return (
            <div className="space-y-4">
                {introText !== false && (
                    <p className="text-gray-600 dark:text-gray-400">
                        Choose an <strong>active</strong> inpatient encounter. Encounters come from ADT (admission); only patients with an in-progress stay
                        appear in the encounter list.
                    </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Patient</label>
                      <div className="w-full">
                    <NewDropdown
                        options={[
                        {
                            value: "",
                            label: patientsLoading ? "Loading patients…" : "Select patient…",
                        },

                        ...(patientId && !patientInList
                            ? [
                                {
                                value: patientId,
                                label: `Current selection (not in list) · ${patientId.slice(-10)}…`,
                                },
                            ]
                            : []),

                        ...patients.map((p) => ({
                            value: p.id,
                            label: `${p.name}${p.mrn ? ` · MRN ${p.mrn}` : ""}`,
                        })),
                        ]}
                        value={patientId || ""}
                        placeholder="Select patient…"
                        onChange={(value) => setPatientSelection(String(value))}
                        disabled={patientsLoading}
                    />
                    </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Encounter</label>
                        {/* <select
                            className={selectClass}
                            value={encounterId}
                            disabled={!patientId || encountersLoading}
                            onChange={(e) => setEncounterSelection(e.target.value)}
                        >
                            <option value="">
                                {!patientId
                                    ? 'Select a patient first…'
                                    : encountersLoading
                                      ? 'Loading encounters…'
                                      : 'Select active encounter…'}
                            </option>
                            {encounterId && !encounterInList && patientId ? (
                                <option value={encounterId}>Current selection · …{encounterId.slice(-8)}</option>
                            ) : null}
                            {encounters.map((enc) => (
                                <option key={enc.id} value={enc.id}>
                                    {formatEncounterLabel(enc)}
                                </option>
                            ))}
                        </select> */}
                        <div className="w-full">
  <NewDropdown
    options={[
      {
        value: "",
        label: !patientId
          ? "Select a patient first…"
          : encountersLoading
          ? "Loading encounters…"
          : "Select active encounter…",
      },

      ...(encounterId && !encounterInList && patientId
        ? [
            {
              value: encounterId,
              label: `Current selection · …${encounterId.slice(-8)}`,
            },
          ]
        : []),

      ...encounters.map((enc) => ({
        value: enc.id,
        label: formatEncounterLabel(enc),
      })),
    ]}
    value={encounterId || ""}
    placeholder="Select active encounter…"
    onChange={(value) => setEncounterSelection(String(value))}
    disabled={!patientId || encountersLoading}
  />
</div>
                        {patientId && !encountersLoading && encounters.length === 0 ? (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">No active encounter for this patient. Admit the patient from ADT first.</p>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    if (!patientId || !encounterId) {
        return (
            <div className="panel p-6">
                <h1 className="mb-2 text-xl font-semibold">Clinical workflows</h1>
                <p className="mb-4 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                    There is no separate <strong>Physician</strong> item in the sidebar. Choose a patient and an active encounter
                    here first; then this page shows tabs including <strong>Physician</strong> (inpatient progress notes),{' '}
                    <strong>Nursing</strong>, Vitals, Orders, and Alerts.
                </p>
                {renderPatientEncounterForm(true)}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {criticalAlerts.length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    <p className="font-semibold">Critical alerts</p>
                    <ul className="mt-2 list-inside list-disc text-sm">
                        {criticalAlerts.map((a) => (
                            <li key={a.id}>{a.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="panel p-4">
                <h1 className="text-lg font-semibold">Inpatient clinical workspace</h1>
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    {renderPatientEncounterForm(false)}
                </div>
                {loading && <p className="mt-2 text-sm text-gray-500">Loading clinical data…</p>}

                <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
                    {(['physician', 'nursing', 'vitals', 'orders', 'alerts'] as TabId[]).map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`rounded px-3 py-1 text-sm capitalize ${
                                tab === t ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
                            }`}
                            onClick={() => setTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === 'physician' && (
                    <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <label className="text-sm font-medium">Template</label>
                            {/* <select
                                className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                                value={noteType}
                                onChange={(e) => setNoteType(e.target.value)}
                            >
                                {NOTE_TEMPLATES.map((n) => (
                                    <option key={n.value} value={n.value}>
                                        {n.label}
                                    </option>
                                ))}
                            </select> */}
                             <div className="w-34 mt-1 ">
                            <NewDropdown
                            options={NOTE_TEMPLATES.map((n) => ({
                                value: n.value,
                                label: n.label,
                            }))}
                            value={noteType}
                            onChange={(v) => setNoteType(String(v))}
                            placeholder="Select..."
/>
                        </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">HPI</label>
                                <Textarea value={hpi} onChange={(e) => setHpi(e.target.value)} rows={4} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">ROS</label>
                                <Textarea value={ros} onChange={(e) => setRos(e.target.value)} rows={4} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Assessment</label>
                                <Textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} rows={4} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Plan</label>
                                <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={4} className="mt-1" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={() => void saveDraft()}>
                                Save draft
                            </Button>
                            {showSign && (
                                <Button type="button" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void signNote()}>
                                    Sign note
                                </Button>
                            )}
                        </div>
                        {showSign && (
                            <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
                                <p className="text-sm font-medium">Addendum (signed notes only)</p>
                                <Textarea value={addendumText} onChange={(e) => setAddendumText(e.target.value)} rows={2} className="mt-2" />
                                <AppButton type="button" className="mt-2" onClick={() => void submitAddendum()}>
                                    Append addendum
                                </AppButton>
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium">Recent notes</p>
                            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
                                {notes.map((n) => (
                                    <li key={n.id}>
                                        <button
                                            type="button"
                                            className="text-left text-primary hover:underline"
                                            onClick={() => {
                                                setSelectedNoteId(n.id || null);
                                                const c = n.content || {};
                                                setHpi(String(c.hpi || ''));
                                                setRos(String(c.ros || ''));
                                                setAssessment(String(c.assessment || ''));
                                                setPlan(String(c.plan || ''));
                                                setNoteType(n.type || 'progress');
                                            }}
                                        >
                                            {n.type} — {n.status} — {n.id?.slice(-6)}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {tab === 'nursing' && showNursing && (
                    <div className="mt-4 space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <h3 className="font-medium">Nursing note</h3>
                                {/* <select
                                    className="mt-2 rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                                    value={nursingShift}
                                    onChange={(e) => setNursingShift(e.target.value as typeof nursingShift)}
                                >
                                    <option value="morning">Morning</option>
                                    <option value="evening">Evening</option>
                                    <option value="night">Night</option>
                                </select> */}
                                <div className="w-32 mt-2">
                                <NewDropdown
                                    options={[
                                    { value: "morning", label: "Morning" },
                                    { value: "evening", label: "Evening" },
                                    { value: "night", label: "Night" }
                                    ]}
                                    value={nursingShift}
                                    onChange={(v) => setNursingShift(v as typeof nursingShift)}
                                    placeholder="Select..."
                                />
                                </div>
                                <Textarea className="mt-2" rows={6} value={nursingText} onChange={(e) => setNursingText(e.target.value)} />
                                <Button type="button" className="mt-2" onClick={() => void submitNursing()}>
                                    Save nursing note
                                </Button>
                            </div>
                            <div>
                                <h3 className="font-medium">SBAR handover</h3>
                                <Input className="mt-2" placeholder="To nurse user id" value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)} />
                                <label className="mt-2 block text-xs text-gray-500">Situation</label>
                                <Textarea rows={2} value={sbarS} onChange={(e) => setSbarS(e.target.value)} />
                                <label className="mt-2 block text-xs text-gray-500">Background</label>
                                <Textarea rows={2} value={sbarB} onChange={(e) => setSbarB(e.target.value)} />
                                <label className="mt-2 block text-xs text-gray-500">Assessment</label>
                                <Textarea rows={2} value={sbarA} onChange={(e) => setSbarA(e.target.value)} />
                                <label className="mt-2 block text-xs text-gray-500">Recommendation</label>
                                <Textarea rows={2} value={sbarR} onChange={(e) => setSbarR(e.target.value)} />
                                <Button type="button" className="mt-2" onClick={() => void submitHandover()}>
                                    Submit handover
                                </Button>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Recent nursing notes</p>
                            <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                                {nursingNotes.length === 0 ? (
                                    <li className="text-gray-500">No nursing notes for this encounter yet.</li>
                                ) : (
                                    nursingNotes.map((n, idx) => {
                                        const nid = n.id || '';
                                        const preview = (n.notes || '').trim();
                                        const short =
                                            preview.length > 100 ? `${preview.slice(0, 100)}…` : preview || '(empty)';
                                        const active = Boolean(nid) && selectedNursingNoteId === nid;
                                        return (
                                            <li key={nid || `nursing-${idx}`}>
                                                <button
                                                    type="button"
                                                    className={`w-full rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                                        active ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                                                    }`}
                                                    onClick={() => setSelectedNursingNoteId(active ? null : nid || null)}
                                                >
                                                    <span className="font-medium capitalize">{n.shift}</span>
                                                    <span className="text-gray-500"> · {formatNursingNoteWhen(n.createdAt)}</span>
                                                    {nid ? <span className="text-gray-400"> · …{nid.slice(-6)}</span> : null}
                                                    <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">{short}</span>
                                                </button>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                            {selectedNursingNoteId ? (
                                <div className="mt-3 rounded border border-gray-200 bg-gray-50/80 p-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
                                    <p className="text-xs font-medium text-gray-500">Full note</p>
                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-gray-900 dark:text-gray-100">
                                        {nursingNotes.find((n) => (n.id || '') === selectedNursingNoteId)?.notes || ''}
                                    </pre>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {tab === 'nursing' && !showNursing && <p className="mt-4 text-sm text-gray-500">Your role does not include nursing documentation.</p>}

                {tab === 'vitals' && (
                    <div className="mt-4 grid gap-6 lg:grid-cols-2">
                        <div>
                            <h3 className="font-medium">Record vital</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <div className="w-28 mt-1 ">
                                <NewDropdown
                        options={(['HR', 'BP', 'Temp', 'SpO2', 'RR'] as const).map((t) => ({
                            value: t,
                            label: t,
                        }))}
                        value={vitalType}
                        onChange={(v) => setVitalType(v as typeof vitalType)}
                        placeholder="Select..."
                        />
                        </div>
        
                                <Input
                                    placeholder={vitalType === 'BP' ? 'Systolic' : 'Value'}
                                    value={vitalValue}
                                    onChange={(e) => setVitalValue(e.target.value)}
                                    className="w-32"
                                />
                                {vitalType === 'BP' && (
                                    <Input
                                        placeholder="Diastolic"
                                        value={vitalSecondary}
                                        onChange={(e) => setVitalSecondary(e.target.value)}
                                        className="w-32"
                                    />
                                )}
                                <AppButton type="button" onClick={() => void submitVital()}>
                                    Save 
                                </AppButton>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">Temp uses °C; abnormal values trigger clinical alerts on the server.</p>
                        </div>
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm">Chart</span>
                                {/* <select
                                    className="rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                                    value={chartVitalType}
                                    onChange={(e) => setChartVitalType(e.target.value)}
                                >
                                    {['HR', 'BP', 'Temp', 'SpO2', 'RR'].map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select> */}
                                 <div className="w-28">
                                <NewDropdown
  options={['HR', 'BP', 'Temp', 'SpO2', 'RR'].map((t) => ({
    value: t,
    label: t,
  }))}
  value={chartVitalType}
  onChange={(v) => setChartVitalType(String(v))}
  placeholder="Select..."
/>

                            </div>
                            </div>
                            <div className="h-64 rounded border border-gray-200 p-2 dark:border-gray-700">
                                {vitals.some((v) => v.type === chartVitalType) ? (
                                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                                ) : (
                                    <p className="p-4 text-sm text-gray-500">No data for {chartVitalType}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'orders' && (
                    <div className="mt-4">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {(['medication', 'lab', 'imaging'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    className={`rounded px-3 py-1 text-sm capitalize ${orderTab === t ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                                    onClick={() => setOrderTab(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        {showOrders ? (
                            <>
                                <label className="text-xs text-gray-500">Priority</label>
                                {/* <select
                                    className="mb-2 ml-2 rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                                    value={orderPriority}
                                    onChange={(e) => setOrderPriority(e.target.value as typeof orderPriority)}
                                >
                                    <option value="routine">routine</option>
                                    <option value="urgent">urgent</option>
                                    <option value="stat">stat</option>
                                </select> */}
                                <div className="w-28">
                                <NewDropdown
                                        options={[
                                            { value: "routine", label: "routine" },
                                            { value: "urgent", label: "urgent" },
                                            { value: "stat", label: "stat" }
                                        ]}
                                        value={orderPriority}
                                        onChange={(v) => setOrderPriority(v as typeof orderPriority)}
                                        placeholder="Select..."
                                    />
                                    </div>
                                <Textarea
                                    rows={4}
                                    value={orderJson}
                                    onChange={(e) => setOrderJson(e.target.value)}
                                    placeholder='{"drugName":"...","dose":"..."} or lab/imaging fields'
                                />
                                <Button type="button" className="mt-2" onClick={() => void submitOrder()}>
                                    Place order
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-gray-500">Only ordering providers can create new orders. You may still track status if your role allows.</p>
                        )}
                        <ul className="mt-4 space-y-2">
                            {orders.map((o) => (
                                <li
                                    key={o.id}
                                    className={`flex flex-wrap items-center justify-between rounded border p-2 text-sm dark:border-gray-700 ${
                                        o.priority === 'stat' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : ''
                                    }`}
                                >
                                    <span>
                                        {o.type} · {o.status} · {o.priority}
                                    </span>
                                    <span className="flex gap-1">
                                        {o.status === 'pending' && (
                                            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void advanceOrder(o, 'accepted')}>
                                                Accept
                                            </Button>
                                        )}
                                        {o.status === 'accepted' && (
                                            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void advanceOrder(o, 'in_progress')}>
                                                In progress
                                            </Button>
                                        )}
                                        {o.status === 'in_progress' && (
                                            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void advanceOrder(o, 'completed')}>
                                                Complete
                                            </Button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {tab === 'alerts' && (
                    <ul className="mt-4 space-y-2">
                        {alerts.map((a) => (
                            <li
                                key={a.id}
                                className={`flex flex-wrap items-start justify-between rounded border p-3 dark:border-gray-700 ${
                                    a.severity === 'critical' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : ''
                                }`}
                            >
                                <div>
                                    <p className="font-medium">{a.severity.toUpperCase()}</p>
                                    <p className="text-sm">{a.message}</p>
                                    <p className="text-xs text-gray-500">{a.type}</p>
                                </div>
                                {a.status === 'open' && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 shrink-0 text-xs"
                                        onClick={async () => {
                                            try {
                                                await clinicalApi.acknowledgeAlert(a.id);
                                                toast.success('Acknowledged');
                                                await refreshAlerts();
                                            } catch {
                                                toast.error('Ack failed');
                                            }
                                        }}
                                    >
                                        Acknowledge
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default ClinicalWorkflowsPage;
