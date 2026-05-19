import { useQuery } from '@tanstack/react-query';
import { fetchCodeEventByPatient } from '../../../services/codeEventService';

export function patientActiveCodeQueryKey(patientId: string) {
    return ['codeEvent', 'patient', patientId] as const;
}

export function usePatientActiveCodeEvent(patientId: string | undefined) {
    return useQuery({
        queryKey: patientActiveCodeQueryKey(patientId ?? ''),
        queryFn: () => fetchCodeEventByPatient(patientId!),
        enabled: Boolean(patientId?.trim()),
        refetchInterval: 20_000,
    });
}
