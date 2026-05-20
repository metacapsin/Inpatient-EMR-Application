import NewDropdown from '../../../components/ui/NewDropdown';
import { DateRangePicker, type DateRange } from '../../../components/patients/DateRangePicker';
import { SearchInput } from '../../../components/patients/SearchInput';
import {
    UNIFIED_ORDER_PRIORITIES,
    UNIFIED_ORDER_STATUSES,
    UNIFIED_ORDER_TYPES,
    type UnifiedOrderPriority,
    type UnifiedOrderStatus,
    type UnifiedOrderType,
} from '../../../types/unifiedOrders';
import { InpatientFilterMultiSelect } from './InpatientFilterMultiSelect';

export type OrderDashboardFilters = {
    patientSearch: string;
    unitId: string;
    orderTypes: UnifiedOrderType[];
    statuses: UnifiedOrderStatus[];
    priorities: UnifiedOrderPriority[];
    dateRange: DateRange;
};

type WardOption = { id: string; name: string; code?: string };

type OrderDashboardFiltersBarProps = {
    filters: OrderDashboardFilters;
    wards: WardOption[];
    wardsLoading?: boolean;
    disabled?: boolean;
    onChange: (patch: Partial<OrderDashboardFilters>) => void;
    onClear: () => void;
};

const ORDER_TYPE_OPTIONS = UNIFIED_ORDER_TYPES.map((t) => ({
    value: t,
    label: t.charAt(0).toUpperCase() + t.slice(1),
}));

const STATUS_OPTIONS = UNIFIED_ORDER_STATUSES.map((s) => ({
    value: s,
    label: s.replace(/_/g, ' '),
}));

const PRIORITY_OPTIONS = UNIFIED_ORDER_PRIORITIES.map((p) => ({
    value: p,
    label: p.toUpperCase() === 'STAT' ? 'STAT' : p.charAt(0).toUpperCase() + p.slice(1),
}));

export function OrderDashboardFiltersBar({
    filters,
    wards,
    wardsLoading,
    disabled,
    onChange,
    onClear,
}: OrderDashboardFiltersBarProps) {
    const wardOptions = [
        { value: '', label: 'All units' },
        ...wards.map((w) => ({
            value: w.id,
            label: w.code ? `${w.name} (${w.code})` : w.name,
        })),
    ];

    return (
        <div className="border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
                <div className="min-w-0 flex-1 md:min-w-[12rem] md:max-w-[16rem]">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Patient search
                    </label>
                    <SearchInput
                        variant="premium"
                        className="w-full min-w-0"
                        value={filters.patientSearch}
                        onChange={(v) => onChange({ patientSearch: v })}
                        placeholder="Name, MRN…"
                        disabled={disabled}
                        id="orders-dashboard-patient-search"
                    />
                </div>

                <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                    <NewDropdown
                        id="orders-dashboard-unit"
                        label="Unit / Ward"
                        options={wardOptions}
                        value={filters.unitId}
                        placeholder={wardsLoading ? 'Loading…' : 'All units'}
                        className="w-full min-w-0"
                        appendMenuToBody
                        disabled={disabled || wardsLoading}
                        onChange={(v) => onChange({ unitId: String(v) })}
                    />
                </div>

                <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                    <InpatientFilterMultiSelect
                        label="Order type"
                        value={filters.orderTypes}
                        options={ORDER_TYPE_OPTIONS}
                        disabled={disabled}
                        onChange={(orderTypes) => onChange({ orderTypes: orderTypes as UnifiedOrderType[] })}
                    />
                </div>

                <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                    <InpatientFilterMultiSelect
                        label="Status"
                        value={filters.statuses}
                        options={STATUS_OPTIONS}
                        disabled={disabled}
                        onChange={(statuses) => onChange({ statuses: statuses as UnifiedOrderStatus[] })}
                    />
                </div>

                <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                    <InpatientFilterMultiSelect
                        label="Priority"
                        value={filters.priorities}
                        options={PRIORITY_OPTIONS}
                        disabled={disabled}
                        onChange={(priorities) => onChange({ priorities: priorities as UnifiedOrderPriority[] })}
                    />
                </div>

                <div className="min-w-0 flex-1 md:max-w-[320px]">
                    <DateRangePicker
                        label="Date range"
                        className="w-full min-w-0 pr-5"
                        value={filters.dateRange}
                        disabled={disabled}
                        onChange={(dateRange) => onChange({ dateRange })}
                    />
                </div>

                <button
                    type="button"
                    onClick={onClear}
                    disabled={disabled}
                    className="inline-flex h-8 shrink-0 items-center justify-center self-start rounded-lg border border-transparent px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-100/80 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/[0.04] md:self-auto"
                >
                    Clear all filters
                </button>
            </div>
        </div>
    );
}
