import { useState } from 'react';
import { AppModal } from '../shared/AppModal';
import { listHousekeepers } from '../../services/evsMockService';

interface EVSAssignModalProps {
    open: boolean;
    bedLabel: string;
    onClose: () => void;
    onConfirm: (housekeeperId: string, housekeeperName: string) => void;
    loading?: boolean;
}

export function EVSAssignModal({ open, bedLabel, onClose, onConfirm, loading }: EVSAssignModalProps) {
    const housekeepers = listHousekeepers();
    const [selected, setSelected] = useState(housekeepers[0]?.id ?? '');

    return (
        <AppModal open={open} onClose={onClose} title="Assign housekeeper" size="sm">
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Assign EVS staff to <strong className="text-gray-900 dark:text-white">{bedLabel}</strong>
            </p>
            <label className="mb-4 block text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="evs-hk-select">
                Housekeeper
            </label>
            <select
                id="evs-hk-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mb-4 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-[#1a1816]"
            >
                {housekeepers.map((hk) => (
                    <option key={hk.id} value={hk.id}>
                        {hk.name}
                    </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-200/80 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:border-white/[0.08] dark:text-gray-200"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!selected || loading}
                    onClick={() => {
                        const hk = housekeepers.find((h) => h.id === selected);
                        if (hk) onConfirm(hk.id, hk.name);
                    }}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {loading ? 'Assigning…' : 'Assign'}
                </button>
            </div>
        </AppModal>
    );
}
