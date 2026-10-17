import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';

export type AppLayoutVariant = 'default' | 'facesheet';

export interface AppLayoutContextValue {
    variant: AppLayoutVariant;
    /** Patient id from `/app/facesheet/:id/...` when in facesheet mode */
    facesheetPatientId: string | null;
}

const AppLayoutContext = createContext<AppLayoutContextValue>({
    variant: 'default',
    facesheetPatientId: null,
});

const FACESHEET_PATH = /^\/app\/facesheet\/([^/]+)/;

export function AppLayoutProvider({ children }: PropsWithChildren) {
    const location = useLocation();

    const value = useMemo<AppLayoutContextValue>(() => {
        const m = location.pathname.match(FACESHEET_PATH);
        if (m?.[1]) {
            const id = decodeURIComponent(m[1]).trim();
            if (id) {
                return { variant: 'facesheet', facesheetPatientId: id };
            }
        }
        return { variant: 'default', facesheetPatientId: null };
    }, [location.pathname]);

    return <AppLayoutContext.Provider value={value}>{children}</AppLayoutContext.Provider>;
}

export function useAppLayout(): AppLayoutContextValue {
    return useContext(AppLayoutContext);
}
