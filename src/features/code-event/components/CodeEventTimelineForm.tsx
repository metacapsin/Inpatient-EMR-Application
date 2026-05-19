import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../../store';
import { providerDisplayNameFromUser } from '../../../utils/dischargeReadinessUser';
import type { CodeEventTimelineEntry, CodeTimelineEntryType } from '../../../types/codeEvent';
import {
    CODE_TIMELINE_ENTRY_TYPES,
    JOULES_TIMELINE_TYPES,
    MEDICATION_TIMELINE_TYPES,
} from '../constants/codeEventOptions';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/codeEventFormatters';
import AppButton from '../../../components/ui/AppButton';

const fieldClass =
    'h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

type Props = {
    onSubmit: (entry: CodeEventTimelineEntry) => Promise<void>;
    busy?: boolean;
    disabled?: boolean;
};

function newTimelineId(): string {
    return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CodeEventTimelineForm({ onSubmit, busy, disabled }: Props) {
    const user = useSelector((s: IRootState) => s.auth.user);
    const enteredBy = providerDisplayNameFromUser(user) || 'Clinical user';

    const [timestamp, setTimestamp] = useState(() => new Date().toISOString());
    const [entryType, setEntryType] = useState<CodeTimelineEntryType>('Rhythm Check');
    const [medName, setMedName] = useState('');
    const [medDose, setMedDose] = useState('');
    const [medRoute, setMedRoute] = useState('');
    const [joules, setJoules] = useState('');
    const [notes, setNotes] = useState('');

    const showMed = MEDICATION_TIMELINE_TYPES.includes(entryType);
    const showJoules = JOULES_TIMELINE_TYPES.includes(entryType);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const entry: CodeEventTimelineEntry = {
            id: newTimelineId(),
            timestamp,
            entryType,
            enteredBy,
            notes: notes.trim() || undefined,
            joules: showJoules && joules ? Number(joules) : undefined,
            medication: showMed
                ? { name: medName.trim(), dose: medDose.trim(), route: medRoute.trim() }
                : undefined,
        };
        await onSubmit(entry);
        setTimestamp(new Date().toISOString());
        setNotes('');
        setMedName('');
        setMedDose('');
        setMedRoute('');
        setJoules('');
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Rapid entry</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Timestamp</label>
                    <input
                        type="datetime-local"
                        className={fieldClass}
                        value={toDatetimeLocalValue(timestamp)}
                        disabled={disabled}
                        onChange={(e) => setTimestamp(fromDatetimeLocalValue(e.target.value))}
                    />
                </div>
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Event type</label>
                    <select
                        className={fieldClass}
                        value={entryType}
                        disabled={disabled}
                        onChange={(e) => setEntryType(e.target.value as CodeTimelineEntryType)}
                    >
                        {CODE_TIMELINE_ENTRY_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
                {showMed ? (
                    <>
                        <div className="sm:col-span-2">
                            <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                Medication name
                            </label>
                            <input className={fieldClass} value={medName} disabled={disabled} onChange={(e) => setMedName(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Dose</label>
                            <input className={fieldClass} value={medDose} disabled={disabled} onChange={(e) => setMedDose(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Route</label>
                            <input className={fieldClass} value={medRoute} disabled={disabled} onChange={(e) => setMedRoute(e.target.value)} />
                        </div>
                    </>
                ) : null}
                {showJoules ? (
                    <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Joules</label>
                        <input
                            type="number"
                            min={0}
                            className={fieldClass}
                            value={joules}
                            disabled={disabled}
                            onChange={(e) => setJoules(e.target.value)}
                        />
                    </div>
                ) : null}
                <div className="sm:col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Notes</label>
                    <textarea
                        className={`${fieldClass} min-h-[4rem] py-2`}
                        rows={2}
                        value={notes}
                        disabled={disabled}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
                <div className="sm:col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Entered by</label>
                    <input className={fieldClass} value={enteredBy} readOnly disabled />
                </div>
            </div>
            <AppButton type="submit" disabled={disabled || busy}>
                {busy ? 'Saving…' : 'Add to timeline'}
            </AppButton>
        </form>
    );
}
