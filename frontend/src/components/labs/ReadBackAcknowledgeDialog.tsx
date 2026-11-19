import { useState } from 'react';
import { ConfirmDialog } from '../shared/ConfirmDialog';

type Props = {
    open: boolean;
    testName: string;
    value: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: (readBackValue: string) => void;
};

/** SAF-06: requires the acknowledging clinician to type the value back before it's accepted — the
 * server verifies it matches, so this isn't a checkbox, it's a real confirmation step. */
export function ReadBackAcknowledgeDialog({ open, testName, value, busy, onCancel, onConfirm }: Props) {
    const [readBack, setReadBack] = useState('');

    return (
        <ConfirmDialog
            open={open}
            title="Acknowledge critical result"
            message={`Read the value back to confirm it before acknowledging ${testName}.`}
            detail={value}
            confirmLabel="Acknowledge"
            variant="primary"
            busy={busy}
            confirmDisabled={!readBack.trim()}
            onCancel={() => {
                setReadBack('');
                onCancel();
            }}
            onConfirm={() => {
                const v = readBack.trim();
                setReadBack('');
                onConfirm(v);
            }}
        >
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Read-back value
                <input
                    autoFocus
                    className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-primary/60 dark:border-gray-600 dark:bg-gray-800"
                    value={readBack}
                    onChange={(e) => setReadBack(e.target.value)}
                    placeholder={value}
                />
            </label>
        </ConfirmDialog>
    );
}
