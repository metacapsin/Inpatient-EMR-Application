import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { hydrateAdtEncounters, type AdtEncounterState } from '../../store/adtEncounterSlice';

const PREFIX = 'emr.adt.session:';

/**
 * One-time migration from legacy sessionStorage keys to Redux + localStorage.
 */
export function AdtLegacySessionMigration() {
    const dispatch = useDispatch<AppDispatch>();
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        if (typeof sessionStorage === 'undefined') return;

        const merge: Record<string, AdtEncounterState> = {};
        const keys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k?.startsWith(PREFIX)) keys.push(k);
        }
        for (const key of keys) {
            const pid = key.slice(PREFIX.length).trim();
            if (!pid) continue;
            try {
                const raw = sessionStorage.getItem(key);
                if (!raw) continue;
                const o = JSON.parse(raw) as { encounterId?: unknown; dischargeInitiated?: unknown };
                const encounterId = typeof o.encounterId === 'string' ? o.encounterId.trim() : '';
                if (!encounterId) continue;
                merge[pid] = {
                    encounterId,
                    dischargeInitiated: Boolean(o.dischargeInitiated),
                    currentBedMongoId: null,
                };
                sessionStorage.removeItem(key);
            } catch {
                /* skip corrupt */
            }
        }
        if (Object.keys(merge).length) {
            dispatch(hydrateAdtEncounters(merge));
        }
        try {
            localStorage.removeItem('emr.adt.encounters.v1');
        } catch {
            /* ignore */
        }
    }, [dispatch]);

    return null;
}
