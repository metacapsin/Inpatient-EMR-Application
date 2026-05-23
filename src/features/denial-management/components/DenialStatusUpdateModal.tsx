import { Sidebar } from 'primereact/sidebar';
import { FlowsheetLabeledDropdown } from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { Button } from '../../../components/ui/button';
import type { ClaimDenialRecord, DenialStatus } from '../types/denial.types';
import { DENIAL_STATUSES } from '../types/denial.types';

type Props = {
    open: boolean;
    row: ClaimDenialRecord | null;
    status: DenialStatus;
    busy: boolean;
    onStatusChange: (status: DenialStatus) => void;
    onClose: () => void;
    onSave: () => void;
};

export function DenialStatusUpdateModal({
    open,
    row,
    status,
    busy,
    onStatusChange,
    onClose,
    onSave,
}: Props) {
    const options = DENIAL_STATUSES.map((s) => ({ label: s, value: s }));

    return (
        <Sidebar
            visible={open}
            position="right"
            onHide={onClose}
            className="w-[min(100vw,400px)] !max-w-[100vw] border-l border-gray-200/90 dark:border-white/10"
            header={<span className="text-sm font-semibold text-gray-900 dark:text-white">Update Status</span>}
        >
            {row ? (
                <div className="flex flex-col gap-4 p-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Claim {row.claimNumber} · {row.patientName}
                    </p>
                    <FlowsheetLabeledDropdown
                        fieldId="denial-status-update"
                        label="Status"
                        options={options}
                        value={status}
                        onChange={(v) => onStatusChange(String(v) as DenialStatus)}
                        disabled={busy}
                    />
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={onSave} disabled={busy}>
                            Save
                        </Button>
                    </div>
                </div>
            ) : null}
        </Sidebar>
    );
}
