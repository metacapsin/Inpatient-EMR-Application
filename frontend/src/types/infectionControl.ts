export type InfectionSeverity = 'Low' | 'Moderate' | 'High' | 'Critical';

export type InfectionStatus = 'Active' | 'Monitoring' | 'Resolved';

export type IsolationType = 'Contact' | 'Droplet' | 'Airborne' | 'Protective' | 'None';

export interface InfectionRecord {
    id: string;
    patientId: string;
    encounterId: string;
    infectionType: string;
    symptoms: string;
    source: string;
    severity: InfectionSeverity;
    isolationRequired: boolean;
    isolationType: IsolationType;
    notes: string;
    status: InfectionStatus;
    detectedDate: string;
}

export interface InfectionFormValues {
    infectionType: string;
    symptoms: string;
    source: string;
    severity: InfectionSeverity | '';
    isolationRequired: boolean;
    isolationType: IsolationType;
    notes: string;
    status: InfectionStatus | '';
    detectedDate: string;
}

export type InfectionFormErrors = Partial<Record<'infectionType' | 'severity' | 'status', string>>;
