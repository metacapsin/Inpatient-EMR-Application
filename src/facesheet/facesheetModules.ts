import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    BedDouble,
    Building2,
    Hospital,
    ClipboardList,
    FileStack,
    FileText,
    FlaskConical,
    HeartPulse,
    History,
    MessageSquare,
    NotebookPen,
    Pill,
    ShieldAlert,
    Stethoscope,
    Syringe,
    UserRound,
    UsersRound,
} from 'lucide-react';

export type FacesheetModuleGroupId = 'overview' | 'clinical' | 'labs' | 'care' | 'pharmacy' | 'social';

export interface FacesheetModuleDef {
    path: string;
    label: string;
    icon: LucideIcon;
    group: FacesheetModuleGroupId;
}

export const FACESHEET_MODULE_GROUPS: Record<FacesheetModuleGroupId, string> = {
    overview: 'Overview',
    clinical: 'Clinical',
    labs: 'Labs & records',
    care: 'Care plan',
    pharmacy: 'Pharmacy',
    social: 'Social',
};

export const FACESHEET_MODULES: FacesheetModuleDef[] = [
    { path: 'demographic', label: 'Demographics', icon: UserRound, group: 'overview' },
    { path: 'vitals', label: 'Vitals', icon: Activity, group: 'overview' },
    { path: 'location', label: 'Location', icon: BedDouble, group: 'overview' },
    { path: 'adt', label: 'ADT', icon: Hospital, group: 'overview' },
    { path: 'history', label: 'History', icon: History, group: 'clinical' },
    { path: 'diagnoses', label: 'Diagnoses', icon: Stethoscope, group: 'clinical' },
    { path: 'medications', label: 'Medications', icon: Pill, group: 'clinical' },
    { path: 'prescriptions', label: 'Prescriptions', icon: ClipboardList, group: 'clinical' },
    { path: 'allergies', label: 'Allergies', icon: ShieldAlert, group: 'clinical' },
    { path: 'immunizations', label: 'Immunizations', icon: Syringe, group: 'clinical' },
    { path: 'labs', label: 'Labs', icon: FlaskConical, group: 'labs' },
    { path: 'lab-orders', label: 'Lab orders', icon: HeartPulse, group: 'labs' },
    { path: 'documents', label: 'Documents', icon: FileStack, group: 'labs' },
    { path: 'notes', label: 'Notes', icon: NotebookPen, group: 'care' },
    { path: 'preventive-screening', label: 'Preventive', icon: FileText, group: 'care' },
    { path: 'pharmacies', label: 'Pharmacies', icon: Building2, group: 'pharmacy' },
    { path: 'pharmacy-message', label: 'Rx messaging', icon: MessageSquare, group: 'pharmacy' },
    { path: 'visitors-contacts', label: 'Visitors & Contacts', icon: UsersRound, group: 'social' },
];

const ORDER: FacesheetModuleGroupId[] = ['overview', 'clinical', 'labs', 'care', 'pharmacy', 'social'];

export function facesheetModulesByGroup(): { group: FacesheetModuleGroupId; title: string; items: FacesheetModuleDef[] }[] {
    return ORDER.map((group) => ({
        group,
        title: FACESHEET_MODULE_GROUPS[group],
        items: FACESHEET_MODULES.filter((m) => m.group === group),
    })).filter((g) => g.items.length > 0);
}
