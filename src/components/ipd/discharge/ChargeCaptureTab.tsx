import React, { memo, useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '@/lib/utils';
import type { ChargeCategory, ChargeLine, ChargeLineStatus } from '../../../types/dischargeReadiness';
import NewDropdown from '@/components/ui/NewDropdown';
import AppButton from '@/components/ui/AppButton';
import { useDischargeReadinessOptional } from '../../../contexts/DischargeReadinessContext';

type Props = {
    charges: ChargeLine[];
    canEdit: boolean;
    onUpdateCharge: (chargeId: string, patch: Partial<Pick<ChargeLine, 'status' | 'quantity' | 'unitPrice' | 'description'>>) => Promise<boolean>;
    onAddCharge: (line: Omit<ChargeLine, 'id' | 'total'>) => Promise<boolean>;
    onDeleteCharge: (chargeId: string) => Promise<boolean>;
};

const categoryLabel: Record<ChargeCategory, string> = {
    room_board: 'Room & board',
    pharmacy: 'Pharmacy',
    lab: 'Lab',
    radiology: 'Radiology',
    surgery: 'Surgery',
    supplies: 'Supplies',
    other: 'Other',
};

function parseMoney(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function ChargeRow({
    c,
    canEdit,
    onUpdateCharge,
    onDeleteCharge,
}: {
    c: ChargeLine;
    canEdit: boolean;
    onUpdateCharge: Props['onUpdateCharge'];
    onDeleteCharge: Props['onDeleteCharge'];
}) {
    const posted = c.status === 'posted';
    const [editing, setEditing] = useState(false);
    const [qty, setQty] = useState(String(c.quantity));
    const [unit, setUnit] = useState(String(c.unitPrice));
    const [desc, setDesc] = useState(c.description);
    const [busy, setBusy] = useState(false);

    const lineTotal = useMemo(() => {
        const q = Number(qty);
        const u = Number(unit);
        if (!Number.isFinite(q) || !Number.isFinite(u)) return c.total;
        return q * u;
    }, [qty, unit, c.total]);

    async function saveEdits() {
        const q = Number(qty);
        const u = parseMoney(unit);
        if (!Number.isFinite(q) || q <= 0 || u == null) return;
        setBusy(true);
        const ok = await onUpdateCharge(c.id, { quantity: q, unitPrice: u, description: desc.trim() || c.description });
        setBusy(false);
        if (ok) setEditing(false);
    }

    return (
        <tr className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-2 pr-2 whitespace-nowrap">{c.serviceDate}</td>
            <td className="py-2 pr-2">{categoryLabel[c.category]}</td>
            <td className="py-2 pr-2 min-w-[140px]">
                {editing && canEdit && !posted ? (
                    <Input className="h-8 text-xs" value={desc} onChange={(e) => setDesc(e.target.value)} />
                ) : (
                    c.description
                )}
            </td>
            <td className="py-2 pr-2 font-mono text-xs">{c.serviceCode}</td>
            <td className="py-2 pr-2">
                {editing && canEdit && !posted ? (
                    <Input className="h-8 w-16 text-xs" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
                ) : (
                    c.quantity
                )}
            </td>
            <td className="py-2 pr-2">
                {editing && canEdit && !posted ? (
                    <Input className="h-8 w-24 text-xs" inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} />
                ) : (
                    `$${c.unitPrice.toFixed(2)}`
                )}
            </td>
            <td className="py-2 pr-2 font-medium">${editing && canEdit && !posted ? lineTotal.toFixed(2) : c.total.toFixed(2)}</td>
            <td className="py-2 pr-2">
                <select
                    className="h-8 rounded border border-gray-300 bg-white text-xs dark:border-gray-600 dark:bg-gray-900"
                    disabled={!canEdit || posted}
                    value={c.status}
                    title={posted ? 'Change status via billing correction workflow when posted.' : undefined}
                    onChange={(e) => void onUpdateCharge(c.id, { status: e.target.value as ChargeLineStatus })}
                >
                    <option value="pending_capture">Pending capture</option>
                    <option value="posted">Posted</option>
                    <option value="hold">Hold</option>
                </select>
            </td>
            {canEdit ? (
                <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                        {!posted ? (
                            <>
                                {editing ? (
                                    <>
                                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={busy} onClick={() => void saveEdits()}>
                                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => {
                                                setEditing(false);
                                                setQty(String(c.quantity));
                                                setUnit(String(c.unitPrice));
                                                setDesc(c.description);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setEditing(true)}>
                                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                                        <span className="sr-only">Edit</span>
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-red-600 hover:text-red-700"
                                    title={posted ? 'Posted lines cannot be deleted.' : 'Delete line'}
                                    disabled={posted || busy}
                                    onClick={() => void onDeleteCharge(c.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    <span className="sr-only">Delete</span>
                                </Button>
                            </>
                        ) : (
                            <span className="text-xs text-gray-500">Locked</span>
                        )}
                    </div>
                </td>
            ) : null}
        </tr>
    );
}

function ChargeCaptureTabInner({ charges, canEdit, onUpdateCharge, onAddCharge, onDeleteCharge }: Props) {
    const ctx = useDischargeReadinessOptional();
    const [desc, setDesc] = useState('');
    const [code, setCode] = useState('');
    const [category, setCategory] = useState<ChargeCategory>('other');
    const [qty, setQty] = useState('1');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [adding, setAdding] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const addInFlight = useRef(false);

    const total = charges.reduce((s, c) => s + c.total, 0);

    const chargeGateHint = useMemo(() => {
        const gCount = ctx?.snapshot.gates.find((x) => x.id === 'gate-charges-count');
        const gPending = ctx?.snapshot.gates.find((x) => x.id === 'gate-charges-pending');
        const parts: string[] = [];
        if (gCount && !gCount.resolved) parts.push(gCount.message);
        if (gPending && !gPending.resolved) parts.push(gPending.message);
        return parts.length ? parts.join(' ') : null;
    }, [ctx?.snapshot]);

    return (
        <div className="space-y-3" data-charges-tab>
            <div
                className={cn(
                    'rounded-lg border px-4 py-4 dark:border-gray-700',
                    chargeGateHint
                        ? 'border-amber-300 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30'
                        : 'border-gray-200 bg-gray-50/80 dark:bg-gray-900/40',
                )}
            >
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Encounter charge total</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {chargeGateHint ? <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">{chargeGateHint}</p> : null}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 pr-2 font-medium">Date</th>
                            <th className="py-2 pr-2 font-medium">Category</th>
                            <th className="py-2 pr-2 font-medium">Description</th>
                            <th className="py-2 pr-2 font-medium">Code</th>
                            <th className="py-2 pr-2 font-medium">Qty</th>
                            <th className="py-2 pr-2 font-medium">Unit</th>
                            <th className="py-2 pr-2 font-medium">Line total</th>
                            <th className="py-2 pr-2 font-medium">Status</th>
                            {canEdit ? <th className="py-2 font-medium">Actions</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {charges.length === 0 ? (
                            <tr>
                                <td colSpan={canEdit ? 9 : 8} className="py-6 text-center text-sm text-gray-500">
                                    No charge lines — add at least one to satisfy billing readiness.
                                </td>
                            </tr>
                        ) : (
                            charges.map((c) => (
                                <ChargeRow
                                    key={c.id}
                                    c={c}
                                    canEdit={canEdit}
                                    onUpdateCharge={onUpdateCharge}
                                    onDeleteCharge={onDeleteCharge}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {canEdit ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
                    <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Add charge (CDM)</p>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Input
                            placeholder="Description *"
                            value={desc}
                            onChange={(e) => {
                                setFormError(null);
                                setDesc(e.target.value);
                            }}
                            aria-invalid={Boolean(formError)}
                            className="min-w-0 xl:col-span-2"
                        />
                        <Input
                            placeholder="Service code *"
                            value={code}
                            onChange={(e) => {
                                setFormError(null);
                                setCode(e.target.value);
                            }}
                        />
                        <Input
                            type="number"
                            min={1}
                            placeholder="Qty *"
                            value={qty}
                            onChange={(e) => {
                                setFormError(null);
                                setQty(e.target.value);
                            }}
                        />
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Unit price *"
                            value={price}
                            onChange={(e) => {
                                setFormError(null);
                                setPrice(e.target.value);
                            }}
                        />
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        <div className="min-w-0 md:col-span-2 xl:col-span-1">
                            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Category</label>
                            <NewDropdown
                                options={(Object.keys(categoryLabel) as ChargeCategory[]).map((k) => ({
                                    value: k,
                                    label: categoryLabel[k],
                                }))}
                                value={category}
                                onChange={(v) => setCategory(v as ChargeCategory)}
                                placeholder="Category…"
                            />
                        </div>
                    </div>
                    {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
                    <AppButton
                        type="button"
                        className="mt-3"
                        disabled={adding}
                        onClick={async () => {
                            if (addInFlight.current) return;
                            setFormError(null);
                            const q = Number(qty);
                            const u = parseMoney(price);
                            if (!desc.trim()) {
                                setFormError('Description is required.');
                                return;
                            }
                            if (!code.trim()) {
                                setFormError('Service code is required.');
                                return;
                            }
                            if (!Number.isFinite(q) || q <= 0) {
                                setFormError('Quantity must be a positive number.');
                                return;
                            }
                            if (u == null) {
                                setFormError('Unit price must be a valid non-negative number.');
                                return;
                            }
                            addInFlight.current = true;
                            setAdding(true);
                            try {
                                const ok = await onAddCharge({
                                    category,
                                    description: desc.trim(),
                                    serviceCode: code.trim(),
                                    serviceDate: date,
                                    quantity: q,
                                    unitPrice: u,
                                    status: 'pending_capture',
                                });
                                if (ok) {
                                    setDesc('');
                                    setCode('');
                                    setPrice('');
                                    setQty('1');
                                }
                            } finally {
                                setAdding(false);
                                addInFlight.current = false;
                            }
                        }}
                    >
                        {adding ? 'Adding…' : 'Add charge'}
                    </AppButton>
                </div>
            ) : (
                <p className="text-sm text-gray-500">Your role cannot add or change charge lines.</p>
            )}
        </div>
    );
}

export const ChargeCaptureTab = memo(ChargeCaptureTabInner);
