import React, { memo, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { ChargeCategory, ChargeLine, ChargeLineStatus } from '../../../types/dischargeReadiness';
import NewDropdown from '@/components/ui/NewDropdown';
import AppButton from '@/components/ui/AppButton';

type Props = {
    charges: ChargeLine[];
    canEdit: boolean;
    onUpdateCharge: (chargeId: string, patch: Partial<Pick<ChargeLine, 'status' | 'quantity' | 'unitPrice' | 'description'>>) => Promise<boolean>;
    onAddCharge: (line: Omit<ChargeLine, 'id' | 'total'>) => Promise<boolean>;
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

function ChargeCaptureTabInner({ charges, canEdit, onUpdateCharge, onAddCharge }: Props) {
    const [desc, setDesc] = useState('');
    const [code, setCode] = useState('');
    const [category, setCategory] = useState<ChargeCategory>('other');
    const [qty, setQty] = useState('1');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [adding, setAdding] = useState(false);

    const total = charges.reduce((s, c) => s + c.total, 0);

    return (
        <div className="space-y-6">
            <div className="rounded-md border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-sm text-gray-600 dark:text-gray-400">Encounter charge total (mock)</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 pr-2 font-medium">Date</th>
                            <th className="py-2 pr-2 font-medium">Category</th>
                            <th className="py-2 pr-2 font-medium">Description</th>
                            <th className="py-2 pr-2 font-medium">Code</th>
                            <th className="py-2 pr-2 font-medium">Qty</th>
                            <th className="py-2 pr-2 font-medium">Unit</th>
                            <th className="py-2 pr-2 font-medium">Total</th>
                            <th className="py-2 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* {charges.map((c) => (
                            <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 pr-2 whitespace-nowrap">{c.serviceDate}</td>
                                <td className="py-2 pr-2">{categoryLabel[c.category]}</td>
                                <td className="py-2 pr-2">{c.description}</td>
                                <td className="py-2 pr-2 font-mono text-xs">{c.serviceCode}</td>
                                <td className="py-2 pr-2">{c.quantity}</td>
                                <td className="py-2 pr-2">${c.unitPrice.toFixed(2)}</td>
                                <td className="py-2 pr-2 font-medium">${c.total.toFixed(2)}</td>
                                <td className="py-2">
                                    <select
                                        className="h-8 rounded border border-gray-300 bg-white text-xs dark:border-gray-600 dark:bg-gray-900"
                                        disabled={!canEdit}
                                        value={c.status}
                                        onChange={(e) =>
                                            void onUpdateCharge(c.id, { status: e.target.value as ChargeLineStatus })
                                        }
                                    >
                                        <option value="pending_capture">Pending capture</option>
                                        <option value="posted">Posted</option>
                                        <option value="hold">Hold</option>
                                    </select>
                                </td>
                            </tr>
                        ))} */}
                        {charges.map((c) => (
  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
    <td className="py-2 pr-2 whitespace-nowrap">{c.serviceDate}</td>
    <td className="py-2 pr-2">{categoryLabel[c.category]}</td>
    <td className="py-2 pr-2">{c.description}</td>
    <td className="py-2 pr-2 font-mono text-xs">{c.serviceCode}</td>
    <td className="py-2 pr-2">{c.quantity}</td>
    <td className="py-2 pr-2">${c.unitPrice.toFixed(2)}</td>
    <td className="py-2 pr-2 font-medium">${c.total.toFixed(2)}</td>

    <td className="py-2">
      <div className="w-25">
        <NewDropdown
          options={[
            { value: "pending_capture", label: "Pending capture" },
            { value: "posted", label: "Posted" },
            { value: "hold", label: "Hold" },
          ]}
          value={c.status}
          onChange={(v) =>
            void onUpdateCharge(c.id, { status: v as ChargeLineStatus })
          }
          disabled={!canEdit}
        />
      </div>
    </td>
  </tr>
))}
                    </tbody>
                </table>
            </div>

            {canEdit ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
                    <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Add manual charge (CDM)</p>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                        <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
                        <Input placeholder="Service code" value={code} onChange={(e) => setCode(e.target.value)} />
                        <Input type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
                        <Input type="number" step="0.01" placeholder="Unit price" value={price} onChange={(e) => setPrice(e.target.value)} />
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        {/* <select
                            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as ChargeCategory)}
                        >
                            {(Object.keys(categoryLabel) as ChargeCategory[]).map((k) => (
                                <option key={k} value={k}>
                                    {categoryLabel[k]}
                                </option>
                            ))}
                        </select> */}
                    <div className="h-2 w-full size-sm">
                            <NewDropdown
                                options={Object.keys(categoryLabel).map((k) => ({
                                value: k,
                                label: categoryLabel[k as ChargeCategory],
                                }))}
                                value={category}
                                onChange={(v) => setCategory(v as ChargeCategory)}
                                placeholder="Select..."
                            />
</div>
                    
                    </div>
                    <AppButton
                        type="button"
                        className="mt-3"
                        disabled={adding || !desc.trim() || !code.trim()}
                        onClick={async () => {
                            const q = Number(qty);
                            const p = Number(price);
                            if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p)) return;
                            setAdding(true);
                            await onAddCharge({
                                category,
                                description: desc.trim(),
                                serviceCode: code.trim(),
                                serviceDate: date,
                                quantity: q,
                                unitPrice: p,
                                status: 'posted',
                            });
                            setAdding(false);
                            setDesc('');
                            setCode('');
                            setPrice('');
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
