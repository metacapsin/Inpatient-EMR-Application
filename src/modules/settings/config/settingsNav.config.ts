import type { LucideIcon } from 'lucide-react';
import { Building2, ClipboardList } from 'lucide-react';

export type SettingsNavId = 'facility' | 'practice';

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
];
