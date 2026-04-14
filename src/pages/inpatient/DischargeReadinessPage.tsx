import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import type { User } from '../../store/authSlice';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
    canBillingFinancialActions,
    canNursingActions,
    canSignPhysicianNote,
    normalizeRoles,
} from '../../features/clinical-workflows/clinicalRole';
import { getPatientsList, type PatientListItem } from '../../services/patient.service';
import { listActiveEncounters, type ActiveEncounterRow } from '../../services/adt.service';
import {
    addChargeLine,
    deleteChargeLine,
    fetchDischargeReadiness,
    runEligibilityCheck,
    saveDischargeSummaryDraft,
    signDischargeSummary,
    submitClaimPrep,
    updateChargeLine,
    updateChecklistTask,
    updateClaimPrep,
} from '../../services/dischargeReadiness.service';
import type { DischargeReadinessView } from '../../types/dischargeReadiness';
import { DischargeReadinessProvider } from '../../contexts/DischargeReadinessContext';
import { DischargeReadinessHeader } from '../../components/ipd/discharge/DischargeReadinessHeader';
import { DischargeReadinessCommandStrip } from '../../components/ipd/discharge/DischargeReadinessCommandStrip';
import { DischargeReadinessBlockingAlert } from '../../components/ipd/discharge/DischargeReadinessBlockingAlert';
import {
    DischargeReadinessTabStrip,
    type DischargeWorkspaceTabId,
} from '../../components/ipd/discharge/DischargeReadinessTabStrip';
import { DischargeSummaryTab } from '../../components/ipd/discharge/DischargeSummaryTab';
import { NursingChecklistTab } from '../../components/ipd/discharge/NursingChecklistTab';
import { ChargeCaptureTab } from '../../components/ipd/discharge/ChargeCaptureTab';
import { EligibilityTab } from '../../components/ipd/discharge/EligibilityTab';
import { BillingTab } from '../../components/ipd/discharge/BillingTab';
import { providerDisplayNameFromUser, providerSignUserIdFromUser } from '../../utils/dischargeReadinessUser';

function encounterSearchKeywords(enc: ActiveEncounterRow): string {
    const bed = enc.currentBedId != null ? String(enc.currentBedId) : '';
    const name = enc.patientName != null ? String(enc.patientName) : '';
    const ts = enc.admissionTimestamp != null ? String(enc.admissionTimestamp) : '';
    return [enc.id, name, bed, ts].filter(Boolean).join(' ');
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
    const name = enc.patientName ? String(enc.patientName) : '';
    return name ? `${name} · …${idTail} · ${ts || bed}` : `…${idTail} · ${ts || bed}`;
}

function DischargeReadinessLoaded({
    eid,
    view,
    setView,
    tab,
    setTab,
    canPhysician,
    providerSignUserId,
    dischargeSignDisabledExplanation,
    rolesNorm,
    user,
    canNursing,
    canBilling,
}: {
    eid: string;
    view: DischargeReadinessView;
    setView: Dispatch<SetStateAction<DischargeReadinessView | null>>;
    tab: DischargeWorkspaceTabId;
    setTab: React.Dispatch<React.SetStateAction<DischargeWorkspaceTabId>>;
    canPhysician: boolean;
    providerSignUserId: string;
    dischargeSignDisabledExplanation: string | null;
    rolesNorm: ReturnType<typeof normalizeRoles>;
    user: User | null;
    canNursing: boolean;
    canBilling: boolean;
}) {
    return (
        <DischargeReadinessProvider encounterId={eid} view={view} setView={setView}>
            <div className="space-y-4">
                <div className="panel p-6">
                    <DischargeReadinessCommandStrip />
                </div>

                <div className="panel space-y-4 p-4 sm:p-6">
                    <DischargeReadinessBlockingAlert />
                    <DischargeReadinessHeader view={view} />

                    <div className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-900/50 sm:p-8">
                    <div className="mb-2">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Discharge workspace</h2>
                        <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                            Review documentation, operational tasks, charges, eligibility, and billing. Finalize only when all gates are
                            satisfied.
                        </p>
                    </div>

                    <DischargeReadinessTabStrip tab={tab} setTab={setTab} />

                    <div className="mt-8 space-y-8">
                        <div className={tab === 'summary' ? '' : 'hidden'} aria-hidden={tab !== 'summary'}>
                            <DischargeSummaryTab
                                summary={view.summary}
                                canEdit={canPhysician}
                                canSign={canPhysician}
                                signDisabledExplanation={dischargeSignDisabledExplanation}
                                onSaveDraft={async (partial) => {
                                    const res = await saveDischargeSummaryDraft(eid, partial);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Summary saved');
                                    return true;
                                }}
                                onSign={async () => {
                                    if (!canSignPhysicianNote(rolesNorm)) {
                                        toast.error('Only a provider can sign the discharge summary.');
                                        return false;
                                    }
                                    const signedBy = providerSignUserId;
                                    if (!signedBy) {
                                        toast.error('Provider identity is missing; cannot sign.');
                                        return false;
                                    }
                                    const signedByName = providerDisplayNameFromUser(user);
                                    const payload = {
                                        encounterId: eid,
                                        signedBy,
                                        signedByName,
                                        signedAt: new Date().toISOString(),
                                    };
                                    const res = await signDischargeSummary(eid, payload);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    const rawName = signedByName.trim() || 'Provider';
                                    const withDr = /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`;
                                    toast.success(`Signed by ${withDr} on ${new Date(payload.signedAt).toLocaleString()}`);
                                    return true;
                                }}
                            />
                        </div>

                        <div className={tab === 'checklist' ? '' : 'hidden'} aria-hidden={tab !== 'checklist'}>
                            <NursingChecklistTab
                                tasks={view.checklist}
                                canEdit={canNursing}
                                onUpdateTask={async (taskId, patch) => {
                                    const res = await updateChecklistTask(eid, taskId, patch);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    return true;
                                }}
                            />
                        </div>

                        <div className={tab === 'charges' ? '' : 'hidden'} aria-hidden={tab !== 'charges'}>
                            <ChargeCaptureTab
                                charges={view.charges}
                                canEdit={canBilling}
                                onUpdateCharge={async (chargeId, patch) => {
                                    const res = await updateChargeLine(eid, chargeId, patch);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    return true;
                                }}
                                onAddCharge={async (line) => {
                                    const res = await addChargeLine(eid, line);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Charge added');
                                    return true;
                                }}
                                onDeleteCharge={async (chargeId) => {
                                    const res = await deleteChargeLine(eid, chargeId);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Charge removed');
                                    return true;
                                }}
                            />
                        </div>

                        <div className={tab === 'insurance' ? '' : 'hidden'} aria-hidden={tab !== 'insurance'}>
                            <EligibilityTab
                                history={view.eligibilityHistory}
                                canRun={canBilling}
                                onRunCheck={async () => {
                                    const res = await runEligibilityCheck(eid);
                                    if (!res.ok) {
                                        return { ok: false as const, message: res.message };
                                    }
                                    setView(res.data);
                                    toast.success('Eligibility check completed');
                                    return { ok: true as const };
                                }}
                            />
                        </div>

                        <div className={tab === 'billing' ? '' : 'hidden'} aria-hidden={tab !== 'billing'}>
                            <BillingTab
                                claimPrep={view.claimPrep}
                                billingReady={view.billingReady}
                                canEdit={canBilling}
                                onSaveClaimPrep={async (patch) => {
                                    const res = await updateClaimPrep(eid, patch);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Claim prep updated');
                                    return true;
                                }}
                                onSubmitClaim={async () => {
                                    try {
                                        const res = await submitClaimPrep(eid);
                                        if (!res.ok) {
                                            toast.error(res.message);
                                            return false;
                                        }
                                        setView(res.data);
                                        toast.success('Claim submitted');
                                        return true;
                                    } catch {
                                        toast.error('Could not submit claim. Please try again.');
                                        return false;
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </DischargeReadinessProvider>
    );
}

export default function DischargeReadinessPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';
    const encounterId = searchParams.get('encounterId') || '';
    const eid = encounterId.trim();

    const authRole = useSelector((s: IRootState) => s.auth.role);
    const user = useSelector((s: IRootState) => s.auth.user);
    const rolesNorm = useMemo(() => normalizeRoles(authRole, user), [authRole, user]);
    const canPhysician = canSignPhysicianNote(rolesNorm);
    const canNursing = canNursingActions(rolesNorm);
    const canBilling = canBillingFinancialActions(rolesNorm);
    const providerSignUserId = useMemo(() => providerSignUserIdFromUser(user), [user]);

    const [tab, setTab] = useState<DischargeWorkspaceTabId>('summary');
    const [view, setView] = useState<DischargeReadinessView | null>(null);
    const [loading, setLoading] = useState(false);

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

    useEffect(() => {
        if (!eid) {
            setView(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void fetchDischargeReadiness(eid)
            .then((res) => {
                if (cancelled) return;
                if (!res.ok) {
                    toast.error(res.message);
                    setView(null);
                    return;
                }
                setView(res.data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [eid]);

    useEffect(() => {
        setTab('summary');
    }, [eid]);

    const patientInList = patientId && patients.some((p) => p.id === patientId);
    const encounterInList = encounterId && encounters.some((e) => e.id === encounterId);

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

    function renderPatientEncounterForm() {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Patient</label>
                    <div className="w-full">
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={patientsLoading ? 'Loading patients…' : 'Select patient…'}
                            placeholder="Select patient…"
                            disabled={patientsLoading}
                            value={patientId || ''}
                            pinnedOptions={
                                patientId && !patientInList
                                    ? [
                                          {
                                              value: patientId,
                                              label: `Current selection (not in list) · ${patientId.slice(-10)}…`,
                                              keywords: patientId,
                                          },
                                      ]
                                    : []
                            }
                            options={patients.map((p) => ({
                                value: p.id,
                                label: p.mrn ? `${p.name} · MRN ${p.mrn}` : p.name,
                                keywords: `${p.name} ${p.mrn || ''} ${p.id}`,
                            }))}
                            onChange={(v) => setPatientSelection(String(v))}
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Encounter</label>

                    <div className="w-full">
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={
                                !patientId
                                    ? 'Select a patient first…'
                                    : encountersLoading
                                      ? 'Loading encounters…'
                                      : 'Select active encounter…'
                            }
                            placeholder="Select active encounter…"
                            disabled={!patientId || encountersLoading}
                            value={encounterId || ''}
                            pinnedOptions={
                                encounterId && !encounterInList && patientId
                                    ? [
                                          {
                                              value: encounterId,
                                              label: `Current selection · …${encounterId.slice(-8)}`,
                                              keywords: encounterId,
                                          },
                                      ]
                                    : []
                            }
                            options={encounters.map((enc) => ({
                                value: enc.id,
                                label: formatEncounterLabel(enc),
                                keywords: encounterSearchKeywords(enc),
                            }))}
                            onChange={(v) => setEncounterSelection(String(v))}
                        />
                    </div>
                    {patientId && !encountersLoading && encounters.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            No active encounter for this patient. You can still open this page with an encounter id in the URL for demo mock
                            data.
                        </p>
                    ) : null}
                </div>
            </div>
        );
    }

    const dischargeSignDisabledExplanation = useMemo(() => {
        if (!view || view.summary.status === 'signed') return null;
        if (!canSignPhysicianNote(rolesNorm)) {
            return 'Only a provider can sign the discharge summary.';
        }
        if (!providerSignUserId) {
            return 'Your account has no provider user id; signing is disabled. Contact your administrator.';
        }
        return null;
    }, [view, rolesNorm, providerSignUserId]);

    if (!eid) {
        return (
            <div className="space-y-4">
                <div className="panel p-8">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Discharge &amp; billing readiness</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                        Choose a patient and an <strong>active</strong> inpatient encounter, or pass{' '}
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">encounterId</code> in the query string.
                        This hub covers discharge summary, nursing checklist, charges, insurance eligibility, claim preparation, and the{' '}
                        <strong>only</strong> authorized ADT discharge finalization for the encounter.
                    </p>
                    <div className="mt-8">{renderPatientEncounterForm()}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {loading && !view ? (
                <div className="flex items-center gap-3 py-8 text-sm text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
                    Loading readiness…
                </div>
            ) : null}

            {view ? (
                <DischargeReadinessLoaded
                    eid={eid}
                    view={view}
                    setView={setView}
                    tab={tab}
                    setTab={setTab}
                    canPhysician={canPhysician}
                    providerSignUserId={providerSignUserId}
                    dischargeSignDisabledExplanation={dischargeSignDisabledExplanation}
                    rolesNorm={rolesNorm}
                    user={user}
                    canNursing={canNursing}
                    canBilling={canBilling}
                />
            ) : !loading ? (
                <div className="panel p-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                        Could not load readiness for this encounter.
                    </div>
                </div>
            ) : null}
        </div>
    );
}
