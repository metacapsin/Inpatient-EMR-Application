import React, { memo, useMemo } from 'react';
import { BedDouble, DoorOpen, LogOut, Users } from 'lucide-react';
import type { IpdKpis } from '../../types/ipdDashboard';
import { ipdKpiCardClass } from '../../styles/ipdDashboardClasses';
import { cn } from '@/lib/utils';

type Props = {
    kpis: IpdKpis;
    loading?: boolean;
};

type KpiDef = {
    key: keyof IpdKpis;
    title: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    iconBg: string;
    barClass?: string;
};

const KPI_DEFS: KpiDef[] = [
    {
        key: 'totalAdmittedPatients',
        title: 'Total Admitted Patients',
        shortLabel: 'Active census',
        icon: Users,
        accent: 'text-emr-info dark:text-blue-400',
        iconBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    },
    {
        key: 'occupiedBeds',
        title: 'Occupied Beds',
        shortLabel: 'In use',
        icon: BedDouble,
        accent: 'text-primary dark:text-primary-300',
        iconBg: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200',
        barClass: 'bg-primary',
    },
    {
        key: 'availableBeds',
        title: 'Available Beds',
        shortLabel: 'Ready capacity',
        icon: DoorOpen,
        accent: 'text-emr-success dark:text-emerald-400',
        iconBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300',
        barClass: 'bg-emr-success',
    },
    {
        key: 'dischargedToday',
        title: 'Discharged Today',
        shortLabel: 'Completed today',
        icon: LogOut,
        accent: 'text-emr-muted dark:text-gray-300',
        iconBg: 'bg-emr-hover text-emr-text dark:bg-white/5 dark:text-gray-300',
    },
];

function utilizationPct(kpis: IpdKpis): number {
    const total = kpis.occupiedBeds + kpis.availableBeds;
    if (total <= 0) return 0;
    return Math.round((kpis.occupiedBeds / total) * 100);
}

function IpdKpiRowInner({ kpis, loading }: Props) {
    const utilization = useMemo(() => utilizationPct(kpis), [kpis]);

    return (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-2.5 min-[1100px]:grid-cols-4">
            {KPI_DEFS.map(({ key, title, shortLabel, icon: Icon, accent, iconBg, barClass }) => {
                const value = kpis[key];
                const showUtilBar = key === 'occupiedBeds' || key === 'availableBeds';
                const barWidth =
                    key === 'occupiedBeds'
                        ? utilization
                        : key === 'availableBeds'
                          ? 100 - utilization
                          : 0;

                const contextLine =
                    key === 'occupiedBeds' && kpis.occupiedBeds + kpis.availableBeds > 0
                        ? `${utilization}% of bed capacity`
                        : key === 'availableBeds' && kpis.availableBeds > 0
                          ? `${kpis.availableBeds.toLocaleString()} admission-ready`
                          : shortLabel;

                return (
                    <div
                        key={key}
                        className={ipdKpiCardClass}
                        aria-label={loading ? `${title}: loading` : `${title}: ${value}`}
                    >
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emr-accent/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-primary/30"
                            aria-hidden
                        />
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-semibold leading-snug text-emr-muted dark:text-gray-400">
                                {title}
                            </p>
                            <span
                                className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                                    iconBg,
                                )}
                                aria-hidden
                            >
                                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </span>
                        </div>
                        <div className="mt-1.5">
                            {loading ? (
                                <div className="h-7 w-20 animate-pulse rounded-md bg-emr-hover dark:bg-white/10" />
                            ) : (
                                <p
                                    className={cn(
                                        'text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]',
                                        accent,
                                    )}
                                >
                                    {value.toLocaleString()}
                                </p>
                            )}
                            <p className="mt-0.5 text-[10px] font-medium text-emr-muted dark:text-gray-500">
                                {contextLine}
                            </p>
                        </div>
                        {showUtilBar && !loading && kpis.occupiedBeds + kpis.availableBeds > 0 ? (
                            <div className="mt-2.5" aria-hidden>
                                <div className="h-1 overflow-hidden rounded-full bg-emr-border/80 dark:bg-white/10">
                                    <div
                                        className={cn('h-full rounded-full transition-all duration-500', barClass)}
                                        style={{ width: `${Math.min(100, Math.max(0, barWidth))}%` }}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export const IpdKpiRow = memo(IpdKpiRowInner);
