import { AlertTriangle, Check } from 'lucide-react';
import { useMemo } from 'react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';
import { computeDischargeTabCompletion, resolveFinalizeGates } from '../../../utils/dischargeReadinessUi';

export type DischargeWorkspaceTabId = 'summary' | 'checklist' | 'charges' | 'insurance' | 'billing';

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

type Props = {
    tab: DischargeWorkspaceTabId;
    setTab: React.Dispatch<React.SetStateAction<DischargeWorkspaceTabId>>;
};

export function DischargeReadinessTabStrip({ tab, setTab }: Props) {
    const { encounterId, view, snapshot } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);
    const gates = useMemo(() => resolveFinalizeGates(view, flow.gatesForUi), [view, flow.gatesForUi]);
    const tabDone = useMemo(() => computeDischargeTabCompletion(view, snapshot, gates), [view, snapshot, gates]);

    const statusMap: Record<DischargeWorkspaceTabId, boolean> = {
        summary: tabDone.summary,
        checklist: tabDone.checklist,
        charges: tabDone.charges,
        insurance: tabDone.insurance,
        billing: tabDone.billing,
    };

    return (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2 pb-1">
                {TABS.map((b) => {
                    const done = statusMap[b.id];
                    return (
                        <button
                            key={b.id}
                            type="button"
                            {...TAB_SCROLL_MARKERS[b.id]}
                            onClick={() => setTab(b.id)}
                            className={`inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition ${
                                tab === b.id
                                    ? 'relative z-[1] border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white'
                                    : 'border-transparent bg-gray-50/80 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800'
                            } ${tab === b.id ? '-mb-px' : ''}`}
                        >
                            {done ? (
                                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : (
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
                            )}
                            <span>{b.label}</span>
                            <span className="sr-only">{done ? 'Completed' : 'Pending'}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
