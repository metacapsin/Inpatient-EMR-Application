import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPatientRightsRequest, listPatientRights } from '../../../services/consent.service';
import type { PatientRightsRequestPayload } from '../../../types/consent';

export function usePatientRights(patientId: string) {
    const pid = patientId.trim();
    const enabled = Boolean(pid);
    const queryClient = useQueryClient();
    const queryKey = ['patientRights', pid] as const;

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const r = await listPatientRights(pid);
            if (!r.ok) throw new Error(r.message);
            return r.data;
        },
        enabled,
        staleTime: 30_000,
    });

    const createMutation = useMutation({
        mutationFn: (payload: PatientRightsRequestPayload) => createPatientRightsRequest(payload),
        onSuccess: async (res) => {
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Patient rights request recorded');
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return { records: query.data ?? [], query, createMutation };
}
