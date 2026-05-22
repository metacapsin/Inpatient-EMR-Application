import { memo } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { QualityDashboardKpis } from '../../types/quality';
import { AnimatedCounter } from './AnimatedCounter';
import { KpiCardSkeleton } from './QualitySkeletons';
import { cn } from '@/lib/utils';
import { qmKpiCardClass, qmKpiGridClass } from '../../styles/qualityDashboardClasses';

type Props = {
    kpis: QualityDashboardKpis | undefined;
    loading: boolean;
};

const KPI_DEFS: {
    key: keyof QualityDashboardKpis;
    sparkKey: keyof QualityDashboardKpis['sparklines'];
    title: string;
    shortTitle: string;
    suffix?: string;
    accent: string;
}[] = [
    {
        key: 'totalPatients',
        sparkKey: 'totalPatients',
        title: 'Total Patients',
        shortTitle: 'Patients',
        accent: 'text-emr-text dark:text-white',
    },
    {
        key: 'overallCompliancePct',
        sparkKey: 'overallCompliance',
        title: 'Overall Compliance',
        shortTitle: 'Compliance',
        suffix: '%',
        accent: 'text-emr-success dark:text-emerald-400',
    },
    {
        key: 'activeDeficiencies',
        sparkKey: 'activeDeficiencies',
        title: 'Active Deficiencies',
        shortTitle: 'Deficient',
        accent: 'text-emr-danger dark:text-red-400',
    },
    {
        key: 'overdueBundleElements',
        sparkKey: 'overdueElements',
        title: 'Overdue Bundle Elements',
        shortTitle: 'Overdue',
        accent: 'text-emr-warning dark:text-amber-400',
    },
    {
        key: 'highRiskPatients',
        sparkKey: 'highRisk',
        title: 'High Risk Patients',
        shortTitle: 'High risk',
        accent: 'text-primary dark:text-primary-400',
    },
    {
        key: 'bundleCompletionRate',
        sparkKey: 'completionRate',
        title: 'Bundle Completion Rate',
        shortTitle: 'Completion',
        suffix: '%',
        accent: 'text-emr-info dark:text-blue-400',
    },
];

function MiniSparkline({ data, colorClass }: { data: number[]; colorClass: string }) {
    const chartData = data.map((v, i) => ({ i, v }));
    return (
        <div className="h-4 w-12 shrink-0 opacity-90" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Area
                        type="monotone"
                        dataKey="v"
                        stroke="currentColor"
                        fill="currentColor"
                        fillOpacity={0.12}
                        strokeWidth={1}
                        className={colorClass}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function QualityKpiCardsInner({ kpis, loading }: Props) {
    if (loading && !kpis) {
        return (
            <div className={qmKpiGridClass}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <KpiCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!kpis) return null;

    return (
        <div className={qmKpiGridClass}>
            {KPI_DEFS.map(({ key, sparkKey, title, shortTitle, suffix, accent }, index) => {
                const value = kpis[key] as number;
                const spark = kpis.sparklines[sparkKey];
                return (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.2 }}
                        className={qmKpiCardClass}
                        aria-label={`${title}: ${value}${suffix ?? ''}`}
                        title={title}
                    >
                        <p className="truncate text-[9px] font-bold uppercase tracking-wide text-emr-muted dark:text-gray-500">
                            <span className="min-[900px]:hidden">{shortTitle}</span>
                            <span className="hidden min-[900px]:inline">{title}</span>
                        </p>
                        <div className="mt-0.5 flex items-end justify-between gap-1">
                            <p
                                className={cn(
                                    'text-lg font-bold leading-none tabular-nums tracking-tight',
                                    accent,
                                )}
                            >
                                <AnimatedCounter value={value} suffix={suffix} loading={loading} />
                            </p>
                            <MiniSparkline data={spark} colorClass={accent} />
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

export const QualityKpiCards = memo(QualityKpiCardsInner);
