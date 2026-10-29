import { Navigate } from 'react-router-dom';
import { usePatientId } from '../../hooks/usePatientId';

/** Retires flat `/app/diagnoses` in favor of the facesheet chart route. */
export default function DiagnosesLegacyRedirect() {
    const patientId = usePatientId();
    if (patientId?.trim()) {
        return <Navigate to={`/app/facesheet/${encodeURIComponent(patientId.trim())}/diagnoses`} replace />;
    }
    return <Navigate to="/app/patients/list" replace />;
}
