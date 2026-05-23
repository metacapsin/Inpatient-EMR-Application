import { useQuery } from '@tanstack/react-query';
import { getAllBeds, getAllRooms, getWards } from '../../../services/rooms.service';

export interface FacilityMetrics {
    wardCount: number;
    roomCount: number;
    bedCount: number;
}

export function useFacilityMetrics() {
    return useQuery({
        queryKey: ['settings', 'facility', 'metrics'],
        queryFn: async (): Promise<FacilityMetrics> => {
            const [wards, rooms, beds] = await Promise.all([getWards(), getAllRooms(), getAllBeds()]);

            return {
                wardCount: wards.length,
                roomCount: rooms.length,
                bedCount: beds.length,
            };
        },
        staleTime: 60_000,
    });
}
