import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppModal } from '../shared/AppModal';
import { listHousekeepers } from '../../services/evs.service';

interface EVSAssignModalProps {
    open: boolean;
    bedLabel: string;
    onClose: () => void;
    onConfirm: (housekeeperId: string, housekeeperName: string) => void;
    loading?: boolean;
}

export function EVSAssignModal({ open, bedLabel, onClose, onConfirm, loading }: EVSAssignModalProps) {
    const housekeepersQuery = useQuery({
        queryKey: ['evs', 'housekeepers'],
        queryFn: listHousekeepers,
        enabled: open,
        staleTime: 60_000,
    });
    const housekeepers = housekeepersQuery.data ?? [];
    const [selected, setSelected] = useState('');

    useEffect(() => {
        if (!selected && housekeepers.length) setSelected(housekeepers[0].id);
    }, [housekeepers, selected]);

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
                disabled={housekeepersQuery.isLoading || !housekeepers.length}
                className="mb-2 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-[#1a1816]"
            >
                {housekeepersQuery.isLoading ? <option value="">Loading staff…</option> : null}
                {!housekeepersQuery.isLoading && !housekeepers.length ? <option value="">No staff or nurse users found</option> : null}
                {housekeepers.map((hk) => (
                    <option key={hk.id} value={hk.id}>
                        {hk.name}
                        {hk.role ? ` (${hk.role})` : ''}
                    </option>
                ))}
            </select>
            <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
                Users with the <strong>Staff</strong> or <strong>Nurse</strong> role can be assigned. Add housekeepers under Settings → Users.
            </p>
            {housekeepersQuery.isError ? (
                <p className="mb-3 text-xs text-red-600 dark:text-red-300">
                    {housekeepersQuery.error instanceof Error ? housekeepersQuery.error.message : 'Could not load staff'}
                </p>
            ) : null}
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
