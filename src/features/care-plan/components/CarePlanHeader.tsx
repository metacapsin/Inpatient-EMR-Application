import { ClipboardList } from 'lucide-react';
import { useCarePlan } from '../state/CarePlanContext';
import { carePlanReviewStatus } from '../utils/goalProgress';
import { CARE_PLAN_PAGE_HEADER_CLASS } from '../constants/carePlanLayout';
type CarePlanHeaderProps = {
    patientName: string;
    mrn: string;
    encounterLabel: string;
    admissionStatus?: string;
};

const STATUS_CHIP: Record<string, string> = {
    Complete: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/50',
    'In Progress': 'bg-amber-100 text-amber-950 ring-amber-200/80 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-800/45',
    'Not Started': 'bg-gray-100 text-gray-700 ring-gray-200/80 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10',
};

const SAVE_CHIP: Record<string, string> = {
    dirty: 'bg-amber-100 text-amber-950 ring-amber-200/80 dark:bg-amber-950/35 dark:text-amber-100',
    saving: 'bg-sky-100 text-sky-900 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-100',
    saved: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-100',
    error: 'bg-rose-100 text-rose-900 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-100',
    idle: 'bg-gray-100 text-gray-700 ring-gray-200/80 dark:bg-white/10 dark:text-gray-300',
};

export function CarePlanHeader({ patientName, mrn, encounterLabel, admissionStatus = 'Active inpatient' }: CarePlanHeaderProps) {
    const { plan, saveState } = useCarePlan();
    const review = carePlanReviewStatus(plan?.diagnoses || []);

    const saveLabel =
        saveState === 'saving'
            ? 'Saving…'
            : saveState === 'dirty'
              ? 'Unsaved changes'
              : saveState === 'saved'
                ? 'Saved'
                : 'Up to date';

    return (
        <header className={`${CARE_PLAN_PAGE_HEADER_CLASS} sticky top-0 z-10 shadow-sm`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10"
                        aria-hidden
                    >
                        <ClipboardList className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Structured Care Plan</p>
                        <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white">{patientName || 'Patient'}</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span>
                                MRN <strong className="text-gray-800 dark:text-gray-200">{mrn || '—'}</strong>
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span>
                                Encounter <strong className="text-gray-800 dark:text-gray-200">{encounterLabel}</strong>
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span>{admissionStatus}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_CHIP[review] || STATUS_CHIP['Not Started']}`}
                    >
                        Review: {review}
                    </span>
                    <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${SAVE_CHIP[saveState] || SAVE_CHIP.idle}`}
                    >
                        {saveLabel}
                    </span>
                    {plan?.version ? (
                        <span className="rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                            v{plan.version}
                        </span>
                    ) : null}
                </div>
            </div>
        </header>    );
}