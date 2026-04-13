import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { PrnStatRecord, PrnStatType } from '../../../types/medicationManagement';
import { Loader2 } from 'lucide-react';

interface PrnStatTabProps {
    patientId: string;
    defaultGivenBy: string;
}

export function PrnStatTab({ patientId, defaultGivenBy }: PrnStatTabProps) {
    const [records, setRecords] = useState<PrnStatRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [medicationName, setMedicationName] = useState('');
    const [type, setType] = useState<PrnStatType>('PRN');
    const [indication, setIndication] = useState('');
    const [lastGivenTime, setLastGivenTime] = useState('');
    const [interval, setInterval] = useState('');
    const [maxDose, setMaxDose] = useState('');
    const [orderedTime, setOrderedTime] = useState('');
    const [urgencyLevel, setUrgencyLevel] = useState('');
    const [givenBy, setGivenBy] = useState(defaultGivenBy);
    const [doctorApproval, setDoctorApproval] = useState('');
    const [remarks, setRemarks] = useState('');

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const list = await medApi.getPrnStat(patientId);
            setRecords(list);
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load PRN/STAT history');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setGivenBy(defaultGivenBy);
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setOrderedTime(local);
    }, [defaultGivenBy, patientId]);

    function validate(): string | null {
        if (!medicationName.trim()) return 'Medication name is required';
        if (!indication.trim()) return 'Indication is required';
        if (!orderedTime) return 'Ordered time is required';
        if (!givenBy.trim()) return 'Given by is required';
        if (type === 'PRN') {
            if (!interval.trim()) return 'Interval is required for PRN';
            if (!maxDose.trim()) return 'Max dose is required for PRN';
        } else {
            if (!urgencyLevel.trim()) return 'Urgency level is required for STAT';
            if (!doctorApproval.trim()) return 'Doctor approval is required for STAT';
        }
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!patientId) return;
        const v = validate();
        if (v) {
            toast.error(v);
            return;
        }
        setSaving(true);
        try {
            const orderedIso = new Date(orderedTime).toISOString();
            const lastIso = lastGivenTime ? new Date(lastGivenTime).toISOString() : undefined;
            await medApi.postPrnStat({
                patientId,
                medicationName: medicationName.trim(),
                type,
                indication: indication.trim(),
                lastGivenTime: lastIso,
                interval: type === 'PRN' ? interval.trim() : undefined,
                maxDose: type === 'PRN' ? maxDose.trim() : undefined,
                orderedTime: orderedIso,
                urgencyLevel: type === 'STAT' ? urgencyLevel.trim() : undefined,
                givenBy: givenBy.trim(),
                doctorApproval: type === 'STAT' ? doctorApproval.trim() : undefined,
                remarks: remarks.trim() || undefined,
            });
            toast.success('PRN/STAT administration saved');
            setMedicationName('');
            setIndication('');
            setLastGivenTime('');
            if (type === 'PRN') {
                setInterval('');
                setMaxDose('');
            } else {
                setUrgencyLevel('');
                setDoctorApproval('');
            }
            setRemarks('');
            void load();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                        <select
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={type}
                            onChange={(e) => setType(e.target.value as PrnStatType)}
                        >
                            <option value="PRN">PRN</option>
                            <option value="STAT">STAT</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Medication name
                        </label>
                        <input
                            required
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={medicationName}
                            onChange={(e) => setMedicationName(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Indication</label>
                        <input
                            required
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={indication}
                            onChange={(e) => setIndication(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Ordered time
                        </label>
                        <input
                            type="datetime-local"
                            required
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={orderedTime}
                            onChange={(e) => setOrderedTime(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Last given (optional)
                        </label>
                        <input
                            type="datetime-local"
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={lastGivenTime}
                            onChange={(e) => setLastGivenTime(e.target.value)}
                        />
                    </div>
                    {type === 'PRN' ? (
                        <>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Interval
                                </label>
                                <input
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    placeholder="e.g. q4h"
                                    value={interval}
                                    onChange={(e) => setInterval(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Max dose
                                </label>
                                <input
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    placeholder="e.g. 8/day"
                                    value={maxDose}
                                    onChange={(e) => setMaxDose(e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Urgency level
                                </label>
                                <input
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    placeholder="e.g. Critical"
                                    value={urgencyLevel}
                                    onChange={(e) => setUrgencyLevel(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Doctor approval
                                </label>
                                <input
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    placeholder="Ordering provider"
                                    value={doctorApproval}
                                    onChange={(e) => setDoctorApproval(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Given by</label>
                        <input
                            required
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={givenBy}
                            onChange={(e) => setGivenBy(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Remarks</label>
                        <input
                            className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Submit'}
                </button>
            </form>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Recent entries</h3>
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading…
                    </div>
                ) : records.length === 0 ? (
                    <p className="text-sm text-gray-500">No PRN/STAT records yet.</p>
                ) : (
                    <ul className="space-y-2 text-sm">
                        {records.map((r) => (
                            <li
                                key={r.id}
                                className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
                            >
                                <span className="font-medium">{r.medicationName}</span>{' '}
                                <span className="text-gray-500">({r.type})</span> — {r.indication}
                                <div className="mt-1 text-xs text-gray-500">
                                    {new Date(r.createdAt).toLocaleString()} · {r.givenBy}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
