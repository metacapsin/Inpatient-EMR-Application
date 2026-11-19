import { AlertTriangle, Check, Info, MinusCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { computeDischargeTabCompletion, type DischargeTabState, type DischargeWorkspaceTabId } from '../../../utils/dischargeReadinessUi';

export type { DischargeWorkspaceTabId };

type TabDef = { id: DischargeWorkspaceTabId; label: string };

const TABS: TabDef[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'charges', label: 'Charges' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'billing', label: 'Billing' },
];

const TAB_SCROLL_MARKERS: Record<DischargeWorkspaceTabId, Record<string, string>> = {
    summary: { 'data-discharge-summary-tab': '' },
    checklist: { 'data-nursing-checklist-tab': '' },
    charges: { 'data-charges-tab': '' },
    insurance: { 'data-insurance-tab': '' },
    billing: { 'data-billing-tab': '' },
};

const STATE_LABEL: Record<DischargeTabState, string> = {
    done: 'Completed',
    pending: 'Pending',
    unavailable: 'Not available in this version',
    info: 'Informational',
};

function StateIcon({ state }: { state: DischargeTabState }) {
    if (state === 'done') return <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
    if (state === 'pending') return <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />;
    if (state === 'unavailable') return <MinusCircle className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />;
    return <Info className="h-3 w-3 shrink-0 text-sky-500" aria-hidden />;
}

type Props = {
    tab: DischargeWorkspaceTabId;
    setTab: React.Dispatch<React.SetStateAction<DischargeWorkspaceTabId>>;
};

export function DischargeReadinessTabStrip({ tab, setTab }: Props) {
    const { view } = useDischargeReadiness();
    const tabState = useMemo(() => computeDischargeTabCompletion(view), [view]);

    return (
        <div
            className="mb-2 inline-flex max-w-full flex-wrap rounded-lg border border-gray-200/90 bg-gray-50/90 p-0.5 dark:border-gray-700 dark:bg-gray-900/40"
            role="tablist"
            aria-label="Discharge workspace sections"
        >
            {TABS.map((b) => {
                const state = tabState[b.id];
                const active = tab === b.id;
                return (
                    <button
                        key={b.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        title={STATE_LABEL[state]}
                        {...TAB_SCROLL_MARKERS[b.id]}
                        onClick={() => setTab(b.id)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
                            active
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-950 dark:text-white dark:ring-gray-600'
                                : state === 'unavailable'
                                  ? 'text-gray-400 hover:bg-white/60 dark:text-gray-500'
                                  : 'text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/80 dark:hover:text-gray-100'
                        }`}
                    >
                        <StateIcon state={state} />
                        <span>{b.label}</span>
                        <span className="sr-only">{STATE_LABEL[state]}</span>
                    </button>
                );
            })}
        </div>
    );
}
