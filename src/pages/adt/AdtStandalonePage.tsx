import AdtModulePage from '../../modules/facesheet/adt/AdtModulePage';
import { AdtPatientQuickSearch } from '../../components/adt/AdtPatientQuickSearch';
import { usePatientId } from '../../hooks/usePatientId';

const AdtStandalonePage = () => {
    const patientId = usePatientId();

    return (
        <div className="panel space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">ADT workspace</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Admit, transfer, and discharge without opening a full chart module first. Select a patient below or open a chart from
                    the patient list.
                </p>
            </div>
            <div className="max-w-md">
                <AdtPatientQuickSearch currentPatientId={patientId} />
            </div>
            <AdtModulePage />
        </div>
    );
};

export default AdtStandalonePage;
