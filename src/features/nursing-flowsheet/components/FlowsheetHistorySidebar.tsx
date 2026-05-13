import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from 'primereact/sidebar';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';
import {
    extractHistoryVersionsPayload,
    getNursingFlowsheetHistory,
} from '../../../services/nursingFlowsheet.service';

function detailBody(value: string) {
    return <span className="block whitespace-normal break-words text-[11px] leading-snug text-gray-800 dark:text-gray-200">{value}</span>;
}

export function FlowsheetHistorySidebar() {
    const { state, closeHistory, dispatch } = useNursingFlowsheet();
    const visible = state.ui.historyDrawerVisible;
    const encounterId = state.document.encounterId;

    const historyQuery = useQuery({
        queryKey: ['nursingFlowsheetHistory', encounterId],
        queryFn: () => getNursingFlowsheetHistory(encounterId),
        enabled: visible && Boolean(encounterId),
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!visible || historyQuery.data === undefined) return;
        const versions = extractHistoryVersionsPayload(historyQuery.data);
        if (versions.length) {
            dispatch({ type: 'HYDRATE', payload: { versions } });
        }
    }, [visible, historyQuery.data, dispatch]);

    return (
        <Sidebar
            visible={visible}
            position="right"
            onHide={closeHistory}
            className="nfs-legal-sidebar w-[min(100vw,480px)] !max-w-[100vw] border-l border-gray-200/90 shadow-2xl dark:border-white/10"
            header={
                <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">Legal record</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                        Versions & audit trail
                    </span>
                </div>
            }
            pt={{
                content: {
                    className: '!m-0 !flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-0 !pb-0',
                },
            }}
        >
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-0 pt-1">
                <TabView className="nfs-legal-tabview min-h-0 flex-1 !text-[12px]">
                    <TabPanel header="Versions">
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                            <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                                Immutable signed revisions. Rows are read-only in this demo.
                            </p>
                            <div className="min-h-0 max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-gray-200/80 bg-white/60 dark:border-white/10 dark:bg-black/20">
                                <DataTable
                                    value={state.versions}
                                    dataKey="id"
                                    size="small"
                                    stripedRows
                                    showGridlines={false}
                                    className="!text-[11px]"
                                >
                                    <Column field="version" header="Ver" style={{ width: '2.75rem' }} />
                                    <Column
                                        field="savedAtIso"
                                        header="When"
                                        style={{ width: '9.5rem' }}
                                        body={(r) => <span className="whitespace-nowrap">{new Date(r.savedAtIso).toLocaleString()}</span>}
                                    />
                                    <Column field="savedByDisplay" header="User" style={{ width: '7.5rem' }} body={(r) => detailBody(r.savedByDisplay)} />
                                    <Column
                                        field="status"
                                        header=""
                                        style={{ width: '4.5rem' }}
                                        body={(r) => (
                                            <Tag
                                                value={r.status}
                                                severity={r.status === 'signed' ? 'success' : r.status === 'draft' ? 'warning' : 'info'}
                                                className="!px-1.5 !py-0 !text-[9px]"
                                            />
                                        )}
                                    />
                                    <Column field="summary" header="Summary" body={(r) => detailBody(r.summary)} />
                                </DataTable>
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel header="Audit">
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                            <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                                Append-only trail: sign, save, amendment, break-glass (HIPAA-oriented view).
                            </p>
                            <div className="min-h-0 max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-gray-200/80 bg-white/60 dark:border-white/10 dark:bg-black/20">
                                <DataTable
                                    value={state.auditTrail}
                                    dataKey="id"
                                    size="small"
                                    stripedRows
                                    showGridlines={false}
                                    className="!text-[11px]"
                                >
                                    <Column
                                        field="atIso"
                                        header="Time"
                                        style={{ width: '5.25rem' }}
                                        body={(r) => (
                                            <span className="whitespace-nowrap text-[11px]">{new Date(r.atIso).toLocaleTimeString()}</span>
                                        )}
                                    />
                                    <Column field="actorDisplay" header="Actor" style={{ width: '7rem' }} body={(r) => detailBody(r.actorDisplay)} />
                                    <Column field="action" header="Action" style={{ width: '6.5rem' }} body={(r) => detailBody(r.action)} />
                                    <Column field="detail" header="Detail" body={(r) => detailBody(r.detail)} />
                                </DataTable>
                            </div>
                        </div>
                    </TabPanel>
                </TabView>

                <div className="mt-3 shrink-0 border-t border-gray-200/90 bg-gray-50/80 px-0 pb-2 pt-2.5 dark:border-white/10 dark:bg-black/25">
                    <Button
                        type="button"
                        label="Close"
                        className="w-full !justify-center !text-[12px] !font-semibold"
                        size="small"
                        severity="secondary"
                        outlined
                        onClick={closeHistory}
                    />
                </div>
            </div>
        </Sidebar>
    );
}
