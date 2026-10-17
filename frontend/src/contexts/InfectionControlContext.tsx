import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { SEED_INFECTION_RECORDS } from '../data/infectionControlMockData';
import type { InfectionRecord } from '../types/infectionControl';

type InfectionControlContextValue = {
    records: InfectionRecord[];
    getByPatientId: (patientId: string) => InfectionRecord[];
    addRecord: (record: Omit<InfectionRecord, 'id'>) => InfectionRecord;
    updateRecord: (id: string, patch: Partial<InfectionRecord>) => void;
    deleteRecord: (id: string) => void;
};

const InfectionControlContext = createContext<InfectionControlContextValue | null>(null);

let nextId = 100;

function generateId(): string {
    nextId += 1;
    return `INF${String(nextId).padStart(3, '0')}`;
}

export function InfectionControlProvider({ children }: { children: ReactNode }) {
    const [records, setRecords] = useState<InfectionRecord[]>(() => [...SEED_INFECTION_RECORDS]);

    const getByPatientId = useCallback(
        (patientId: string) =>
            records.filter((r) => r.patientId.trim() === patientId.trim()),
        [records]
    );

    const addRecord = useCallback((record: Omit<InfectionRecord, 'id'>) => {
        const created: InfectionRecord = { ...record, id: generateId() };
        setRecords((prev) => [created, ...prev]);
        return created;
    }, []);

    const updateRecord = useCallback((id: string, patch: Partial<InfectionRecord>) => {
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)));
    }, []);

    const deleteRecord = useCallback((id: string) => {
        setRecords((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const value = useMemo(
        () => ({ records, getByPatientId, addRecord, updateRecord, deleteRecord }),
        [records, getByPatientId, addRecord, updateRecord, deleteRecord]
    );

    return (
        <InfectionControlContext.Provider value={value}>{children}</InfectionControlContext.Provider>
    );
}

export function useInfectionControl(): InfectionControlContextValue {
    const ctx = useContext(InfectionControlContext);
    if (!ctx) {
        throw new Error('useInfectionControl must be used within InfectionControlProvider');
    }
    return ctx;
}
