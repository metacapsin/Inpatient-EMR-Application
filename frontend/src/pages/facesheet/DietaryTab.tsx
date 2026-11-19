import { useSelector } from 'react-redux';
import { UtensilsCrossed } from 'lucide-react';
import type { IRootState } from '../../store';
import { usePatientId } from '../../hooks/usePatientId';
import { FacesheetEmptyState } from '../../components/facesheet/FacesheetEmptyState';

/**
 * Dietary orders are not yet backed by a server module (there is no diet order type in CPOE and no
 * diet-order table). This tab is only mounted when `VITE_FACESHEET_PREVIEW_TABS=true`; it is bound to
 * the chart's patient and never renders sample data for another person.
 */
const DietaryTab = () => {
    const patientId = usePatientId();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);
    const who = patient?.fullName ? `${patient.fullName}${patient.mrn ? ` (MRN ${patient.mrn})` : ''}` : patientId ?? 'this patient';

    return (
        <div className="w-full min-w-0">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-primary/25">
                    <UtensilsCrossed className="h-5 w-5" aria-hidden />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dietary orders</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{who}</p>
                </div>
            </div>
            <FacesheetEmptyState
                title="Diet orders are not available yet"
                description="Diet and nutrition orders will appear here once the dietary order module is enabled for this facility. Nothing has been ordered for this patient in this system."
            />
        </div>
    );
};

export default DietaryTab;
