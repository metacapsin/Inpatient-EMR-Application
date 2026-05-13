import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Toast } from 'primereact/toast';
import { TabView, TabPanel } from 'primereact/tabview';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import usePatientId from '../../hooks/usePatientId';
import { NursingFlowsheetProvider, useNursingFlowsheet } from '../../features/nursing-flowsheet/state/NursingFlowsheetContext';
import { NursingFlowsheetWorksurface } from '../../features/nursing-flowsheet/components/NursingFlowsheetWorksurface';
import { FlowsheetDraftRecoveryDialog } from '../../features/nursing-flowsheet/components/FlowsheetDraftRecoveryDialog';
import { buildMockNursingFlowsheetDocument } from '../../features/nursing-flowsheet/data/mockNursingFlowsheet';
import type { NursingFlowsheetDocument } from '../../features/nursing-flowsheet/types/nursingFlowsheet.types';
import { flowsheetDraftStorageKey, readDraftFromStorage } from '../../features/nursing-flowsheet/utils/draftStorage';
import { getNursingFlowsheet, normalizeServerDocumentToClient } from '../../services/nursingFlowsheet.service';
import RiskAssessments from '../patient/RiskAssessments';

function FlowsheetToastMount() {
    const { toastRef } = useNursingFlowsheet();
    return <Toast ref={toastRef as RefObject<Toast>} position="top-center" className="!w-[min(100vw,24rem)]" />;
}

export default function NursingFlowsheetPage() {
    const patientId = usePatientId();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);
    const encounter = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = encounter?.encounterId?.trim() ?? '';
    const [searchParams, setSearchParams] = useSearchParams();
    const hubTabIndex = searchParams.get('sub') === 'risk' ? 1 : 0;

    const flowsheetQuery = useQuery({
        queryKey: ['nursingFlowsheet', patientId, encounterId],
        queryFn: async () => {
            const fallback = buildMockNursingFlowsheetDocument({
                patientId: patientId ?? 'unknown',
                encounterId,
            });
            if (!encounterId) return fallback;
            try {
                const raw = await getNursingFlowsheet(encounterId);
                return normalizeServerDocumentToClient(raw, fallback);
            } catch {
                return fallback;
            }
        },
        enabled: Boolean(patientId),
    });

    const loadedDocument = flowsheetQuery.data;

    const [draftOpen, setDraftOpen] = useState(false);
    const [draftPreview, setDraftPreview] = useState<NursingFlowsheetDocument | null>(null);

    useEffect(() => {
        if (!patientId || !loadedDocument) return;
        const key = flowsheetDraftStorageKey(loadedDocument);
        const raw = readDraftFromStorage(key);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as NursingFlowsheetDocument;
            if (parsed.updatedAtIso && loadedDocument.updatedAtIso && parsed.updatedAtIso > loadedDocument.updatedAtIso) {
                setDraftPreview(parsed);
                setDraftOpen(true);
            }
        } catch {
            /* ignore corrupt draft */
        }
    }, [patientId, loadedDocument]);

    if (!patientId) {
        return (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </div>
        );
    }

    if (flowsheetQuery.isPending || loadedDocument === undefined) {
        return (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
                <span>Loading nursing flowsheet…</span>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <NursingFlowsheetProvider key={`${patientId}:${encounterId}`} initialDocument={loadedDocument}>
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <DraftBootstrap draftOpen={draftOpen} draftPreview={draftPreview} onCloseDraft={() => setDraftOpen(false)} />
                    <FlowsheetToastMount />
                    <TabView
                        activeIndex={hubTabIndex}
                        onTabChange={(e) => {
                            if (e.index === 1) setSearchParams({ sub: 'risk' }, { replace: true });
                            else setSearchParams({}, { replace: true });
                        }}
                        className="nfs-nursing-hub-tabview p-tabview flex min-h-0 flex-1 flex-col !border-0 !bg-transparent"
                    >
                        <TabPanel header="Head-to-toe">
                            <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                                <NursingFlowsheetWorksurface patient={patient} encounterId={encounterId} loadingPatient={!patient} />
                            </div>
                        </TabPanel>
                        <TabPanel header="Risk Assessments">
                            <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-y-auto overflow-x-hidden px-2 py-2 lg:px-3 [scrollbar-width:thin]">
                                <RiskAssessments embedded />
                            </div>
                        </TabPanel>
                    </TabView>
                </div>
            </NursingFlowsheetProvider>
        </div>
    );
}

function DraftBootstrap({
    draftOpen,
    draftPreview,
    onCloseDraft,
}: {
    draftOpen: boolean;
    draftPreview: NursingFlowsheetDocument | null;
    onCloseDraft: () => void;
}) {
    const { dispatch } = useNursingFlowsheet();
    return (
        <FlowsheetDraftRecoveryDialog
            visible={draftOpen}
            preview={draftPreview}
            onHide={onCloseDraft}
            onRestore={(doc) => {
                dispatch({ type: 'HYDRATE', payload: { document: doc, validationErrors: {} } });
                onCloseDraft();
            }}
            onDiscard={() => onCloseDraft()}
        />
    );
}
