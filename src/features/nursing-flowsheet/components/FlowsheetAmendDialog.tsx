import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { useState } from 'react';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';

interface FlowsheetAmendDialogProps {
    visible: boolean;
    onHide: () => void;
}

export function FlowsheetAmendDialog({ visible, onHide }: FlowsheetAmendDialogProps) {
    const { beginAmendment, state } = useNursingFlowsheet();
    const [reason, setReason] = useState('');
    const [err, setErr] = useState<string | null>(null);

    const submit = () => {
        const e = beginAmendment(reason);
        if (e) {
            setErr(e);
            return;
        }
        setReason('');
        setErr(null);
        onHide();
    };

    return (
        <Dialog
            className="nfs-chart-dialog !rounded-2xl"
            contentClassName="!pt-3 !pb-3"
            header={
                <div className="flex items-start gap-3 pe-8">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/12 text-orange-800 dark:bg-orange-400/15 dark:text-orange-100">
                        <i className="pi pi-pencil text-lg" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                        <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Amend signed document</h2>
                        <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Reason required — fully audited</p>
                    </div>
                </div>
            }
            visible={visible}
            style={{ width: 'min(96vw, 520px)' }}
            onHide={() => {
                setErr(null);
                onHide();
            }}
            draggable={false}
            resizable={false}
            footer={
                <div className="flex flex-wrap justify-end gap-3">
                    <Button type="button" label="Cancel" severity="secondary" size="small" outlined onClick={onHide} />
                    <Button type="button" label="Open amendment" size="small" icon="pi pi-external-link" iconPos="right" onClick={submit} />
                </div>
            }
        >
            <p className="mb-3 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
                Co-sign and facility policy still apply. Your reason is stored with the amendment trail.
            </p>
            <label htmlFor="amend-reason" className="mb-1.5 block text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                Amendment reason
            </label>
            <InputTextarea
                id="amend-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full !text-[13px]"
                autoResize
                placeholder="Describe what needs correction and why…"
            />
            {err ? <p className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-400">{err}</p> : null}
            {state.document.chartStatus === 'amending' && state.document.amendmentReason ? (
                <p className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <span className="font-semibold">Active reason on file:</span> {state.document.amendmentReason}
                </p>
            ) : null}
        </Dialog>
    );
}

export function FlowsheetCancelAmendButton() {
    const { cancelAmendment, state } = useNursingFlowsheet();
    if (state.document.chartStatus !== 'amending') return null;
    return (
        <Button type="button" label="Cancel amendment" severity="danger" text size="small" className="!text-[11px]" onClick={cancelAmendment} />
    );
}
