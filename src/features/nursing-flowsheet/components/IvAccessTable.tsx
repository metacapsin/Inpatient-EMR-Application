import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';
import {
    IV_ACCESS_TYPE_OPTIONS,
    IV_GAUGE_FRENCH_OPTIONS,
    IV_SITE_CONDITION_OPTIONS,
} from '../constants/clinicalOptions';
import type { IvAccessLine } from '../types/nursingFlowsheet.types';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';
import { FlowsheetLabeledDropdown, FlowsheetOutlinedCalendar, FlowsheetOutlinedTextInput } from './FlowsheetStyledFields';

function newLine(): IvAccessLine {
    return {
        id: `iv-${Date.now()}`,
        accessType: 'Peripheral IV',
        siteLocation: '',
        gaugeFrench: '20G',
        insertionDate: null,
        siteCondition: 'Intact',
        dressingIntact: true,
    };
}

export function IvAccessTable() {
    const { state, replaceIvLines, isChartLocked } = useNursingFlowsheet();
    const lines = state.document.ivAccess;

    const update = (idx: number, patch: Partial<IvAccessLine>) => {
        const next = lines.map((row, i) => (i === idx ? { ...row, ...patch } : row));
        replaceIvLines(next);
    };

    const add = () => replaceIvLines([...lines, newLine()]);
    const remove = (idx: number) => replaceIvLines(lines.filter((_, i) => i !== idx));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    IV / vascular access (per line)
                </p>
                <Button
                    type="button"
                    size="small"
                    label="Add line"
                    icon="pi pi-plus"
                    disabled={isChartLocked}
                    className="!py-1 !text-[11px]"
                    onClick={add}
                />
            </div>
            <Divider className="!my-1" />
            {lines.length === 0 ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">No access documented. Add a line.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] border-collapse text-left text-[11px]">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                <th className="px-1 py-1">Access type</th>
                                <th className="px-1 py-1">Site location</th>
                                <th className="px-1 py-1">Gauge / Fr</th>
                                <th className="px-1 py-1">Insertion</th>
                                <th className="px-1 py-1">Site condition</th>
                                <th className="px-1 py-1 text-center">Dressing intact</th>
                                <th className="w-10 px-1 py-1" />
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((row, idx) => (
                                <tr key={row.id} className="border-b border-gray-100 dark:border-white/5">
                                    <td className="px-1 py-1 align-top">
                                        <FlowsheetLabeledDropdown
                                            fieldId={`iv-type-${row.id}`}
                                            label="Access type"
                                            options={IV_ACCESS_TYPE_OPTIONS}
                                            value={row.accessType}
                                            onChange={(v) => update(idx, { accessType: String(v) })}
                                            disabled={isChartLocked}
                                        />
                                    </td>
                                    <td className="px-1 py-0.5 align-top">
                                        <FlowsheetOutlinedTextInput
                                            fieldId={`iv-site-${row.id}`}
                                            label="Site location"
                                            value={row.siteLocation}
                                            onChange={(v) => update(idx, { siteLocation: v })}
                                            disabled={isChartLocked}
                                            placeholder="e.g. R antecubital"
                                        />
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        <FlowsheetLabeledDropdown
                                            fieldId={`iv-gf-${row.id}`}
                                            label="Gauge / Fr"
                                            options={IV_GAUGE_FRENCH_OPTIONS}
                                            value={row.gaugeFrench}
                                            onChange={(v) => update(idx, { gaugeFrench: String(v) })}
                                            disabled={isChartLocked}
                                        />
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        <FlowsheetOutlinedCalendar
                                            fieldId={`iv-ins-${row.id}`}
                                            label="Insertion"
                                            value={row.insertionDate}
                                            onChange={(v) => update(idx, { insertionDate: v })}
                                            disabled={isChartLocked}
                                        />
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        <FlowsheetLabeledDropdown
                                            fieldId={`iv-site-${row.id}`}
                                            label="Site condition"
                                            options={IV_SITE_CONDITION_OPTIONS}
                                            value={row.siteCondition}
                                            onChange={(v) => update(idx, { siteCondition: String(v) })}
                                            disabled={isChartLocked}
                                        />
                                    </td>
                                    <td className="px-1 py-0.5 text-center align-middle">
                                        <Checkbox
                                            inputId={`dress-${row.id}`}
                                            checked={row.dressingIntact}
                                            disabled={isChartLocked}
                                            onChange={(e) => update(idx, { dressingIntact: e.checked ?? false })}
                                        />
                                    </td>
                                    <td className="px-1 py-0.5 align-middle">
                                        <Button
                                            type="button"
                                            icon="pi pi-trash"
                                            rounded
                                            text
                                            severity="danger"
                                            disabled={isChartLocked}
                                            className="!h-7 !w-7"
                                            onClick={() => remove(idx)}
                                            aria-label="Remove line"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
