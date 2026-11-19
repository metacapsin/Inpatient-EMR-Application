import { DemoDataBanner } from './DemoDataBanner';

/** All opt-in mock flags; any screen for a module listed here renders a banner when its flag is on. */
export const MOCK_FLAGS = {
    carePlan: import.meta.env.VITE_CARE_PLAN_MOCK === 'true',
    io: import.meta.env.VITE_IO_MOCK === 'true',
    codeEvent: import.meta.env.VITE_CODE_EVENT_MOCK === 'true',
    radiology: import.meta.env.VITE_RADIOLOGY_MOCK === 'true',
    hai: import.meta.env.VITE_HAI_EVENT_MOCK === 'true',
    cdiDenial: import.meta.env.VITE_CDI_DENIAL_MOCK === 'true',
    staffScheduling: import.meta.env.VITE_STAFF_SCHEDULING_MOCK === 'true',
    staffingBoard: import.meta.env.VITE_STAFFING_API_MOCK === 'true',
    unifiedOrders: import.meta.env.VITE_UNIFIED_ORDERS_MOCK === 'true',
    qualityMeasures: import.meta.env.VITE_QUALITY_MEASURE_MOCK !== 'false',
    consent: import.meta.env.VITE_USE_MOCK_API === 'true',
    medication: import.meta.env.VITE_MEDICATION_API_MOCK === 'true',
    facility: import.meta.env.VITE_USE_MOCK_FACILITY === 'true',
} as const;

export type MockFlagKey = keyof typeof MOCK_FLAGS;

/** Renders the demo banner only when the given module's mock flag is explicitly enabled. */
export function MockFlagBanner({ flag, feature }: { flag: MockFlagKey; feature: string }) {
    if (!MOCK_FLAGS[flag]) return null;
    return <DemoDataBanner feature={feature} reason="mock-flag" />;
}
