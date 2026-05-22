import type { UnitType } from '../../types/quality';

export interface QualityUnitOption {
    id: string;
    label: string;
    unitType: UnitType;
}

export const QUALITY_UNITS: QualityUnitOption[] = [
    { id: 'unit-icu-4n', label: 'ICU — North 4', unitType: 'icu' },
    { id: 'unit-ms-6e', label: 'Med-Surg — East 6', unitType: 'med-surg' },
    { id: 'unit-sd-3w', label: 'Step-Down — West 3', unitType: 'step-down' },
    { id: 'unit-tel-5s', label: 'Telemetry — South 5', unitType: 'telemetry' },
];

export const DEFAULT_QUALITY_UNIT_ID = QUALITY_UNITS[1].id;

export function getQualityUnitById(unitId: string): QualityUnitOption | undefined {
    return QUALITY_UNITS.find((u) => u.id === unitId);
}
