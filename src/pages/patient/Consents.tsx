import { useSelector } from 'react-redux';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import type { IRootState } from '../../store';
import { ConsentsModule } from '../../features/consent/components/ConsentsModule';

export default function Consents() {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);

    const patientName = patient?.fullName?.trim() || undefined;
    const patientMrn = patient?.mrn?.trim() || undefined;

    if (!patientId?.trim()) {
        return (
            <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </p>
        );
    }

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <ConsentsModule patientId={patientId.trim()} patientName={patientName} patientMrn={patientMrn} />
        </div>
    );
}
