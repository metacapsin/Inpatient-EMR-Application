import type { LucideIcon } from 'lucide-react';
import { BellRing, Building2, ClipboardList, Pill } from 'lucide-react';

export type SettingsNavId = 'facility' | 'practice' | 'pharmacies' | 'careNotifications';

export interface SettingsNavItem {
    id: SettingsNavId;
    label: string;
    description: string;
    icon: LucideIcon;
    sectionId: string;
}

/** Scalable nav registry — add future modules here without restructuring the sidebar. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
    {
        id: 'facility',
        label: 'Facility Management',
        description: 'Wards, rooms, beds & occupancy',
        icon: Building2,
        sectionId: 'settings-facility',
    },
    {
        id: 'practice',
        label: 'Practice Information',
        description: 'Organization profile & identifiers',
        icon: ClipboardList,
        sectionId: 'settings-practice',
    },
    {
        id: 'pharmacies',
        label: 'Pharmacies',
        description: 'e-Prescribing pharmacy directory',
        icon: Pill,
        sectionId: 'settings-pharmacies',
    },
    {
        id: 'careNotifications',
        label: 'Care Notifications',
        description: 'ADT notifications to PCP / post-acute (CMS CoP)',
        icon: BellRing,
        sectionId: 'settings-care-notifications',
    },
];
