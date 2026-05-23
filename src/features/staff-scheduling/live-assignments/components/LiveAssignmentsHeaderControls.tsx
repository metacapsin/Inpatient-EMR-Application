import NewDropdown from '../../../../components/ui/NewDropdown';
import type { FacilityWard } from '../../../../types/facility';
import { SHIFT_API_OPTIONS, type StaffingShiftToken } from '../config/staffingMock.config';
import type { NurseAssignmentRow } from '../../../../types/staffing.types';

export interface LiveAssignmentsHeaderValue {
    unitId: string;
    date: string;
    shift: StaffingShiftToken;
    chargeNurseId: string;
}

interface LiveAssignmentsHeaderControlsProps {
    value: LiveAssignmentsHeaderValue;
    wards: FacilityWard[];
    nurses: NurseAssignmentRow[];
    totalPatients: number;
    onChange: (patch: Partial<LiveAssignmentsHeaderValue>) => void;
}

export function LiveAssignmentsHeaderControls({
    value,
    wards,
    nurses,
    totalPatients,
    onChange,
}: LiveAssignmentsHeaderControlsProps) {
    const wardOptions = [
        { value: '', label: 'Select unit' },
        ...wards.map((w) => ({ value: String(w.id), label: w.code ? `${w.name} (${w.code})` : w.name })),
    ];
    const shiftOptions = SHIFT_API_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
    const chargeOptions = [
        { value: '', label: 'Unassigned' },
        ...nurses
            .filter((n) => n.role === 'RN' || n.role === 'LVN')
            .map((n) => ({ value: n.nurseId, label: n.displayName })),
    ];

    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200/70 bg-gray-50/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02] md:flex-row md:flex-wrap md:items-end">
            <div className="min-w-0 flex-1 md:min-w-[10rem] md:max-w-[14rem]">
                <NewDropdown
                    id="live-assign-unit"
                    label="Unit / ward"
                    options={wardOptions}
                    value={value.unitId}
                    placeholder="Select unit"
                    className="w-full"
                    appendMenuToBody
                    onChange={(v) => onChange({ unitId: String(v) })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[12rem]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Shift date
                </label>
                <input
                    type="date"
                    className="form-input h-8 w-full text-sm"
                    value={value.date}
                    onChange={(e) => onChange({ date: e.target.value })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                <NewDropdown
                    id="live-assign-shift"
                    label="Shift type"
                    options={shiftOptions}
                    value={value.shift}
                    className="w-full"
                    appendMenuToBody
                    onChange={(v) => onChange({ shift: v as StaffingShiftToken })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[10rem] md:max-w-[16rem]">
                <NewDropdown
                    id="live-assign-charge"
                    label="Charge nurse"
                    options={chargeOptions}
                    value={value.chargeNurseId}
                    placeholder="Select charge"
                    className="w-full"
                    appendMenuToBody
                    onChange={(v) => onChange({ chargeNurseId: String(v) })}
                />
            </div>
            <div className="flex shrink-0 flex-col justify-end md:ml-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Total patients
                </p>
                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{totalPatients}</p>
            </div>
        </div>
    );
}
