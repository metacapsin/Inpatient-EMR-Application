import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { RadiologyModule } from '../../features/radiology/components/RadiologyModule';
import { RadiologyPageHeader } from '../../features/radiology/components/RadiologyPageHeader';

export default function Radiology() {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const session = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));

    const encounterHint = useMemo(() => {
        const eid = session?.encounterId?.trim();
        if (!eid) return undefined;
        const tail = eid.length > 10 ? `…${eid.slice(-8)}` : eid;
        return `Active encounter ${tail}`;
    }, [session?.encounterId]);

    if (!patientId?.trim()) {
        return (
            <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </p>
        );
    }

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <RadiologyPageHeader encounterHint={encounterHint} />
            <RadiologyModule patientId={patientId.trim()} />
        </div>
    );
}
