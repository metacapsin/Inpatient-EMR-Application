import { memo } from 'react';
import NewDropdown from '../ui/NewDropdown';
import { SearchInput } from '../patients/SearchInput';
import { DateRangePicker, type DateRange } from '../patients/DateRangePicker';
import { QUALITY_UNITS } from '../../constants/quality/units';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { cn } from '@/lib/utils';
import { qmCompactSearchWrapClass } from '../../styles/qualityDashboardClasses';

type Props = {
    layout?: 'toolbar' | 'stacked';
    compact?: boolean;
    disabled?: boolean;
    showClear?: boolean;
};

const UNIT_OPTIONS = QUALITY_UNITS.map((u) => ({ value: u.id, label: u.label }));

function QualityFilterFieldsInner({
    layout = 'toolbar',
    compact = false,
    disabled,
    showClear = true,
}: Props) {
    const unitId = useQualityMeasuresStore((s) => s.unitId);
    const setUnitId = useQualityMeasuresStore((s) => s.setUnitId);
    const searchQuery = useQualityMeasuresStore((s) => s.searchQuery);
    const setSearchQuery = useQualityMeasuresStore((s) => s.setSearchQuery);
    const dateRange = useQualityMeasuresStore((s) => s.dateRange);
    const setDateRange = useQualityMeasuresStore((s) => s.setDateRange);

    const rangeValue: DateRange = {
        from: dateRange?.from ?? '',
        to: dateRange?.to ?? '',
    };

    const hasActiveFilters =
        Boolean(searchQuery.trim()) || Boolean(rangeValue.from) || Boolean(rangeValue.to);

    const clearAll = () => {
        setSearchQuery('');
        setDateRange(null);
    };

    const isStacked = layout === 'stacked';
    const isCompact = compact || !isStacked;

    const rowClass = isStacked
        ? 'flex flex-col gap-2'
        : cn(
              'flex min-w-0 flex-1 flex-wrap items-center gap-1.5',
              isCompact && 'md:flex-nowrap',
          );

    const searchWrap = cn(
        isStacked ? 'w-full' : 'min-w-[8rem] flex-[1.4] max-w-[16rem]',
        isCompact && qmCompactSearchWrapClass,
    );

    const unitWrap = isStacked ? 'w-full' : 'w-[10.5rem] shrink-0';
    const dateWrap = isStacked ? 'w-full' : 'w-[11.5rem] shrink-0';

    return (
        <div className={rowClass}>
            <div className={searchWrap}>
                <label htmlFor="qm-patient-search" className="sr-only">
                    Search patient, MRN, or room
                </label>
                <SearchInput
                    id="qm-patient-search"
                    variant="premium"
                    className="w-full min-w-0"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Patient, MRN, room…"
                    disabled={disabled}
                />
            </div>

            <div className={unitWrap}>
                <NewDropdown
                    id="qm-unit-select"
                    label="Unit"
                    options={UNIT_OPTIONS}
                    value={unitId}
                    placeholder="Unit"
                    className="w-full min-w-0"
                    appendMenuToBody
                    disabled={disabled}
                    onChange={(v) => setUnitId(String(v))}
                />
            </div>

            <div className={dateWrap}>
                <DateRangePicker
                    label="Period"
                    className="w-full min-w-0 pr-4"
                    value={rangeValue}
                    disabled={disabled}
                    onChange={(range) => {
                        if (!range.from && !range.to) {
                            setDateRange(null);
                            return;
                        }
                        setDateRange({ from: range.from, to: range.to });
                    }}
                />
            </div>

            {showClear && hasActiveFilters ? (
                <button
                    type="button"
                    onClick={clearAll}
                    disabled={disabled}
                    className="inline-flex h-7 shrink-0 items-center px-1.5 text-[10px] font-semibold text-emr-muted transition hover:text-emr-text dark:text-gray-500 dark:hover:text-gray-300"
                >
                    Clear
                </button>
            ) : null}
        </div>
    );
}

export const QualityFilterFields = memo(QualityFilterFieldsInner);
