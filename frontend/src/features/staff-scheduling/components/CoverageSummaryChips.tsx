import { useState } from 'react';
import { ActionIconTooltip } from '../../../components/ui/ActionIconTooltip';
import type { CoverageSummary } from '../../../types/staffScheduling.types';

interface CoverageSummaryChipsProps {
    summary: CoverageSummary | null;
    loading?: boolean;
    /** Single-line chips for compact header */
    compact?: boolean;
}

type Chip = {
    label: string;
    tone: 'warn' | 'danger' | 'neutral';
    action?: 'expand' | 'collapse';
    tooltip?: string;
};

const toneClass = {
    warn: 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
    danger: 'border-red-200/80 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100',
    neutral: 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
};

const chipClass = (tone: Chip['tone']) =>
    `inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${toneClass[tone]}`;

export function CoverageSummaryChips({ summary, loading, compact }: CoverageSummaryChipsProps) {
    const [expanded, setExpanded] = useState(false);
    if (loading) {
        return (
            <div className={`flex gap-2 ${compact ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
                <span className="inline-flex h-6 w-28 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
            </div>
        );
    }
    if (!summary) return null;

    const chips: Chip[] = [];
    if (summary.openShiftCount > 0) {
        chips.push({
            label: `${summary.openShiftCount} open shift${summary.openShiftCount === 1 ? '' : 's'} today`,
            tone: 'warn',
        });
    }
    const showAllUnderstaffed = !compact || expanded;
    const understaffed = summary.understaffedWards.slice(0, showAllUnderstaffed ? 20 : 2);
    understaffed.forEach((w) => {
        chips.push({
            label: `${w.wardName} understaffed (${w.shiftTypeLabel})`,
            tone: 'danger',
        });
    });
    const hiddenCount = summary.understaffedWards.length - 2;
    if (compact && hiddenCount > 0) {
        const hidden = summary.understaffedWards.slice(2);
        const hiddenTooltip = hidden
            .map((w) => `${w.wardName} understaffed (${w.shiftTypeLabel})`)
            .join(' · ');
        if (expanded) {
            chips.push({ label: 'Show less', tone: 'danger', action: 'collapse' });
        } else {
            chips.push({
                label: `+${hiddenCount} more`,
                tone: 'danger',
                action: 'expand',
                tooltip: hiddenTooltip,
            });
        }
    }
    if (chips.length === 0) {
        chips.push({ label: 'Coverage on track today', tone: 'neutral' });
    }

    return (
        <div
            className={
                compact
                    ? 'scrollbar-hide flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5'
                    : 'flex flex-wrap gap-2'
            }
        >
            {chips.map((c) => {
                if (c.action === 'expand' || c.action === 'collapse') {
                    const btn = (
                        <button
                            type="button"
                            onClick={() => setExpanded(c.action === 'expand')}
                            className={`${chipClass(c.tone)} cursor-pointer transition hover:opacity-90`}
                        >
                            {c.label}
                        </button>
                    );
                    if (c.tooltip) {
                        return (
                            <ActionIconTooltip key={c.label} label={c.tooltip} side="bottom">
                                {btn}
                            </ActionIconTooltip>
                        );
                    }
                    return <span key={c.label}>{btn}</span>;
                }
                return (
                    <span key={c.label} className={chipClass(c.tone)}>
                        {c.label}
                    </span>
                );
            })}
        </div>
    );
}
