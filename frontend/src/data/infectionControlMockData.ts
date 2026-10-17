import type { InfectionFormValues, InfectionRecord } from '../types/infectionControl';

export const INFECTION_TYPES = [
    'COVID-19',
    'MRSA',
    'C. difficile',
    'Influenza',
    'Norovirus',
    'VRE',
    'UTI (Hospital-acquired)',
    'Surgical Site Infection',
    'Other',
] as const;

export const INFECTION_SEVERITIES = ['Low', 'Moderate', 'High', 'Critical'] as const;

export const INFECTION_STATUSES = ['Active', 'Monitoring', 'Resolved'] as const;

export const ISOLATION_TYPES = ['Contact', 'Droplet', 'Airborne', 'Protective', 'None'] as const;

export const INFECTION_SOURCES = ['Lab Result', 'Clinical Assessment', 'Culture', 'Screening', 'Transfer', 'Other'] as const;

/** Demo seed — keyed by patientId; shown when chart matches. */
export const SEED_INFECTION_RECORDS: InfectionRecord[] = [
    {
        id: 'INF001',
        patientId: 'PAT001',
        encounterId: 'ENC001',
        infectionType: 'COVID-19',
        symptoms: 'Fever, cough',
        source: 'Lab Result',
        severity: 'High',
        isolationRequired: true,
        isolationType: 'Airborne',
        notes: 'PPE mandatory',
        status: 'Active',
        detectedDate: '2026-05-21',
    },
    {
        id: 'INF002',
        patientId: 'PAT001',
        encounterId: 'ENC001',
        infectionType: 'MRSA',
        symptoms: 'Wound erythema',
        source: 'Culture',
        severity: 'Moderate',
        isolationRequired: true,
        isolationType: 'Contact',
        notes: 'Contact precautions signage posted',
        status: 'Monitoring',
        detectedDate: '2026-05-18',
    },
    {
        id: 'INF003',
        patientId: 'PAT001',
        encounterId: 'ENC001',
        infectionType: 'UTI (Hospital-acquired)',
        symptoms: 'Dysuria, elevated WBC',
        source: 'Lab Result',
        severity: 'Low',
        isolationRequired: false,
        isolationType: 'None',
        notes: 'Antibiotic course day 3',
        status: 'Resolved',
        detectedDate: '2026-05-10',
    },
    {
        id: 'INF004',
        patientId: 'PAT002',
        encounterId: 'ENC002',
        infectionType: 'C. difficile',
        symptoms: 'Diarrhea, abdominal pain',
        source: 'Lab Result',
        severity: 'High',
        isolationRequired: true,
        isolationType: 'Contact',
        notes: 'Dedicated commode; EVS terminal clean',
        status: 'Active',
        detectedDate: '2026-05-20',
    },
    {
        id: 'INF005',
        patientId: 'PAT003',
        encounterId: 'ENC003',
        infectionType: 'Influenza',
        symptoms: 'Myalgia, sore throat',
        source: 'Clinical Assessment',
        severity: 'Moderate',
        isolationRequired: true,
        isolationType: 'Droplet',
        notes: 'Mask required for all entrants',
        status: 'Monitoring',
        detectedDate: '2026-05-19',
    },
];

export function createEmptyInfectionForm(): InfectionFormValues {
    return {
        infectionType: '',
        symptoms: '',
        source: 'Clinical Assessment',
        severity: '',
        isolationRequired: false,
        isolationType: 'None',
        notes: '',
        status: '',
        detectedDate: new Date().toISOString().slice(0, 10),
    };
}
