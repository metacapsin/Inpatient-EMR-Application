import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import AppButton from '@/components/ui/AppButton';
import {
    listActivePhysicians,
    recordAmaDischarge,
    recordDeath,
} from '../../../services/dischargeReadiness.service';
import type { ReadinessGate } from '../../../types/dischargeReadiness';

type Props = {
    encounterId: string;
    disposition: string;
    gates: ReadinessGate[];
    onRecorded: () => void | Promise<void>;
};

const AMA_CODE = '07';
const EXPIRED_CODE = '20';

/** Bucket C: structured AMA / deceased discharge recording — required by the server-side discharge
 * gates (gate-ama-record / gate-death-record) before the encounter can be confirmed with this disposition. */
export function AmaDeathRecordPanel({ encounterId, disposition, gates, onRecorded }: Props) {
    const [amaReason, setAmaReason] = useState('');
    const [amaRisksExplained, setAmaRisksExplained] = useState(false);
    const [amaWitness, setAmaWitness] = useState('');
    const [amaSignature, setAmaSignature] = useState('');
    const [amaSaving, setAmaSaving] = useState(false);

    const [diedAt, setDiedAt] = useState('');
    const [pronouncingId, setPronouncingId] = useState('');
    const [causeOfDeath, setCauseOfDeath] = useState('');
    const [deathSaving, setDeathSaving] = useState(false);
    const [physicians, setPhysicians] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        if (disposition !== EXPIRED_CODE) return;
        void listActivePhysicians().then((r) => {
            if (r.ok) setPhysicians(r.data);
        });
    }, [disposition]);

    if (disposition !== AMA_CODE && disposition !== EXPIRED_CODE) return null;

    const amaGate = gates.find((g) => g.id === 'gate-ama-record');
    const deathGate = gates.find((g) => g.id === 'gate-death-record');

    async function saveAma() {
        if (!amaReason.trim() || !amaWitness.trim() || !amaSignature.trim()) {
            toast.error('Reason, witness name, and patient signature are all required.');
            return;
        }
        setAmaSaving(true);
        const r = await recordAmaDischarge(encounterId, {
            reason: amaReason.trim(),
            risksExplained: amaRisksExplained,
            witnessName: amaWitness.trim(),
            patientSignature: amaSignature.trim(),
        });
        setAmaSaving(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('AMA discharge recorded');
        await onRecorded();
    }

    async function saveDeath() {
        if (!diedAt || !pronouncingId) {
            toast.error('Time of death and pronouncing physician are required.');
            return;
        }
        setDeathSaving(true);
        const r = await recordDeath(encounterId, {
            diedAt: new Date(diedAt).toISOString(),
            pronouncingPhysicianId: pronouncingId,
            causeOfDeath: causeOfDeath.trim() || undefined,
        });
        setDeathSaving(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('Death recorded');
        await onRecorded();
    }

    if (disposition === AMA_CODE) {
        return (
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    AMA discharge record {amaGate?.resolved ? '— on file' : '(required before confirm)'}
                </p>
                {amaGate?.resolved ? (
                    <p className="text-xs text-amber-900/80 dark:text-amber-100/80">Recorded. Resubmitting below will overwrite it.</p>
                ) : null}
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Reason the patient is leaving</label>
                    <Textarea className="mt-1" rows={2} value={amaReason} onChange={(e) => setAmaReason(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={amaRisksExplained} onChange={(e) => setAmaRisksExplained(e.target.checked)} />
                    Risks of leaving were explained to the patient
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Witness name</label>
                        <Input className="mt-1" value={amaWitness} onChange={(e) => setAmaWitness(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Patient signature (typed attestation)</label>
                        <Input className="mt-1" value={amaSignature} onChange={(e) => setAmaSignature(e.target.value)} placeholder="Type the patient's full name to attest" />
                    </div>
                </div>
                <AppButton type="button" disabled={amaSaving} onClick={() => void saveAma()}>
                    {amaSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Saving…</>) : 'Save AMA record'}
                </AppButton>
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-lg border border-gray-400 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Death record {deathGate?.resolved ? '— on file' : '(required before confirm)'}
            </p>
            {deathGate?.resolved ? (
                <p className="text-xs text-gray-600 dark:text-gray-400">Recorded. Resubmitting below will overwrite it.</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Time of death</label>
                    <Input type="datetime-local" className="mt-1" value={diedAt} onChange={(e) => setDiedAt(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Pronouncing physician</label>
                    <select
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        value={pronouncingId}
                        onChange={(e) => setPronouncingId(e.target.value)}
                    >
                        <option value="">Select…</option>
                        {physicians.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cause of death (optional)</label>
                <Textarea className="mt-1" rows={2} value={causeOfDeath} onChange={(e) => setCauseOfDeath(e.target.value)} />
            </div>
            <AppButton type="button" disabled={deathSaving} onClick={() => void saveDeath()}>
                {deathSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Saving…</>) : 'Save death record'}
            </AppButton>
        </div>
    );
}
