import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { TabView, TabPanel } from 'primereact/tabview';
import type { IRootState } from '../../../store';
import { selectAdtEncounter } from '../../../store/adtEncounterSlice';
import { useFacesheetChartLayout } from '../../../hooks/useFacesheetChartLayout';
import { healthConditionsAPI } from '../../../services/healthMonitoringService';
import { useRadiologyData } from '../hooks/useRadiologyData';
import { resolveOrderedBy } from '../utils/resolveOrderedBy';
import type { Icd10Option } from './Icd10MultiTypeahead';
import { ImagingOrdersTab } from './ImagingOrdersTab';
import { ResultsReportsTab } from './ResultsReportsTab';
import { CriticalResultsTab } from './CriticalResultsTab';
import { ImageViewerTab } from './ImageViewerTab';

export type RadiologyModuleProps = {
    patientId: string;
    /** When embedded in unified dashboard, optional encounter override from query. */
    encounterIdProp?: string;
};

const TAB_HEADERS = ['Imaging Orders', 'Results & Reports', 'Critical Results', 'Image Viewer'] as const;

export function RadiologyModule({ patientId, encounterIdProp }: RadiologyModuleProps) {
    const { moduleRootClass } = useFacesheetChartLayout();
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));
    const encounterId = encounterIdProp?.trim() || session?.encounterId?.trim() || '';
    const tenantId = String(authUser?.tenant?.id ?? authUser?.tenantId ?? '').trim();
    const ordered = useMemo(() => resolveOrderedBy(authUser), [authUser]);

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('radTab');
    const activeIndex = tabParam === 'results' ? 1 : tabParam === 'critical' ? 2 : tabParam === 'viewer' ? 3 : 0;

    const {
        effectiveEncounterId,
        orders,
        loading,
        submitting,
        savingDraft,
        draftLoading,
        orderDraft,
        createImagingOrder,
        saveDraft,
        discardDraft,
        acknowledge,
        cancelOrder,
        submitResult,
        markCritical,
    } = useRadiologyData({
        encounterId,
        patientId,
        tenantId,
        orderedBy: ordered.id,
        orderedByName: ordered.name,
    });

    const formEncounterId = encounterId.trim() || effectiveEncounterId;
    const showEncounterWarning = !encounterId.trim() && !effectiveEncounterId;

    const formContext = formEncounterId
        ? {
              patientId,
              encounterId: formEncounterId,
              tenantId,
              orderedBy: ordered.id,
              orderedByName: ordered.name,
          }
        : null;

    const [icdSuggestions, setIcdSuggestions] = useState<Icd10Option[]>([]);

    useEffect(() => {
        if (!patientId.trim()) return;
        let cancelled = false;
        void healthConditionsAPI
            .getByPatient(patientId)
            .then((res) => {
                if (cancelled) return;
                const raw = res.data?.data ?? res.data;
                const list = Array.isArray(raw) ? raw : [];
                const opts: Icd10Option[] = [];
                for (const item of list) {
                    let code = String(item?.icdCode ?? item?.code ?? item?.diagnosisCode ?? '').trim();
                    let label = String(item?.description ?? item?.name ?? '').trim();
                    if (item?.ICD10 && Array.isArray(item.ICD10) && item.ICD10[0]) {
                        const icd = item.ICD10[0] as Record<string, unknown>;
                        code = String(
                            Array.isArray(icd.Code) ? icd.Code[0] : icd.Code ?? code
                        ).trim();
                        label = String(
                            Array.isArray(icd.Description) ? icd.Description[0] : icd.Description ?? label
                        ).trim();
                    }
                    if (code) opts.push({ code, label: label || code });
                }
                setIcdSuggestions(opts);
            })
            .catch(() => {
                if (!cancelled) setIcdSuggestions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [patientId]);

    const handleTabChange = (index: number) => {
        const key =
            index === 1 ? 'results' : index === 2 ? 'critical' : index === 3 ? 'viewer' : null;
        if (key) setSearchParams({ radTab: key }, { replace: true });
        else setSearchParams({}, { replace: true });
    };

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <TabView
                activeIndex={activeIndex}
                onTabChange={(e) => handleTabChange(e.index)}
                className="nfs-nursing-hub-tabview p-tabview flex min-h-0 flex-1 flex-col !border-0 !bg-transparent"
            >
                <TabPanel header={TAB_HEADERS[0]}>
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        <ImagingOrdersTab
                            formContext={formContext}
                            patientId={patientId}
                            encounterId={formEncounterId}
                            showEncounterWarning={showEncounterWarning}
                            tenantId={tenantId}
                            orderedBy={ordered.id}
                            orderedByName={ordered.name}
                            icdSuggestions={icdSuggestions}
                            orderDraft={orderDraft}
                            draftLoading={draftLoading}
                            orders={orders}
                            loading={loading}
                            submitting={submitting}
                            savingDraft={savingDraft}
                            onCreateOrder={createImagingOrder}
                            onSaveDraft={saveDraft}
                            onCancelForm={() => void discardDraft()}
                            onAcknowledge={(id) => void acknowledge(id, ordered.id)}
                            onCancelOrder={(id) => void cancelOrder(id)}
                            onSubmitResult={(id, body) => void submitResult(id, body)}
                            onMarkCritical={(id, to) =>
                                void markCritical(id, { criticalValue: true, criticalValueNotifiedTo: to })
                            }
                        />
                    </div>
                </TabPanel>
                <TabPanel header={TAB_HEADERS[1]}>
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        <ResultsReportsTab orders={orders} />
                    </div>
                </TabPanel>
                <TabPanel header={TAB_HEADERS[2]}>
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        <CriticalResultsTab orders={orders} />
                    </div>
                </TabPanel>
                <TabPanel header={TAB_HEADERS[3]}>
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        <ImageViewerTab orders={orders} />
                    </div>
                </TabPanel>
            </TabView>
        </div>
    );
}
