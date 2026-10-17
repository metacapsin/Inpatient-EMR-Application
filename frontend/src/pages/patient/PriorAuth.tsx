import { useSelector } from 'react-redux';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import type { IRootState } from '../../store';
import { PriorAuthModule } from '../../features/prior-auth/components/PriorAuthModule';

export default function PriorAuth() {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);

    if (!patientId?.trim()) {
        return (
            <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </p>
        );
    }

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="shrink-0 border-b border-emr-border px-4 py-3 dark:border-white/10">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Prior Authorization</h2>
                {patient?.fullName ? (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {patient.fullName}
                        {patient.mrn ? ` · MRN ${patient.mrn}` : ''}
                    </p>
                ) : null}
            </div>
            <PriorAuthModule patientId={patientId.trim()} />
        </div>
    );
}
