/**
 * Code Blue / RRT — facade over API with mock fallback.
 * Import from here in pages and shared components.
 */

export {
    activateCodeEvent,
    closeCodeEvent,
    fetchActiveCodeEventsByUnit,
    fetchCodeEventById,
    fetchCodeEventByPatient,
    generateCodeEventNote,
    getLastCodeEventDataSource,
    listOnShiftStaffForCodeEvent,
    updateCodeEventTeam,
    updateCodeEventTimeline,
} from '../features/code-event/api/codeEventWithFallback';

export type { CodeEventDataSource } from '../features/code-event/api/codeEventWithFallback';
