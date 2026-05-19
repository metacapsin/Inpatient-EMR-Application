import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { CodeEventOutcome, CodePostEventDisposition, CloseCodeEventPayload } from '../../../types/codeEvent';
import { CODE_EVENT_DISPOSITIONS, CODE_EVENT_OUTCOMES } from '../constants/codeEventOptions';
import { CODE_EVENT_SECTION_CARD_CLASS } from '../constants/codeEventLayout';
import { durationMinutesBetween, fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/codeEventFormatters';
import AppButton from '../../../components/ui/AppButton';

const fieldClass =
    'h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

type Props = {
    calledAt: string;
    onClose: (payload: CloseCodeEventPayload) => Promise<void>;
    onGenerateNote: () => Promise<string>;
    readOnly?: boolean;
    closed?: boolean;
    initial?: Partial<CloseCodeEventPayload>;
};

export function CodeCloseEventPanel({ calledAt, onClose, onGenerateNote, readOnly, closed, initial }: Props) {
    const [endTime, setEndTime] = useState(initial?.endTime ?? new Date().toISOString());
    const [outcome, setOutcome] = useState<CodeEventOutcome>(initial?.outcome ?? 'ROSC');
    const [disposition, setDisposition] = useState<CodePostEventDisposition>(initial?.postEventDisposition ?? 'ICU');
    const [debrief, setDebrief] = useState(initial?.debriefNotes ?? '');
    const [busy, setBusy] = useState(false);
    const [notePreview, setNotePreview] = useState('');

    const totalMinutes = useMemo(() => durationMinutesBetween(calledAt, endTime), [calledAt, endTime]);

    async function handleClose() {
        if (!debrief.trim()) {
            toast.error('Debrief notes are required');
            return;
        }
        setBusy(true);
        try {
            await onClose({
                endTime,
                outcome,
                postEventDisposition: disposition,
                debriefNotes: debrief.trim(),
                totalDurationMinutes: totalMinutes,
                status: 'closed',
            });
            toast.success('Event closed');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Close failed');
        } finally {
            setBusy(false);
        }
    }

    async function handleGenerateNote() {
        setBusy(true);
        try {
            const text = await onGenerateNote();
            setNotePreview(text);
            toast.success('Clinical note generated');
        } catch {
            toast.error('Could not generate note');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className={CODE_EVENT_SECTION_CARD_CLASS}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Outcome &amp; close event</h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">End documentation · debrief · disposition</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">End time</label>
                    <input
                        type="datetime-local"
                        className={fieldClass}
                        disabled={readOnly || closed}
                        value={toDatetimeLocalValue(endTime)}
                        onChange={(e) => setEndTime(fromDatetimeLocalValue(e.target.value))}
                    />
                </div>
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Total duration</label>
                    <input className={fieldClass} readOnly disabled value={`${totalMinutes} min`} />
                </div>
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Outcome</label>
                    <select
                        className={fieldClass}
                        disabled={readOnly || closed}
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value as CodeEventOutcome)}
                    >
                        {CODE_EVENT_OUTCOMES.map((o) => (
                            <option key={o} value={o}>
                                {o}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Post-event disposition</label>
                    <select
                        className={fieldClass}
                        disabled={readOnly || closed}
                        value={disposition}
                        onChange={(e) => setDisposition(e.target.value as CodePostEventDisposition)}
                    >
                        {CODE_EVENT_DISPOSITIONS.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Debrief notes</label>
                    <textarea
                        className={`${fieldClass} min-h-[5rem] py-2`}
                        rows={4}
                        disabled={readOnly || closed}
                        value={debrief}
                        onChange={(e) => setDebrief(e.target.value)}
                    />
                </div>
            </div>

            {!readOnly && !closed ? (
                <div className="mt-4 flex flex-wrap gap-2">
                    <AppButton type="button" className="!bg-white dark:!bg-gray-900" disabled={busy} onClick={() => void handleGenerateNote()}>
                        Generate clinical note
                    </AppButton>
                    <AppButton type="button" disabled={busy} onClick={() => void handleClose()}>
                        {busy ? 'Closing…' : 'Close event'}
                    </AppButton>
                </div>
            ) : (
                <AppButton type="button" className="mt-4 !bg-white dark:!bg-gray-900" disabled={busy} onClick={() => void handleGenerateNote()}>
                    Generate clinical note
                </AppButton>
            )}

            {notePreview ? (
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-800 dark:border-white/10 dark:bg-black/20 dark:text-gray-200">
                    {notePreview}
                </pre>
            ) : null}
        </section>
    );
}
