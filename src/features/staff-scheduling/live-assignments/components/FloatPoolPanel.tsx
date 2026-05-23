import type { FloatPoolNurse } from '../../../../types/staffing.types';
import { CertificationBadges } from './CertificationBadges';

interface FloatPoolPanelProps {
    nurses: FloatPoolNurse[];
    canManage: boolean;
    onQuickAssign?: (nurseId: string) => void;
}

export function FloatPoolPanel({ nurses, canManage, onQuickAssign }: FloatPoolPanelProps) {
    const available = nurses.filter((n) => n.available);

    return (
        <aside className="rounded-xl border border-gray-200/70 bg-white p-3 dark:border-white/[0.08] dark:bg-[#0c0a08]/30">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Float pool
                </h3>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">
                    {available.length} available
                </span>
            </div>
            {available.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No float nurses available.</p>
            ) : (
                <ul className="space-y-2">
                    {available.map((n) => (
                        <li
                            key={n.id}
                            className="flex items-start justify-between gap-2 rounded-lg border border-gray-200/60 px-2 py-1.5 dark:border-white/[0.06]"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">{n.displayName}</p>
                                <p className="text-[10px] text-gray-500">{n.role}</p>
                                <CertificationBadges certifications={n.certifications} maxVisible={2} />
                            </div>
                            {canManage && onQuickAssign ? (
                                <button
                                    type="button"
                                    className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:bg-primary/90"
                                    onClick={() => onQuickAssign(n.id)}
                                >
                                    Assign
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
