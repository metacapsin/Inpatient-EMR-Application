/**
 * Nursing head-to-toe flowsheet — Tab 1 field model aligned to assessment sections.
 * `NursingFlowsheetDocument` = API payload + client-only fields for UI/state.
 */

export type FlowsheetDocumentStatus = 'draft' | 'signed' | 'amending';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type ClinicalSeverity = 'normal' | 'warning' | 'critical';

export interface SelectOption<T extends string = string> {
    label: string;
    value: T;
}

/** Section A — client-only supplement; shift date/type also on API root. */
export interface ShiftInfoSection {
    assessedAt: Date | null;
    primaryNurseId: string;
    primaryNurseDisplay: string;
}

/** Section B — Neurological */
export interface NeurologicalSection {
    levelOfConsciousness: string;
    orientation: string[];
    leftPupil: string;
    rightPupil: string;
    gcsE: number | null;
    gcsV: number | null;
    gcsM: number | null;
    extremityMovement: string;
}

/** Section C — Cardiovascular */
export interface CardiovascularSection {
    heartRate: number | null;
    heartRhythm: string;
    peripheralPulseRA: string;
    peripheralPulseLA: string;
    peripheralPulseRL: string;
    capillaryRefill: string;
    edemaDistribution: string;
    edemaGrade: string;
}

/** Section D — Respiratory */
export interface RespiratorySection {
    respiratoryRate: number | null;
    spo2Percent: number | null;
    oxygenDeliveryDevice: string;
    o2FlowLpm: number | null;
    lungSoundsRight: string[];
    lungSoundsLeft: string[];
    cough: string;
    productiveSputumColor: string;
}

/** Backend key: `gastrointestinal` — Section E */
export interface GastrointestinalSection {
    bowelSoundsRuq: string;
    bowelSoundsLuq: string;
    bowelSoundsRlq: string;
    bowelSoundsLlq: string;
    abdomenAppearance: string;
    nauseaOrVomiting: boolean;
    nauseaVomitingDetail: string;
    lastBm: Date | null;
    dietTolerance: string;
}

/** Section F — Genitourinary */
export interface GenitourinarySection {
    urineOutputLast4hMl: number | null;
    urineColor: string;
    foleyCatheterPresent: boolean;
    foleyInsertionDate: Date | null;
    foleyIndication: string;
    bladderDistension: boolean;
}

/** Section G — Integumentary */
export interface IntegumentarySection {
    skinColor: string;
    skinTemperature: string;
    skinTurgor: string;
    woundOrIncisionPresent: boolean;
    woundOrIncisionDetail: string;
    pressureInjuryPresent: boolean;
    pressureInjuryDetail: string;
    rashPresent: boolean;
    rashDetail: string;
    surgicalDrainPresent: boolean;
    surgicalDrainDetail: string;
    bradenScore: number | null;
}

/** Section H — one line per access site */
export interface IvAccessLine {
    id: string;
    accessType: string;
    siteLocation: string;
    gaugeFrench: string;
    insertionDate: Date | null;
    siteCondition: string;
    dressingIntact: boolean;
}

/** Section I — Pain */
export interface PainSection {
    intensity0to10: number | null;
    location: string;
    quality: string[];
    radiation: boolean;
    radiationWhere: string;
    aggravatingFactors: string;
    interventionGiven: string;
}

/** Section J — Musculoskeletal */
export interface MusculoskeletalSection {
    mobilityStatus: string;
    gait: string;
    fallPrecautionsActive: boolean;
    morseFallScore: number | null;
}

/** Section K — Psychosocial */
export interface PsychosocialSection {
    moodAffect: string;
    behavior: string;
    safetyRisk: string[];
    patientEducationProvided: string[];
}

/**
 * Exact backend contract for POST/PUT (no client-only fields).
 * Dates in nested sections may be serialized as ISO strings over the wire.
 */
export interface NursingFlowsheetApiPayload {
    patientId: string;
    encounterId: string;
    tenantId: string;
    /** ISO calendar date (e.g. 2026-05-13) */
    shiftDate: string;
    shiftType: string;
    neurological: NeurologicalSection;
    cardiovascular: CardiovascularSection;
    respiratory: RespiratorySection;
    gastrointestinal: GastrointestinalSection;
    genitourinary: GenitourinarySection;
    integumentary: IntegumentarySection;
    ivAccess: IvAccessLine[];
    pain: PainSection;
    musculoskeletal: MusculoskeletalSection;
    psychosocial: PsychosocialSection;
    signedBy: string | null;
    signedByName: string | null;
    signerCredentials: string | null;
    signedAt: string | null;
    isAmended: boolean;
    amendedBy: string | null;
    amendedAt: string | null;
    amendmentReason: string | null;
}

/** Persisted chart + UI workflow fields (autosave, draft recovery, Epic-style shift strip). */
export interface NursingFlowsheetDocument extends NursingFlowsheetApiPayload {
    id: string;
    chartStatus: FlowsheetDocumentStatus;
    version: number;
    updatedAtIso: string;
    createdAtIso: string;
    shiftInfo: ShiftInfoSection;
    attestationAccepted: boolean;
}

export type NursingFlowsheetPatch = Partial<
    Pick<
        NursingFlowsheetDocument,
        | 'tenantId'
        | 'shiftDate'
        | 'shiftType'
        | 'neurological'
        | 'cardiovascular'
        | 'respiratory'
        | 'gastrointestinal'
        | 'genitourinary'
        | 'integumentary'
        | 'ivAccess'
        | 'pain'
        | 'musculoskeletal'
        | 'psychosocial'
        | 'shiftInfo'
        | 'attestationAccepted'
        | 'chartStatus'
        | 'amendmentReason'
        | 'signedBy'
        | 'signedByName'
        | 'signerCredentials'
        | 'signedAt'
        | 'isAmended'
        | 'amendedBy'
        | 'amendedAt'
    >
>;

/** Strip client-only fields — send this JSON to your API. */
export function toNursingFlowsheetApiPayload(doc: NursingFlowsheetDocument): NursingFlowsheetApiPayload {
    const {
        id: _id,
        chartStatus: _chartStatus,
        version: _version,
        updatedAtIso: _u,
        createdAtIso: _c,
        shiftInfo: _shiftInfo,
        attestationAccepted: _a,
        ...api
    } = doc;
    return api;
}

export interface FlowsheetVersionEntry {
    id: string;
    version: number;
    status: FlowsheetDocumentStatus;
    savedAtIso: string;
    savedByDisplay: string;
    summary: string;
}

export interface FlowsheetAuditEvent {
    id: string;
    atIso: string;
    actorDisplay: string;
    action: string;
    detail: string;
}

export type FlowsheetSectionId =
    | 'shift'
    | 'neuro'
    | 'cardio'
    | 'resp'
    | 'gi'
    | 'gu'
    | 'skin'
    | 'iv'
    | 'pain'
    | 'msk'
    | 'psych'
    | 'signature';

export interface SectionFieldMeta {
    id: string;
    label: string;
    path?: string;
}

export interface FlowsheetUiState {
    activeAccordionIndices: number[];
    historyDrawerVisible: boolean;
    reassessmentBannerDismissed: boolean;
    serverClockSkewMs: number;
}

export interface FlowsheetRuntimeState {
    document: NursingFlowsheetDocument;
    ui: FlowsheetUiState;
    save: {
        status: SaveStatus;
        lastError: string | null;
        lastSavedAtIso: string | null;
        pendingSinceIso: string | null;
    };
    validationErrors: Record<string, string>;
    isLoading: boolean;
    loadError: string | null;
    versions: FlowsheetVersionEntry[];
    auditTrail: FlowsheetAuditEvent[];
}

export type FlowsheetAction =
    | { type: 'HYDRATE'; payload: Partial<FlowsheetRuntimeState> }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_LOAD_ERROR'; payload: string | null }
    | { type: 'PATCH_DOCUMENT'; payload: NursingFlowsheetPatch }
    | { type: 'REPLACE_IV_LINES'; payload: IvAccessLine[] }
    | { type: 'SET_CHART_STATUS'; payload: FlowsheetDocumentStatus }
    | { type: 'SET_SAVE'; payload: Partial<FlowsheetRuntimeState['save']> }
    | { type: 'SET_VALIDATION'; payload: Record<string, string> }
    | { type: 'CLEAR_FIELD_ERROR'; payload: string }
    | { type: 'SET_UI'; payload: Partial<FlowsheetUiState> }
    | { type: 'BUMP_VERSION' }
    | { type: 'APPLY_SIGNED'; payload: { signedAt: string; signedByName: string; signedBy: string } }
    | { type: 'ADD_AUDIT'; payload: FlowsheetAuditEvent }
    | { type: 'ADD_VERSION'; payload: FlowsheetVersionEntry };

/** GCS total from E/V/M subscores (null components treated as 0 for sum display only). */
export function gcsTotal(e: number | null, v: number | null, m: number | null): number | null {
    if (e == null && v == null && m == null) return null;
    return (e ?? 0) + (v ?? 0) + (m ?? 0);
}
