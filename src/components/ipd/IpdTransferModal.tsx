import React, { useState, useEffect, memo } from 'react';
import { FaTimes } from 'react-icons/fa';

type Props = {
    open: boolean;
    patientLabel: string;
    busy: boolean;
    onClose: () => void;
    onConfirm: (newBedId: string, reason: string) => void;
};

function IpdTransferModalInner({ open, patientLabel, busy, onClose, onConfirm }: Props) {
    const [newBedId, setNewBedId] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) {
            setNewBedId('');
            setReason('');
        }
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose} role="presentation">
            <div
                className="bg-white dark:bg-[#0e1726] rounded-xl shadow-xl max-w-md w-full border border-white-light dark:border-dark"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ipd-transfer-title"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white-light dark:border-dark">
                    <h3 id="ipd-transfer-title" className="text-base font-semibold text-gray-900 dark:text-white">
                        Transfer Patient
                    </h3>
                    <button type="button" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark" onClick={onClose} aria-label="Close">
                        <FaTimes className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{patientLabel}</p>
                    <div>
                        <label htmlFor="ipd-new-bed" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            New bed ID
                        </label>
                        <input
                            id="ipd-new-bed"
                            className="form-input w-full text-sm"
                            value={newBedId}
                            onChange={(e) => setNewBedId(e.target.value)}
                            placeholder="Bed identifier"
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label htmlFor="ipd-transfer-reason" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Reason (optional)
                        </label>
                        <input
                            id="ipd-transfer-reason"
                            className="form-input w-full text-sm"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Clinical / logistical reason"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <div className="px-4 py-3 border-t border-white-light dark:border-dark flex justify-end gap-2">
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !newBedId.trim()}
                        onClick={() => onConfirm(newBedId.trim(), reason.trim())}
                    >
                        {busy ? 'Submitting…' : 'Confirm transfer'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export const IpdTransferModal = memo(IpdTransferModalInner);
