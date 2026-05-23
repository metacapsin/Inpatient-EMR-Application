import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    BedDouble,
    Biohazard,
    Hospital,
    ClipboardList,
    ClipboardPenLine,
    FileSignature,
    FileStack,
    FileText,
    Receipt,
    FlaskConical,
    History,
    NotebookPen,
    Pill,
    ShieldAlert,
    ShieldCheck,
    ScanLine,
    Stethoscope,
    Syringe,
    TestTubes,
    UserRound,
    UsersRound,
    UtensilsCrossed,
} from 'lucide-react';

export type FacesheetModuleGroupId = 'overview' | 'clinical' | 'labs' | 'care' | 'social';

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
    social: 'Social',
};

export const FACESHEET_MODULES: FacesheetModuleDef[] = [
    { path: 'demographic', label: 'Demographics', icon: UserRound, group: 'overview' },
    { path: 'dietary', label: 'Dietary', icon: UtensilsCrossed, group: 'overview' },
    { path: 'vitals', label: 'Vitals', icon: Activity, group: 'overview' },
    { path: 'location', label: 'Location', icon: BedDouble, group: 'overview' },
    { path: 'adt', label: 'ADT', icon: Hospital, group: 'overview' },
    { path: 'prior-auth', label: 'Prior Auth', icon: ShieldCheck, group: 'overview' },
    { path: 'invoices', label: 'Invoices', icon: Receipt, group: 'overview' },
    { path: 'history', label: 'History', icon: History, group: 'clinical' },
    { path: 'diagnoses', label: 'Diagnoses', icon: Stethoscope, group: 'clinical' },
    { path: 'medications', label: 'Medications', icon: Pill, group: 'clinical' },
    { path: 'prescriptions', label: 'Prescriptions', icon: ClipboardList, group: 'clinical' },
    { path: 'allergies', label: 'Allergies', icon: ShieldAlert, group: 'clinical' },
    { path: 'immunizations', label: 'Immunizations', icon: Syringe, group: 'clinical' },
    {
        path: 'clinical/nursing-flowsheet',
        label: 'Nursing Flowsheet',
        icon: ClipboardPenLine,
        group: 'clinical',
    },
    {
        path: 'clinical/care-plan',
        label: 'Care Plan',
        icon: ClipboardList,
        group: 'clinical',
    },
    {
        path: 'infection-control',
        label: 'Infection Control',
        icon: Biohazard,
        group: 'clinical',
    },
    { path: 'labs', label: 'Labs', icon: FlaskConical, group: 'labs' },
    { path: 'lab-orders', label: 'Lab Orders', icon: TestTubes, group: 'labs' },
    { path: 'radiology', label: 'Radiology', icon: ScanLine, group: 'labs' },
    { path: 'documents', label: 'Documents', icon: FileStack, group: 'labs' },
    { path: 'consents', label: 'Consents', icon: FileSignature, group: 'labs' },
    { path: 'notes', label: 'Notes', icon: NotebookPen, group: 'care' },
    { path: 'preventive-screening', label: 'Preventive', icon: FileText, group: 'care' },
    { path: 'visitors-contacts', label: 'Visitors & Contacts', icon: UsersRound, group: 'social' },
];

/** Hidden from sidebar and mobile module tabs; direct URLs still work. */
const HIDDEN_FACESHEET_NAV_PATHS = new Set([
    'vitals',
    'location',
    'history',
    'prescriptions',
    'immunizations',
    'preventive-screening',
]);

function isVisibleInChartNav(m: FacesheetModuleDef): boolean {
    return !HIDDEN_FACESHEET_NAV_PATHS.has(m.path);
}

const ORDER: FacesheetModuleGroupId[] = ['overview', 'clinical', 'labs', 'care', 'social'];

/** Modules shown in patient chart sidebar and mobile tab strip. */
export function visibleFacesheetModules(): FacesheetModuleDef[] {
    return FACESHEET_MODULES.filter(isVisibleInChartNav);
}

export function facesheetModulesByGroup(): { group: FacesheetModuleGroupId; title: string; items: FacesheetModuleDef[] }[] {
    return ORDER.map((group) => ({
        group,
        title: FACESHEET_MODULE_GROUPS[group],
        items: FACESHEET_MODULES.filter((m) => m.group === group && isVisibleInChartNav(m)),
    })).filter((g) => g.items.length > 0);
}

const MODULES_BY_PATH_LENGTH = [...FACESHEET_MODULES].sort((a, b) => b.path.length - a.path.length);

/** Resolve active chart module from `/app/facesheet/:id/...` pathname. */
export function resolveFacesheetModuleFromPath(pathname: string): FacesheetModuleDef | null {
    const match = pathname.match(/^\/app\/facesheet\/[^/]+\/(.+?)\/?$/);
    if (!match?.[1]) return null;
    const sub = match[1];
    return (
        MODULES_BY_PATH_LENGTH.find((m) => sub === m.path || sub.startsWith(`${m.path}/`)) ?? null
    );
}
