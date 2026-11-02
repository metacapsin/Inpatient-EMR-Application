import { memo } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { acknowledgeResult } from '../../services/labs.service';
import type { IpdCriticalResult } from '../../types/ipdDashboard';

type Props = { results: IpdCriticalResult[]; canAcknowledge: boolean; onChanged: () => void };

/** Unacknowledged critical lab results — a physician/nurse must acknowledge each one. */
function IpdCriticalResultsStripInner({ results, canAcknowledge, onChanged }: Props) {
    if (results.length === 0) return null;
    async function ack(r: IpdCriticalResult) {
        const res = await acknowledgeResult(r.id);
        if (!res.ok) return toast.error(res.message);
        toast.success(`${r.testName} for ${r.patientName} acknowledged`);
        onChanged();
    }
    return (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/25 sm:px-3.5" role="alert">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-800 dark:text-red-200">
                <AlertOctagon className="h-3.5 w-3.5" aria-hidden /> Unacknowledged critical results ({results.length})
            </p>
            <ul className="flex flex-wrap gap-2">
                {results.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs dark:border-red-900/40 dark:bg-[#1c1916]">
                        <Link to={`/app/patients/${r.patientId}/lab-orders`} className="font-semibold text-gray-900 hover:underline dark:text-white">{r.patientName}</Link>
                        <span className="text-gray-600 dark:text-gray-300">{r.testName} <span className="font-bold text-red-700 dark:text-red-300">{r.value}</span></span>
                        <span className="text-gray-400">{r.resultedAt ? new Date(r.resultedAt).toLocaleTimeString() : ''}</span>
                        {canAcknowledge ? <button type="button" className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700" onClick={() => void ack(r)}>Acknowledge</button> : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
export const IpdCriticalResultsStrip = memo(IpdCriticalResultsStripInner);
