import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { NursingFlowsheetDocument } from '../types/nursingFlowsheet.types';

interface FlowsheetDraftRecoveryDialogProps {
    visible: boolean;
    onHide: () => void;
    onRestore: (doc: NursingFlowsheetDocument) => void;
    onDiscard: () => void;
    preview: NursingFlowsheetDocument | null;
}

export function FlowsheetDraftRecoveryDialog({ visible, onHide, onRestore, onDiscard, preview }: FlowsheetDraftRecoveryDialogProps) {
    return (
        <Dialog
            className="nfs-chart-dialog !rounded-2xl"
            contentClassName="!pt-3 !pb-3"
            header={
                <div className="flex items-start gap-3 pe-8">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-100">
                        <i className="pi pi-cloud-download text-lg" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                        <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Recover local draft?</h2>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Newer data in this browser only</p>
                    </div>
                </div>
            }
            visible={visible}
            closable={false}
            style={{ width: 'min(96vw, 480px)' }}
            onHide={onHide}
            draggable={false}
            resizable={false}
            footer={
                <div className="flex flex-wrap justify-end gap-3">
                    <Button type="button" label="Keep current chart" size="small" severity="secondary" outlined onClick={onDiscard} />
                    <Button
                        type="button"
                        label="Restore draft"
                        size="small"
                        icon="pi pi-history"
                        disabled={!preview}
                        onClick={() => preview && onRestore(preview)}
                    />
                </div>
            }
        >
            <p className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
                A newer autosave exists in this browser for this patient, encounter, and shift. Restoring replaces what you see on screen
                (demo only).
            </p>
            <p className="mt-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                In production, server merge rules decide how drafts combine with the legal record.
            </p>
            {preview ? (
                <ul className="mt-3 space-y-1.5 rounded-lg border border-gray-200/90 bg-gray-50/90 px-3 py-2.5 text-[12px] text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-100">
                    <li className="flex gap-2">
                        <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">Updated</span>
                        <span>{new Date(preview.updatedAtIso).toLocaleString()}</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">Version</span>
                        <span>{preview.version}</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">Nurse</span>
                        <span>{preview.shiftInfo.primaryNurseDisplay}</span>
                    </li>
                </ul>
            ) : (
                <p className="mt-3 text-[12px] font-medium text-red-600 dark:text-red-400">No readable draft payload.</p>
            )}
        </Dialog>
    );
}
