import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import NewDropdown from '../../components/ui/NewDropdown';
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
import { DischargeReadinessHeader } from '../../components/ipd/discharge/DischargeReadinessHeader';
import { DischargeSummaryTab } from '../../components/ipd/discharge/DischargeSummaryTab';
import { NursingChecklistTab } from '../../components/ipd/discharge/NursingChecklistTab';
import { ChargeCaptureTab } from '../../components/ipd/discharge/ChargeCaptureTab';
import { EligibilityTab } from '../../components/ipd/discharge/EligibilityTab';
import { BillingTab } from '../../components/ipd/discharge/BillingTab';

const selectClass =
    'h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

type TabId = 'summary' | 'checklist' | 'charges' | 'insurance' | 'billing';

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

export default function DischargeReadinessPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';
    const encounterId = searchParams.get('encounterId') || '';

    const authRole = useSelector((s: IRootState) => s.auth.role);
    const user = useSelector((s: IRootState) => s.auth.user);
    const rolesNorm = useMemo(() => normalizeRoles(authRole, user), [authRole, user]);
    const canPhysician = canSignPhysicianNote(rolesNorm);
    const canNursing = canNursingActions(rolesNorm);
    const canBilling = canBillingFinancialActions(rolesNorm);

    const [tab, setTab] = useState<TabId>('summary');
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
        if (!encounterId.trim()) {
            setView(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void fetchDischargeReadiness(encounterId.trim()).then((res) => {
            if (cancelled) return;
            setLoading(false);
            if (!res.ok) {
                toast.error(res.message);
                setView(null);
                return;
            }
            setView(res.data);
        });
        return () => {
            cancelled = true;
        };
    }, [encounterId]);

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
                    {/* <select
                        className={selectClass}
                        value={patientId}
                        disabled={patientsLoading}
                        onChange={(e) => setPatientSelection(e.target.value)}
                    >
                        <option value="">{patientsLoading ? 'Loading patients…' : 'Select patient…'}</option>
                        {patientId && !patientInList ? (
                            <option value={patientId}>Current selection (not in list) · {patientId.slice(-10)}…</option>
                        ) : null}
                        {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                                {p.mrn ? ` · MRN ${p.mrn}` : ''}
                            </option>
                        ))}
                    </select> */}
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
        label: p.mrn ? `${p.name} · MRN ${p.mrn}` : p.name,
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
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            No active encounter for this patient. You can still open this page with an encounter id in the URL for demo mock
                            data.
                        </p>
                    ) : null}
                </div>
            </div>
        );
    }

    if (!encounterId.trim()) {
        return (
            <div className="space-y-4">
                <div className="panel p-6">
                    <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Discharge &amp; billing readiness</h1>
                    <p className="mb-4 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                        Choose a patient and an <strong>active</strong> inpatient encounter, or pass <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">encounterId</code> in the query string (mock data seeds for any id). This hub covers discharge summary, nursing checklist, charges,
                        insurance eligibility, and claim preparation — without changing the separate ADT discharge action on the dashboard.
                    </p>
                    {renderPatientEncounterForm()}
                </div>
            </div>
        );
    }

    const eid = encounterId.trim();

    const tabButtons: { id: TabId; label: string }[] = [
        { id: 'summary', label: 'Summary' },
        { id: 'checklist', label: 'Checklist' },
        { id: 'charges', label: 'Charges' },
        { id: 'insurance', label: 'Insurance' },
        { id: 'billing', label: 'Billing' },
    ];

    return (
        <div className="space-y-4">
            {loading && !view ? (
                <div className="panel p-6 text-sm text-gray-500">Loading readiness…</div>
            ) : null}

            {view ? (
                <>
                    <DischargeReadinessHeader view={view} />

                    <div className="panel p-4">
                        <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
                            {tabButtons.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    className={`rounded px-3 py-1 text-sm ${
                                        tab === b.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
                                    }`}
                                    onClick={() => setTab(b.id)}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>

                        {tab === 'summary' && (
                            <DischargeSummaryTab
                                summary={view.summary}
                                canEdit={canPhysician}
                                canSign={canPhysician}
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
                                    const res = await signDischargeSummary(eid);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Discharge summary signed');
                                    return true;
                                }}
                            />
                        )}

                        {tab === 'checklist' && (
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
                        )}

                        {tab === 'charges' && (
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
                            />
                        )}

                        {tab === 'insurance' && (
                            <EligibilityTab
                                history={view.eligibilityHistory}
                                canRun={canBilling}
                                onRunCheck={async () => {
                                    const res = await runEligibilityCheck(eid);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Eligibility response recorded (mock)');
                                    return true;
                                }}
                            />
                        )}

                        {tab === 'billing' && (
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
                                    const res = await submitClaimPrep(eid);
                                    if (!res.ok) {
                                        toast.error(res.message);
                                        return false;
                                    }
                                    setView(res.data);
                                    toast.success('Claim submitted (mock)');
                                    return true;
                                }}
                            />
                        )}
                    </div>
                </>
            ) : !loading ? (
                <div className="panel p-6 text-sm text-red-600">Could not load readiness for this encounter.</div>
            ) : null}
        </div>
    );
}
