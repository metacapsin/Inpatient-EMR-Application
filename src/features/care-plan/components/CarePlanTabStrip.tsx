export type CarePlanTabId = 'goals' | 'interventions' | 'evaluation' | 'history';

const TABS: { id: CarePlanTabId; label: string }[] = [
    { id: 'goals', label: 'Goals' },
    { id: 'interventions', label: 'Interventions' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'history', label: 'History' },
];

type CarePlanTabStripProps = {
    tab: CarePlanTabId;
    onTabChange: (tab: CarePlanTabId) => void;
};

export function CarePlanTabStrip({ tab, onTabChange }: CarePlanTabStripProps) {
    return (
        <div
            className="mb-3 inline-flex max-w-full flex-wrap rounded-lg border border-gray-200/90 bg-gray-50/90 p-0.5 dark:border-gray-700 dark:bg-gray-900/40"
            role="tablist"
            aria-label="Care plan diagnosis sections"
        >
            {TABS.map((b) => {
                const active = tab === b.id;
                return (
                    <button
                        key={b.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onTabChange(b.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition sm:text-xs ${
                            active
                                ? 'bg-white text-primary shadow-sm ring-1 ring-primary/15 dark:bg-[#1a1816] dark:text-primary-200'
                                : 'text-gray-600 hover:bg-white/80 dark:text-gray-400 dark:hover:bg-white/5'
                        }`}
                    >
                        {b.label}
                    </button>
                );
            })}
        </div>
    );
}
