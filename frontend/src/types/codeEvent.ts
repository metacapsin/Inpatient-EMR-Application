/** Code Blue / RRT emergency event types and API payloads */

export type CodeEventType =
    | 'Code Blue'
    | 'Rapid Response'
    | 'Code Stroke'
    | 'Code STEMI'
    | 'Code Sepsis'
    | 'Code OB';

export type CodeEventStatus = 'active' | 'closed';

export type CodeTimelineEntryType =
    | 'Rhythm Check'
    | 'CPR Started'
    | 'CPR Stopped'
    | 'Defibrillation'
    | 'Cardioversion'
    | 'Medication Given'
    | 'Airway Established'
    | 'IV Access'
    | 'IO Access'
    | 'Lab Drawn'
    | 'Imaging'
    | 'ROSC'
    | 'Patient Expired'
    | 'Family Notified'
    | 'Other';

export type CodeTeamRole = 'MD' | 'RN' | 'RT' | 'Pharmacist' | 'Charge Nurse' | 'Other';

export type CodeEventOutcome =
    | 'ROSC'
    | 'Patient Expired'
    | 'Transferred to ICU'
    | 'Transferred to Cath Lab'
    | 'Stable — Continued Same Unit'
    | 'Transported to OR';

export type CodePostEventDisposition = 'ICU' | 'Step-Down' | 'Cath Lab' | 'OR' | 'Same Unit' | 'Morgue';

export type CodeEventMedication = {
    name: string;
    dose: string;
    route: string;
};

export type CodeEventTimelineEntry = {
    id: string;
    timestamp: string;
    entryType: CodeTimelineEntryType;
    medication?: CodeEventMedication;
    joules?: number | null;
    notes?: string;
    enteredBy: string;
};

export type CodeEventTeamMember = {
    userId: string;
    name: string;
    role: CodeTeamRole;
    arrivedAt: string;
};

export type CodeEventRecord = {
    id: string;
    patientId: string;
    encounterId: string;
    tenantId: string;
    patientName?: string;
    patientMrn?: string;
    eventType: CodeEventType;
    location: string;
    calledBy: string;
    calledByName: string;
    calledAt: string;
    teamLeadId: string;
    teamLeadName: string;
    teamMembers: CodeEventTeamMember[];
    timeline: CodeEventTimelineEntry[];
    status: CodeEventStatus;
    endTime?: string | null;
    outcome?: CodeEventOutcome | null;
    postEventDisposition?: CodePostEventDisposition | null;
    debriefNotes?: string | null;
    totalDurationMinutes?: number | null;
    unitId?: string;
    announceToUnit?: boolean;
};

export type ActivateCodeEventPayload = {
    patientId: string;
    encounterId: string;
    tenantId: string;
    eventType: CodeEventType;
    location: string;
    calledBy: string;
    calledByName: string;
    calledAt: string;
    teamLeadId: string;
    teamLeadName: string;
    announceToUnit?: boolean;
};

export type CodeEventTimelinePayload = {
    timeline: CodeEventTimelineEntry[];
};

export type CodeEventTeamPayload = {
    teamMembers: CodeEventTeamMember[];
    teamLeadId?: string;
    teamLeadName?: string;
};

export type CloseCodeEventPayload = {
    endTime: string;
    outcome: CodeEventOutcome;
    postEventDisposition: CodePostEventDisposition;
    debriefNotes: string;
    totalDurationMinutes: number;
    status: 'closed';
};

export type CodeEventActivateFormValues = {
    eventType: CodeEventType;
    patientId: string;
    encounterId: string;
    location: string;
    calledBy: string;
    calledByName: string;
    calledAt: string;
    teamLeadId: string;
    teamLeadName: string;
    announceToUnit: boolean;
};

export type CodeEventSummary = Pick<
    CodeEventRecord,
    'id' | 'patientId' | 'patientName' | 'patientMrn' | 'eventType' | 'location' | 'status' | 'calledAt' | 'teamLeadName'
>;
