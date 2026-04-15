import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { DispenseMedicineLine, PrescriptionRow } from '../../../types/medicationManagement';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PharmacyTabProps {
    patientId: string;
    defaultDispensedBy: string;
}

type EditableRx = PrescriptionRow & {
    editLines: Array<{
        medicineId: string;
        quantityDispensed: number;
        batchNumber: string;
        expiryDate: string;
        unitPrice: number;
    }>;
};

function toEditable(rx: PrescriptionRow): EditableRx {
    return {
        ...rx,
        editLines: rx.medicines.map((m) => ({
            medicineId: m.medicineId,
            quantityDispensed: m.quantityOrdered,
            batchNumber: m.batchNumber || '',
            expiryDate: m.expiryDate || '',
            unitPrice: m.unitPrice,
        })),
    };
}

export function PharmacyTab({ patientId, defaultDispensedBy }: PharmacyTabProps) {
    const [prescriptions, setPrescriptions] = useState<EditableRx[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dispensedBy, setDispensedBy] = useState(defaultDispensedBy);
    const [dispensingId, setDispensingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const list = await medApi.getPrescriptions(patientId);
            setPrescriptions(list.map(toEditable));
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load prescriptions');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setDispensedBy(defaultDispensedBy);
    }, [defaultDispensedBy]);

    function updateLine(
        prescriptionId: string,
        medicineId: string,
        patch: Partial<{ quantityDispensed: number; batchNumber: string; expiryDate: string }>
    ) {
        setPrescriptions((prev) =>
            prev.map((rx) => {
                if (rx.prescriptionId !== prescriptionId) return rx;
                return {
                    ...rx,
                    editLines: rx.editLines.map((l) =>
                        l.medicineId === medicineId ? { ...l, ...patch } : l
                    ),
                };
            })
        );
    }

    /** Sum of line totals where quantity > 0 (matches POST totalCost). */
    const totalsByRx = useMemo(() => {
        const map = new Map<string, number>();
        for (const rx of prescriptions) {
            let t = 0;
            for (const l of rx.editLines) {
                if (l.quantityDispensed > 0) {
                    t += l.quantityDispensed * l.unitPrice;
                }
            }
            map.set(rx.prescriptionId, Math.round(t * 100) / 100);
        }
        return map;
    }, [prescriptions]);

    function validateLines(rx: EditableRx): string | null {
        for (const l of rx.editLines) {
            if (l.quantityDispensed < 0) return 'Quantity cannot be negative';
            if (l.quantityDispensed > 0) {
                if (!l.batchNumber.trim()) return 'Batch number required for dispensed items';
                if (!l.expiryDate.trim()) return 'Expiry date required for dispensed items';
            }
        }
        return null;
    }

    async function handleDispense(rx: EditableRx) {
        if (!dispensedBy.trim()) {
            toast.error('Dispensed by is required');
            return;
        }
        const v = validateLines(rx);
        if (v) {
            toast.error(v);
            return;
        }
        const medicines: DispenseMedicineLine[] = rx.editLines
            .filter((l) => l.quantityDispensed > 0)
            .map((l) => ({
                medicineId: l.medicineId,
                quantityDispensed: l.quantityDispensed,
                batchNumber: l.batchNumber.trim(),
                expiryDate: l.expiryDate.trim(),
                unitPrice: l.unitPrice,
            }));
        if (medicines.length === 0) {
            toast.error('Enter quantity to dispense for at least one line');
            return;
        }
        const totalCost =
            Math.round(medicines.reduce((s, m) => s + m.quantityDispensed * m.unitPrice, 0) * 100) / 100;
        setDispensingId(rx.prescriptionId);
        try {
            await medApi.postDispense({
                prescriptionId: rx.prescriptionId,
                medicines,
                dispensedBy: dispensedBy.trim(),
                totalCost,
            });
            toast.success('Dispense recorded');
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'Dispense failed'));
        } finally {
            setDispensingId(null);
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            )}

            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Dispensed by
                    </label>
                    <input
                        className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        value={dispensedBy}
                        onChange={(e) => setDispensedBy(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Loading prescriptions…
                </div>
            ) : prescriptions.length === 0 ? (
                <p className="text-sm text-gray-500">No prescriptions for this patient.</p>
            ) : (
                prescriptions.map((rx) => (
                    <div
                        key={rx.prescriptionId}
                        className="rounded-md border border-gray-200 p-4 dark:border-gray-700"
                    >
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                    Prescription {rx.prescriptionId.slice(-12)}
                                </h3>
                                {rx.prescriberName ? (
                                    <p className="text-sm text-gray-500">{rx.prescriberName}</p>
                                ) : null}
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                Total: ${(totalsByRx.get(rx.prescriptionId) ?? 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/80">
                                    <tr>
                                        <th className="px-2 py-2">Medicine</th>
                                        <th className="px-2 py-2">Qty dispensed</th>
                                        <th className="px-2 py-2">Batch</th>
                                        <th className="px-2 py-2">Expiry</th>
                                        <th className="px-2 py-2">Unit $</th>
                                        <th className="px-2 py-2">Line total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rx.medicines.map((m) => {
                                        const line = rx.editLines.find((l) => l.medicineId === m.medicineId)!;
                                        const lineTotal =
                                            Math.round(Math.max(0, line.quantityDispensed) * line.unitPrice * 100) / 100;
                                        return (
                                            <tr key={m.medicineId} className="border-t border-gray-100 dark:border-gray-700">
                                                <td className="px-2 py-2">
                                                    <div className="font-medium">{m.name}</div>
                                                    <div className="text-xs text-gray-500">{m.strength}</div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        className="h-9 w-20 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                        value={line.quantityDispensed}
                                                        onChange={(e) =>
                                                            updateLine(rx.prescriptionId, m.medicineId, {
                                                                quantityDispensed: Number(e.target.value) || 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        className="h-9 w-28 rounded border border-gray-300 px-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                                                        value={line.batchNumber}
                                                        placeholder="Batch #"
                                                        onChange={(e) =>
                                                            updateLine(rx.prescriptionId, m.medicineId, {
                                                                batchNumber: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <Input
                                                        type="date"
                                                        className="min-w-[7.5rem] max-w-[9.5rem]"
                                                        value={line.expiryDate}
                                                        onChange={(e) =>
                                                            updateLine(rx.prescriptionId, m.medicineId, {
                                                                expiryDate: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-2">${m.unitPrice.toFixed(2)}</td>
                                                <td className="px-2 py-2">${lineTotal.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                disabled={dispensingId === rx.prescriptionId}
                                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                onClick={() => void handleDispense(rx)}
                            >
                                {dispensingId === rx.prescriptionId ? 'Dispensing…' : 'Dispense'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
