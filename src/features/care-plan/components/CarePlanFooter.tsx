import { format } from 'date-fns';
import AppButton from '@/components/ui/AppButton';
import { useCarePlan } from '../state/CarePlanContext';
import { CarePlanTextarea } from './CarePlanStyledFields';

export function CarePlanFooter() {
    const { plan, interdisciplinaryNotes, setInterdisciplinaryNotes, savePlan, saveState } = useCarePlan();

    const reviewedAt = plan?.lastReviewedAt ? format(new Date(plan.lastReviewedAt), 'MM/dd/yyyy HH:mm') : '—';

    return (
        <footer className="shrink-0 border-t border-gray-200/90 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0f0d0b]">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                    <CarePlanTextarea
                        fieldId="care-plan-interdisciplinary-notes"
                        label="Interdisciplinary notes"
                        value={interdisciplinaryNotes}
                        rows={2}
                        placeholder="PT/OT/MD/SW collaboration notes for this encounter…"
                        onChange={setInterdisciplinaryNotes}
                    />
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>
                            Last reviewed by{' '}
                            <strong className="text-gray-700 dark:text-gray-300">{plan?.lastReviewedByName || '—'}</strong>
                        </span>
                        <span>Last reviewed at {reviewedAt}</span>
                        <span>Version {plan?.version ?? 0}</span>
                    </div>
                </div>
                <AppButton
                    type="button"
                    className="!shrink-0"
                    disabled={saveState === 'saving'}
                    onClick={() => void savePlan()}
                >
                    {saveState === 'saving' ? 'Saving…' : 'Save care plan'}
                </AppButton>
            </div>
        </footer>
    );
}
