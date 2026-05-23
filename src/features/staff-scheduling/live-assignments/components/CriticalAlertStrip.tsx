import type { StaffingAlertItem } from '../../../../types/staffing.types';

interface CriticalAlertStripProps {
    alerts: StaffingAlertItem[];
    onAction?: (alertId: string) => void;
}

const SEVERITY_CLASS: Record<StaffingAlertItem['severity'], string> = {
    critical: 'border-red-200/80 bg-red-50 text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100',
    warning: 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
    info: 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100',
};

export function CriticalAlertStrip({ alerts, onAction }: CriticalAlertStripProps) {
    if (alerts.length === 0) {
        return (
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                Unit staffing within safe ratios for current shift.
            </div>
        );
    }

    return (
        <div className="scrollbar-hide flex flex-nowrap gap-2 overflow-x-auto pb-0.5">
            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${SEVERITY_CLASS[alert.severity]}`}
                >
                    <span>{alert.message}</span>
                    {alert.actionLabel && onAction ? (
                        <button
                            type="button"
                            onClick={() => onAction(alert.id)}
                            className="rounded-md bg-white/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-white/90 dark:bg-black/20 dark:hover:bg-black/30"
                        >
                            {alert.actionLabel}
                        </button>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
