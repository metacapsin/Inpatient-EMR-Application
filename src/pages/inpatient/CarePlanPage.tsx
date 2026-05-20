import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import type { User } from '../../store/authSlice';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { getPatientsList, type PatientListItem } from '../../services/patient.service';
import { listActiveEncounters, type ActiveEncounterRow } from '../../services/adt.service';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { CarePlanProvider } from '../../features/care-plan/state/CarePlanContext';
import { CarePlanWorksurface } from '../../features/care-plan/components/CarePlanWorksurface';
import { CarePlanSkeleton } from '../../features/care-plan/components/CarePlanSkeleton';
import { useCarePlan } from '../../features/care-plan/state/CarePlanContext';

function formatEncounterLabel(enc: ActiveEncounterRow): string {
    const idTail = enc.id.length > 8 ? enc.id.slice(-8) : enc.id;
    const name = enc.patientName ? String(enc.patientName) : '';
    return name ? `${name} · …${idTail}` : `…${idTail}`;
}

function reviewerFromUser(user: User | null): { id: string; name: string } {
    if (!user) return { id: 'staff', name: 'Staff' };
    const first = String(user.firstName || '').trim();
    const last = String(user.lastName || '').trim();
    const name = [first, last].filter(Boolean).join(' ') || String(user.email || user.userName || 'Staff');
    return { id: String(user.id || user.userName || 'staff'), name };
}

function tenantIdFromUser(user: User | null): string {
    try {
        const raw = localStorage.getItem('user');
        if (raw) {
            const u = JSON.parse(raw) as { tenant?: { id?: string }; tenantId?: string };
            const t = String(u.tenant?.id ?? u.tenantId ?? '').trim();
            if (t) return t;
        }
    } catch {
        /* ignore */
    }
    return String(user?.tenant?.id ?? (user as { tenantId?: string })?.tenantId ?? 'tenant-default').trim();
}

function CarePlanLoaded({
    patientName,
    mrn,
    encounterLabel,
}: {
    patientName: string;
    mrn: string;
    encounterLabel: string;
}) {
    const { loading } = useCarePlan();
    if (loading) return <CarePlanSkeleton />;
    return <CarePlanWorksurface patientName={patientName} mrn={mrn} encounterLabel={encounterLabel} />;
}

function CarePlanContextShell({
    patientId,
    encounterId,
    patientName,
    mrn,
    encounterLabel,
    reviewer,
    tenantId,
    flowsheetSignals,
}: {
    patientId: string;
    encounterId: string;
    patientName: string;
    mrn: string;
    encounterLabel: string;
    reviewer: { id: string; name: string };
    tenantId: string;
    flowsheetSignals?: { highFallRisk?: boolean; lowBraden?: boolean; painScoreOver7?: boolean };
}) {
    return (
        <CarePlanProvider
            patientId={patientId}
            encounterId={encounterId}
            tenantId={tenantId}
            reviewer={reviewer}
            flowsheetSignals={flowsheetSignals}
        >
            <CarePlanLoaded patientName={patientName} mrn={mrn} encounterLabel={encounterLabel} />
        </CarePlanProvider>
    );
}

export default function CarePlanPage() {
    const navigate = useNavigate();
    const params = useParams<{ patientId?: string; encounterId?: string }>();
    const [searchParams] = useSearchParams();
    const user = useSelector((s: IRootState) => s.auth.user);

    const routePatientId = params.patientId?.trim() || searchParams.get('patientId')?.trim() || '';
    const routeEncounterId = params.encounterId?.trim() || searchParams.get('encounterId')?.trim() || '';

    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [encounters, setEncounters] = useState<ActiveEncounterRow[]>([]);
    const [encountersLoading, setEncountersLoading] = useState(false);

    const [pickPatientId, setPickPatientId] = useState(routePatientId);
    const [pickEncounterId, setPickEncounterId] = useState(routeEncounterId);

    const reviewer = useMemo(() => reviewerFromUser(user), [user]);
    const tenantId = useMemo(() => tenantIdFromUser(user), [user]);

    const flowsheetSignals = useMemo(() => {
        const highFallRisk = searchParams.get('highFallRisk') === '1';
        const lowBraden = searchParams.get('lowBraden') === '1';
        const painScoreOver7 = searchParams.get('painScoreOver7') === '1';
        if (!highFallRisk && !lowBraden && !painScoreOver7) return undefined;
        return { highFallRisk, lowBraden, painScoreOver7 };
    }, [searchParams]);

    useEffect(() => {
        let cancelled = false;
        setPatientsLoading(true);
        void getPatientsList({ page: 1, limit: 500, status: 'active', sortBy: 'patient', sortOrder: 'asc' })
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
        if (!pickPatientId) {
            setEncounters([]);
            return;
        }
        let cancelled = false;
        setEncountersLoading(true);
        void listActiveEncounters({ patientId: pickPatientId })
            .then((res) => {
                if (cancelled) return;
                if (res.ok) setEncounters(res.data);
                else toast.error(res.message);
            })
            .finally(() => {
                if (!cancelled) setEncountersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [pickPatientId]);

    useEffect(() => {
        if (routePatientId) setPickPatientId(routePatientId);
        if (routeEncounterId) setPickEncounterId(routeEncounterId);
    }, [routePatientId, routeEncounterId]);

    const selectedPatient = patients.find((p) => p.id === pickPatientId);
    const patientName = selectedPatient?.name || 'Patient';
    const mrn = selectedPatient?.mrn || '—';
    const encounterLabel = pickEncounterId
        ? pickEncounterId.length > 10
            ? `…${pickEncounterId.slice(-8)}`
            : pickEncounterId
        : '—';

    if (routePatientId && routeEncounterId) {
        return (
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <CarePlanContextShell
                    patientId={routePatientId}
                    encounterId={routeEncounterId}
                    patientName={patientName}
                    mrn={mrn}
                    encounterLabel={encounterLabel}
                    reviewer={reviewer}
                    tenantId={tenantId}
                    flowsheetSignals={flowsheetSignals}
                />
            </div>
        );
    }

    const openPlan = () => {
        if (!pickPatientId || !pickEncounterId) {
            toast.error('Select patient and active encounter');
            return;
        }
        const q = searchParams.toString();
        const suffix = q ? `?${q}` : '';
        navigate(
            `/app/inpatient/care-plan/${encodeURIComponent(pickPatientId)}/${encodeURIComponent(pickEncounterId)}${suffix}`
        );
    };

    return (
        <div className="space-y-4 p-4">
            <div className="panel overflow-hidden rounded-lg border border-gray-200/80 bg-white p-6 shadow-none dark:border-gray-700/80 dark:bg-[#0c0a08]/40">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Structured Care Plan</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                    Select an inpatient patient and active encounter to open the interdisciplinary NANDA-based care plan for
                    this admission.
                </p>
                <div className="mt-4 grid max-w-2xl gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Patient</label>
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={patientsLoading ? 'Loading…' : 'Select patient…'}
                            disabled={patientsLoading}
                            value={pickPatientId}
                            options={patients.map((p) => ({
                                value: p.id,
                                label: `${p.name}${p.mrn ? ` · MRN ${p.mrn}` : ''}`,
                                keywords: `${p.name} ${p.mrn} ${p.id}`,
                            }))}
                            onChange={(v) => {
                                setPickPatientId(String(v));
                                setPickEncounterId('');
                            }}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Encounter</label>
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={
                                !pickPatientId
                                    ? 'Select patient first'
                                    : encountersLoading
                                      ? 'Loading…'
                                      : 'Select encounter…'
                            }
                            disabled={!pickPatientId || encountersLoading}
                            value={pickEncounterId}
                            options={encounters.map((e) => ({
                                value: e.id,
                                label: formatEncounterLabel(e),
                                keywords: `${e.id} ${e.patientName || ''}`,
                            }))}
                            onChange={(v) => setPickEncounterId(String(v))}
                        />
                    </div>
                </div>
                <button
                    type="button"
                    className="btn btn-primary mt-4 inline-flex items-center gap-2"
                    onClick={openPlan}
                >
                    Open care plan
                </button>
            </div>
        </div>
    );
}

/** Facesheet redirect helper — use as route element. */
export function CarePlanFacesheetRedirect() {
    const { id } = useParams<{ id: string }>();
    const patientId = id?.trim() || '';
    const encounter = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = encounter?.encounterId?.trim();
    if (!patientId) return <Navigate to="/app/inpatient/care-plan" replace />;
    if (!encounterId) {
        return (
            <div className="p-4 text-sm text-amber-800 dark:text-amber-200">
                No active encounter for this patient. Admit or select an active encounter from the bed board, then open Care
                Plan.
            </div>
        );
    }
    return (
        <Navigate
            to={`/app/inpatient/care-plan/${encodeURIComponent(patientId)}/${encodeURIComponent(encounterId)}`}
            replace
        />
    );
}
