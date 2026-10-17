import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { QualityMeasuresHeader } from '../../components/quality/QualityMeasuresHeader';
import { QualityKpiCards } from '../../components/quality/QualityKpiCards';
import { QualityUnitTable } from '../../components/quality/QualityUnitTable';
import { QualityPatientMobileCard } from '../../components/quality/QualityPatientMobileCard';
import { BundleDetailPanel } from '../../components/quality/BundleDetailPanel';
import { BundleLogicAccordion } from '../../components/quality/BundleLogicAccordion';
import { QualityMobileFiltersSheet } from '../../components/quality/QualityMobileFiltersSheet';
import {
    qualityDashboardQueryKey,
    useQualityDashboard,
} from '../../hooks/quality/useQualityDashboard';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { BUNDLE_LABELS } from '../../constants/quality/bundles';
import type { BundleKey } from '../../types/quality';
import { qmMetricsBandClass, qmShellClass } from '../../styles/qualityDashboardClasses';

export default function QualityMeasuresPage() {
    const queryClient = useQueryClient();
    const unitId = useQualityMeasuresStore((s) => s.unitId);
    const openBundlePanel = useQualityMeasuresStore((s) => s.openBundlePanel);

    const { data, isLoading, isFetching, isError, filteredPatients, refetch } = useQualityDashboard();

    const handleRefresh = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: qualityDashboardQueryKey(unitId) });
        await refetch();
    }, [queryClient, unitId, refetch]);

    const handleMobileBundle = useCallback(
        (row: (typeof filteredPatients)[0], bundleKey: BundleKey) => {
            openBundlePanel({
                encounterId: row.encounterId,
                measureId: row.measureId,
                bundleKey,
                bundleLabel: BUNDLE_LABELS[bundleKey],
                patientName: row.patientName,
                mrn: row.mrn,
                roomNumber: row.roomNumber,
            });
        },
        [openBundlePanel],
    );

    const loading = isLoading && !data;

    if (loading) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
                <p className="text-xs font-medium text-emr-muted dark:text-gray-400">
                    Loading quality measures…
                </p>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-lg border border-emr-danger/30 bg-emr-danger/5 px-3 py-4 text-xs text-emr-danger dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                Unable to load quality measures dashboard. Please refresh or try another unit.
            </div>
        );
    }

    return (
        <div className={qmShellClass}>
            <QualityMeasuresHeader
                unitName={data.unitName}
                lastEvaluatedAt={data.lastEvaluatedAt}
                complianceSummary={data.complianceSummary}
                onRefresh={handleRefresh}
                isRefreshing={isFetching}
            />

            <div className={qmMetricsBandClass}>
                <QualityKpiCards kpis={data.kpis} loading={isFetching} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                <QualityUnitTable rows={filteredPatients} loading={isFetching} />

                <div className="flex flex-col gap-1.5 overflow-y-auto md:hidden" role="list" aria-label="Patient compliance cards">
                    {filteredPatients.map((row) => (
                        <QualityPatientMobileCard
                            key={row.encounterId}
                            row={row}
                            onBundleClick={(key) => handleMobileBundle(row, key)}
                        />
                    ))}
                    {filteredPatients.length === 0 && (
                        <p className="py-4 text-center text-xs text-emr-muted">No patients match your search.</p>
                    )}
                </div>
            </div>

            <BundleLogicAccordion />

            <BundleDetailPanel />
            <QualityMobileFiltersSheet />
        </div>
    );
}
