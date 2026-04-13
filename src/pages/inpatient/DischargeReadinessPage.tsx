import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import {
    canBillingFinancialActions,
    canNursingActions,
    canSignDischargeSummary,
    canSignPhysicianNote,
    normalizeRoles,
} from '../../features/clinical-workflows/clinicalRole';
import type { User } from '../../store/authSlice';
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
import { Button } from '../../components/ui/button';
import { DischargeSummaryTab, type DischargeSummaryTabHandle } from '../../components/ipd/discharge/DischargeSummaryTab';
import { NursingChecklistTab } from '../../components/ipd/discharge/NursingChecklistTab';
import { ChargeCaptureTab } from '../../components/ipd/discharge/ChargeCaptureTab';
import { EligibilityTab } from '../../components/ipd/discharge/EligibilityTab';
import { BillingTab, type BillingTabHandle } from '../../components/ipd/discharge/BillingTab';

const selectClass =
    'h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

type TabId = 'summary' | 'checklist' | 'charges' | 'insurance' | 'billing';

function providerSignUserIdFromUser(user: User | null): string {
    if (!user) return '';
    const raw = user.id ?? (user as { _id?: unknown })._id;
    if (raw == null) return '';
    return String(raw).trim();
}

function providerDisplayNameFromUser(user: User | null): string {
    if (!user) return '';
    const first = typeof user.firstName === 'string' ? user.firstName.trim() : '';
    const last = typeof user.lastName === 'string' ? user.lastName.trim() : '';
    const fromParts = [first, last].filter(Boolean).join(' ');
    if (fromParts) return fromParts;
    for (const key of ['fullName', 'name', 'displayName', 'username'] as const) {
        const v = user[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return typeof user.email === 'string' ? user.email.trim() : '';
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

export default function DischargeReadinessPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';
    const encounterId = searchParams.get('encounterId') || '';

    const authRole = useSelector((s: IRootState) => s.auth.role);
    const user = useSelector((s: IRootState) => s.auth.user);
    const rolesNorm = useMemo(() => normalizeRoles(authRole, user), [authRole, user]);
    const canPhysician = canSignPhysicianNote(rolesNorm);
    const providerSignUserId = useMemo(() => providerSignUserIdFromUser(user), [user]);
    const canSignDischarge = canSignDischargeSummary(rolesNorm) && Boolean(providerSignUserId);
    const canNursing = canNursingActions(rolesNorm);
    const canBilling = canBillingFinancialActions(rolesNorm);

    const [tab, setTab] = useState<TabId>('summary');
    const [view, setView] = useState<DischargeReadinessView | null>(null);
    const [loading, setLoading] = useState(false);
    const [validationMessages, setValidationMessages] = useState<string[] | null>(null);
    const [checklistHighlight, setChecklistHighlight] = useState(false);

    const summaryTabRef = useRef<DischargeSummaryTabHandle>(null);
    const billingTabRef = useRef<BillingTabHandle>(null);

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
                    <select
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
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Encounter</label>
                    <select
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
                    </select>
                    {patientId && !encountersLoading && encounters.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            No active encounter for this patient. You can still open this page with an encounter id in the URL, or set{' '}
                            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">VITE_USE_MOCK_DISCHARGE_READINESS=true</code> for
                            offline demo data.
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
                        Choose a patient and an <strong>active</strong> inpatient encounter, or pass{' '}
                        <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">encounterId</code> in the query string. With the real API,
                        the encounter must exist on the server. This hub covers discharge summary, nursing checklist, charges, insurance
                        eligibility, and claim preparation — without changing the separate ADT discharge action on the dashboard.
                    </p>
                    {renderPatientEncounterForm()}
                </div>
            </div>
        );
    }

    const eid = encounterId.trim();

    const runCheckErrors = useCallback(async () => {
        if (!view) return;
        const [sOk, bOk] = await Promise.all([
            summaryTabRef.current?.validate() ?? Promise.resolve(true),
            billingTabRef.current?.validate() ?? Promise.resolve(true),
        ]);
        const incomplete = view.checklist.filter((t) => t.blocksDischarge && !t.completed);
        const checklistOk = incomplete.length === 0;
        setChecklistHighlight(!checklistOk);

        const msgs: string[] = [];
        if (!sOk) msgs.push('Discharge summary has incomplete or invalid required fields.');
        if (!bOk) msgs.push('Principal ICD-10-CM is missing or not a valid code (e.g. J18.9).');
        if (!checklistOk) msgs.push(`${incomplete.length} required checklist item(s) are not completed.`);
        setValidationMessages(msgs.length ? msgs : null);

        const scrollAfterTab = () => {
            requestAnimationFrame(() => {
                if (!sOk) {
                    document
                        .querySelector<HTMLElement>('[data-discharge-summary-tab] [aria-invalid="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (!checklistOk) {
                    document
                        .querySelector<HTMLElement>('[data-nursing-checklist-tab] li.border-red-500')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (!bOk) {
                    document
                        .querySelector<HTMLElement>('[data-billing-tab] [aria-invalid="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        };

        if (!sOk) {
            setTab('summary');
            setTimeout(scrollAfterTab, 80);
        } else if (!checklistOk) {
            setTab('checklist');
            setTimeout(scrollAfterTab, 80);
        } else if (!bOk) {
            setTab('billing');
            setTimeout(scrollAfterTab, 80);
        } else {
            toast.success('No validation errors found');
        }
    }, [view]);

    const validateAllSignBlockers = useCallback(async (): Promise<boolean> => {
        if (!view) return false;
        const [sOk, bOk] = await Promise.all([
            summaryTabRef.current?.validate() ?? Promise.resolve(true),
            billingTabRef.current?.validate() ?? Promise.resolve(true),
        ]);
        const incomplete = view.checklist.filter((t) => t.blocksDischarge && !t.completed);
        const checklistOk = incomplete.length === 0;
        const msgs: string[] = [];
        if (!sOk) msgs.push('Discharge summary has incomplete or invalid required fields.');
        if (!bOk) msgs.push('Principal ICD-10-CM is missing or not a valid code (e.g. J18.9).');
        if (!checklistOk) msgs.push(`${incomplete.length} required checklist item(s) are not completed.`);

        const scrollAfterTab = () => {
            requestAnimationFrame(() => {
                if (!sOk) {
                    document
                        .querySelector<HTMLElement>('[data-discharge-summary-tab] [aria-invalid="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (!checklistOk) {
                    document
                        .querySelector<HTMLElement>('[data-nursing-checklist-tab] li.border-red-500')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (!bOk) {
                    document
                        .querySelector<HTMLElement>('[data-billing-tab] [aria-invalid="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        };

        if (msgs.length) {
            setValidationMessages(msgs);
            toast.error('Resolve all blockers before signing the discharge summary.');
            if (!sOk) {
                setTab('summary');
                setTimeout(scrollAfterTab, 80);
            } else if (!checklistOk) {
                setTab('checklist');
                setTimeout(scrollAfterTab, 80);
            } else if (!bOk) {
                setTab('billing');
                setTimeout(scrollAfterTab, 80);
            }
            return false;
        }
        setValidationMessages(null);
        return true;
    }, [view]);

    const dischargeSignDisabledExplanation = useMemo(() => {
        if (!view || view.summary.status === 'signed') return null;
        if (!canSignDischargeSummary(rolesNorm)) {
            return 'Only a provider can sign the discharge summary.';
        }
        if (!providerSignUserId) {
            return 'Your account has no provider user id; signing is disabled. Contact your administrator.';
        }
        return null;
    }, [view, rolesNorm, providerSignUserId]);

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
                        <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-2 dark:border-gray-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2">
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
                            <Button type="button" variant="outline" className="shrink-0" onClick={() => void runCheckErrors()}>
                                Check errors
                            </Button>
                        </div>

                        {validationMessages?.length ? (
                            <div
                                className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                                role="alert"
                            >
                                <div className="font-medium">Validation</div>
                                <ul className="mt-1 list-inside list-disc space-y-0.5">
                                    {validationMessages.map((m, i) => (
                                        <li key={`${i}-${m}`}>{m}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        <div className={tab === 'summary' ? '' : 'hidden'} aria-hidden={tab !== 'summary'}>
                            <DischargeSummaryTab
                                ref={summaryTabRef}
                                summary={view.summary}
                                canEdit={canPhysician}
                                canSign={canSignDischarge}
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
                                    if (!canSignDischargeSummary(rolesNorm)) {
                                        toast.error('Only a provider can sign the discharge summary.');
                                        return false;
                                    }
                                    const signedBy = providerSignUserId;
                                    if (!signedBy) {
                                        toast.error('Provider identity is missing; cannot sign.');
                                        return false;
                                    }
                                    if (!(await validateAllSignBlockers())) return false;

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
                                highlightIncompleteRequired={checklistHighlight}
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
                            />
                        </div>

                        <div className={tab === 'insurance' ? '' : 'hidden'} aria-hidden={tab !== 'insurance'}>
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
                                    toast.success('Eligibility check completed');
                                    return true;
                                }}
                            />
                        </div>

                        <div className={tab === 'billing' ? '' : 'hidden'} aria-hidden={tab !== 'billing'}>
                            <BillingTab
                                ref={billingTabRef}
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
                                    toast.success('Claim submitted');
                                    return true;
                                }}
                            />
                        </div>
                    </div>
                </>
            ) : !loading ? (
                <div className="panel p-6 text-sm text-red-600">Could not load readiness for this encounter.</div>
            ) : null}
        </div>
    );
}
