import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';
import { AppModal } from '../../components/shared/AppModal';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import {
    ALLERGEN_RESTRICTIONS,
    createInitialDietOrders,
    DIET_PRIORITIES,
    DIET_TYPES,
    DIETARY_PATIENT,
    RELIGIOUS_RESTRICTIONS,
    SUPPLEMENT_FREQUENCIES,
    type DietOrder,
    type DietType,
} from '../../data/dietaryDummyData';
import AppButton from '@/components/ui/AppButton';

const ORDERED_BY = 'Dr. A. Sharma (Demo)';
const NEW_DIET_ORDER_FORM_ID = 'new-diet-order-form';

function defaultEffectiveFrom(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

interface NewOrderForm {
    dietType: DietType;
    caloricTarget: string;
    proteinTarget: string;
    fluidRestriction: boolean;
    fluidLimit: string;
    religiousRestrictions: string[];
    allergenRestrictions: string[];
    supplementalNutrition: boolean;
    supplementProduct: string;
    supplementFrequency: string;
    tubeFeedingFormula: string;
    tubeFeedingRate: string;
    priority: 'Routine' | 'Now';
    effectiveFrom: string;
    specialInstructions: string;
}

function emptyForm(): NewOrderForm {
    return {
        dietType: 'Regular',
        caloricTarget: '',
        proteinTarget: '',
        fluidRestriction: false,
        fluidLimit: '',
        religiousRestrictions: [],
        allergenRestrictions: [],
        supplementalNutrition: false,
        supplementProduct: '',
        supplementFrequency: 'BID',
        tubeFeedingFormula: '',
        tubeFeedingRate: '',
        priority: 'Routine',
        effectiveFrom: defaultEffectiveFrom(),
        specialInstructions: '',
    };
}

function StatusBadge({ status }: { status: DietOrder['status'] }) {
    const cls =
        status === 'Active'
            ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200'
            : 'bg-gray-100 text-gray-600 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-300';
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
            {status}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: DietOrder['priority'] }) {
    const cls =
        priority === 'Now'
            ? 'bg-orange-100 text-orange-800 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-200'
            : 'bg-blue-100 text-blue-800 ring-blue-200/80 dark:bg-blue-950/50 dark:text-blue-200';
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
            {priority}
        </span>
    );
}

function toggleInList(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function formatOrderDate(iso: string): string {
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d, yyyy HH:mm');
    } catch {
        return iso;
    }
}

export default function DietaryTab() {
    const { id: urlPatientId } = useParams<{ id: string }>();
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();

    const [orders, setOrders] = useState<DietOrder[]>(() => createInitialDietOrders());
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<NewOrderForm>(emptyForm);

    const closeModal = () => setModalOpen(false);

    const sortedOrders = useMemo(
        () =>
            [...orders].sort((a, b) => {
                if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
                return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
            }),
        [orders]
    );

    const allergyConflicts = useMemo(() => {
        const warnings: string[] = [];
        if (DIETARY_PATIENT.allergies.includes('Shellfish') && !form.allergenRestrictions.includes('Shellfish-Free')) {
            warnings.push('Patient has Shellfish allergy — Shellfish-Free restriction not selected.');
        }
        if (DIETARY_PATIENT.allergies.includes('Lactose') && !form.allergenRestrictions.includes('Lactose-Free')) {
            warnings.push('Patient has Lactose allergy — Lactose-Free restriction not selected.');
        }
        return warnings;
    }, [form.allergenRestrictions]);

    const handleDiscontinue = (orderId: string) => {
        setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: 'Discontinued' as const } : o))
        );
        toast.success('Diet order discontinued');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newOrder: DietOrder = {
            id: `DO-${Date.now()}`,
            dietType: form.dietType,
            caloricTarget: form.caloricTarget ? Number(form.caloricTarget) : undefined,
            proteinTarget: form.proteinTarget ? Number(form.proteinTarget) : undefined,
            fluidRestriction: form.fluidRestriction,
            fluidLimit: form.fluidRestriction && form.fluidLimit ? Number(form.fluidLimit) : undefined,
            religiousRestrictions: [...form.religiousRestrictions],
            allergenRestrictions: [...form.allergenRestrictions],
            supplementalNutrition: form.supplementalNutrition,
            supplementProduct: form.supplementalNutrition ? form.supplementProduct : undefined,
            supplementFrequency: form.supplementalNutrition ? form.supplementFrequency : undefined,
            tubeFeedingFormula: form.dietType === 'Tube Feeding' ? form.tubeFeedingFormula : undefined,
            tubeFeedingRate:
                form.dietType === 'Tube Feeding' && form.tubeFeedingRate ? Number(form.tubeFeedingRate) : undefined,
            priority: form.priority,
            effectiveFrom: new Date(form.effectiveFrom).toISOString(),
            specialInstructions: form.specialInstructions.trim() || undefined,
            orderedBy: ORDERED_BY,
            status: 'Active',
        };
        setOrders((prev) => [newOrder, ...prev]);
        closeModal();
        setForm(emptyForm());
        toast.success('Diet order placed successfully');
    };

    if (!patientId && !urlPatientId) {
        return (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </div>
        );
    }

    return (
        <div className={moduleRootClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dietary Orders</h2>
                <AppButton
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="!h-8 !px-3 !py-0 !text-xs font-semibold"
                >
                    <Plus className="h-4 w-4" aria-hidden />
                    New Diet Order
                </AppButton>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200/70 bg-white px-4 py-3 shadow-sm dark:border-white/[0.08] dark:bg-[#1a1a1a]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">{DIETARY_PATIENT.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">{DIETARY_PATIENT.mrn}</span>
                    <span className="text-gray-500 dark:text-gray-400">Age {DIETARY_PATIENT.age}</span>
                    <span className="text-gray-500 dark:text-gray-400">{DIETARY_PATIENT.ward}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Allergies:</span>
                        {DIETARY_PATIENT.allergies.map((a) => (
                            <span
                                key={a}
                                className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            >
                                {a}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {sortedOrders.map((order) => (
                    <article
                        key={order.id}
                        className="rounded-lg border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#1a1a1a]"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{order.dietType}</h3>
                            <div className="flex flex-wrap gap-1.5">
                                <StatusBadge status={order.status} />
                                <PriorityBadge priority={order.priority} />
                            </div>
                        </div>

                        <dl className="mt-3 grid gap-1.5 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                            {order.caloricTarget != null && (
                                <div>
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Caloric target: </dt>
                                    <dd className="inline">{order.caloricTarget} kcal/day</dd>
                                </div>
                            )}
                            {order.proteinTarget != null && (
                                <div>
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Protein target: </dt>
                                    <dd className="inline">{order.proteinTarget} g/day</dd>
                                </div>
                            )}
                            {order.fluidRestriction && order.fluidLimit != null && (
                                <div>
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Fluid restriction: </dt>
                                    <dd className="inline">{order.fluidLimit} ml/day</dd>
                                </div>
                            )}
                            {order.allergenRestrictions.length > 0 && (
                                <div className="sm:col-span-2">
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Allergen restrictions: </dt>
                                    <dd className="inline">{order.allergenRestrictions.join(', ')}</dd>
                                </div>
                            )}
                            {order.religiousRestrictions.length > 0 && (
                                <div className="sm:col-span-2">
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Religious/cultural: </dt>
                                    <dd className="inline">{order.religiousRestrictions.join(', ')}</dd>
                                </div>
                            )}
                            {order.supplementalNutrition && order.supplementProduct && (
                                <div className="sm:col-span-2">
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Supplement: </dt>
                                    <dd className="inline">
                                        {order.supplementProduct} ({order.supplementFrequency})
                                    </dd>
                                </div>
                            )}
                            {order.tubeFeedingFormula && (
                                <div>
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Tube formula: </dt>
                                    <dd className="inline">{order.tubeFeedingFormula}</dd>
                                </div>
                            )}
                            {order.tubeFeedingRate != null && (
                                <div>
                                    <dt className="inline font-medium text-gray-500 dark:text-gray-400">Tube rate: </dt>
                                    <dd className="inline">{order.tubeFeedingRate} ml/hr</dd>
                                </div>
                            )}
                            {order.specialInstructions && (
                                <div className="sm:col-span-2">
                                    <dt className="font-medium text-gray-500 dark:text-gray-400">Special instructions</dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap">{order.specialInstructions}</dd>
                                </div>
                            )}
                        </dl>

                        {order.status === 'Active' && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => handleDiscontinue(order.id)}
                                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                                >
                                    Discontinue
                                </button>
                            </div>
                        )}

                        <footer className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                            Ordered by {order.orderedBy} · Order ID {order.id} · Effective{' '}
                            {formatOrderDate(order.effectiveFrom)}
                        </footer>
                    </article>
                ))}
            </div>

            <AppModal
                open={modalOpen}
                title="New Diet Order"
                onClose={closeModal}
                className="max-w-[600px] max-h-[90vh]"
                footer={
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form={NEW_DIET_ORDER_FORM_ID}
                            className="btn btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-semibold"
                        >
                            Place Order
                        </button>
                    </div>
                }
            >
                <form id={NEW_DIET_ORDER_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Diet Type
                                    </span>
                                    <select
                                        value={form.dietType}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, dietType: e.target.value as DietType }))
                                        }
                                        className="form-select w-full"
                                        required
                                    >
                                        {DIET_TYPES.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Caloric Target (kcal/day)
                                    </span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.caloricTarget}
                                        onChange={(e) => setForm((f) => ({ ...f, caloricTarget: e.target.value }))}
                                        className="form-input w-full"
                                        placeholder="e.g. 1800"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Protein Target (g/day) — optional
                                    </span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.proteinTarget}
                                        onChange={(e) => setForm((f) => ({ ...f, proteinTarget: e.target.value }))}
                                        className="form-input w-full"
                                        placeholder="e.g. 80"
                                    />
                                </label>

                                <div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={form.fluidRestriction}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, fluidRestriction: e.target.checked }))
                                            }
                                            className="form-checkbox"
                                        />
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            Fluid Restriction
                                        </span>
                                    </label>
                                    {form.fluidRestriction && (
                                        <label className="mt-2 block">
                                            <span className="mb-1 block text-xs text-gray-500">Fluid Limit (ml/day)</span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.fluidLimit}
                                                onChange={(e) => setForm((f) => ({ ...f, fluidLimit: e.target.value }))}
                                                className="form-input w-full"
                                                placeholder="e.g. 1500"
                                            />
                                        </label>
                                    )}
                                </div>

                                <fieldset>
                                    <legend className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Religious/Cultural Restrictions
                                    </legend>
                                    <div className="flex flex-wrap gap-2">
                                        {RELIGIOUS_RESTRICTIONS.map((r) => (
                                            <label key={r} className="flex items-center gap-1.5 text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={form.religiousRestrictions.includes(r)}
                                                    onChange={() =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            religiousRestrictions: toggleInList(f.religiousRestrictions, r),
                                                        }))
                                                    }
                                                    className="form-checkbox"
                                                />
                                                {r}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>

                                <fieldset>
                                    <legend className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Allergen Restrictions
                                    </legend>
                                    <div className="flex flex-wrap gap-2">
                                        {ALLERGEN_RESTRICTIONS.map((a) => (
                                            <label key={a} className="flex items-center gap-1.5 text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={form.allergenRestrictions.includes(a)}
                                                    onChange={() =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            allergenRestrictions: toggleInList(f.allergenRestrictions, a),
                                                        }))
                                                    }
                                                    className="form-checkbox"
                                                />
                                                {a}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>

                                {allergyConflicts.length > 0 && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                            <div className="space-y-1">
                                                {allergyConflicts.map((w) => (
                                                    <p key={w} className="text-xs font-medium text-red-700 dark:text-red-300">
                                                        {w}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={form.supplementalNutrition}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, supplementalNutrition: e.target.checked }))
                                            }
                                            className="form-checkbox"
                                        />
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            Supplemental Nutrition
                                        </span>
                                    </label>
                                    {form.supplementalNutrition && (
                                        <div className="mt-2 space-y-2">
                                            <input
                                                type="text"
                                                value={form.supplementProduct}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, supplementProduct: e.target.value }))
                                                }
                                                className="form-input w-full"
                                                placeholder="Product name"
                                            />
                                            <select
                                                value={form.supplementFrequency}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, supplementFrequency: e.target.value }))
                                                }
                                                className="form-select w-full"
                                            >
                                                {SUPPLEMENT_FREQUENCIES.map((f) => (
                                                    <option key={f} value={f}>
                                                        {f}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {form.dietType === 'Tube Feeding' && (
                                    <>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                Tube Feeding Formula
                                            </span>
                                            <input
                                                type="text"
                                                value={form.tubeFeedingFormula}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, tubeFeedingFormula: e.target.value }))
                                                }
                                                className="form-input w-full"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                Tube Feeding Rate (ml/hr)
                                            </span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.tubeFeedingRate}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, tubeFeedingRate: e.target.value }))
                                                }
                                                className="form-input w-full"
                                            />
                                        </label>
                                    </>
                                )}

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Priority
                                    </span>
                                    <select
                                        value={form.priority}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                priority: e.target.value as 'Routine' | 'Now',
                                            }))
                                        }
                                        className="form-select w-full"
                                    >
                                        {DIET_PRIORITIES.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Effective From
                                    </span>
                                    <input
                                        type="datetime-local"
                                        value={form.effectiveFrom}
                                        onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                                        className="form-input w-full"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Special Instructions
                                    </span>
                                    <textarea
                                        value={form.specialInstructions}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, specialInstructions: e.target.value }))
                                        }
                                        className="form-textarea w-full"
                                        rows={3}
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Ordered By
                                    </span>
                                    <input
                                        type="text"
                                        value={ORDERED_BY}
                                        readOnly
                                        className="form-input w-full bg-gray-50 dark:bg-white/5"
                                    />
                                </label>
                </form>
            </AppModal>
        </div>
    );
}
