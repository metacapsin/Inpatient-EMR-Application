import type { FamilyMemberData } from '../types/family';

/**
 * Searchable patient fixtures (same records as Family Members static search).
 * IDs are real Mongo patient keys used with GET /Patient/getPatientByID and the patient list API.
 */
export const DEMO_PATIENT_SEARCH_FIXTURES: FamilyMemberData[] = [
    {
        _id: '696b3e59d0c882d0b569684f',
        profilePictureUrl:
            'https://emr-backend-files.s3.us-east-1.amazonaws.com/94f6a6d9-7871-4a7a-beed-e4f72ec4a7fa/696b3e59d0c882d0b569684f/profile/5f11e46144b1d1ce5f682427dba2c41a8157dd9b.png',
        firstName: 'Akbaruddin',
        middleName: 'AO',
        lastName: 'Owaisi',
        suffix: 'Sr.',
        prefix: 'Mr.',
        dOB: '12/12/2000',
        sex: 'M',
        emailAddress: 'akbar@yopmail.com',
        fullName: 'Akbaruddin AO Owaisi',
        homePhone: '(830) 250-8166',
        mobilePhone: '(830) 250-8166',
        address1: 'bijainagar',
        address2: 'ajmer',
        city: 'Bijainagar',
        state: 'NY',
        zip: '90001',
        mrn: '25000207',
        lastVisitDate: '02/14/2026',
    },
    {
        _id: '696b3e59d0c882d0b569684e',
        firstName: 'Jane',
        middleName: 'M',
        lastName: 'Doe',
        fullName: 'Jane M Doe',
        emailAddress: 'jane.doe@example.com',
        mobilePhone: '(555) 123-4567',
        dOB: '05/15/1995',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        mrn: '25000208',
    },
    {
        _id: '696b3e59d0c882d0b569684d',
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
        emailAddress: 'john.smith@example.com',
        homePhone: '(555) 987-6543',
        dOB: '08/22/1988',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        mrn: '25000209',
    },
    {
        _id: '696b3e59d0c882d0b569684c',
        firstName: 'Maria',
        middleName: 'R',
        lastName: 'Garcia',
        fullName: 'Maria R Garcia',
        emailAddress: 'maria.garcia@example.com',
        mobilePhone: '(555) 456-7890',
        dOB: '03/10/1992',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        mrn: '25000210',
    },
];

export type DemoPatientRef = {
    id: string;
    patientName: string;
    mrn: string;
};

function fixtureDisplayName(p: FamilyMemberData): string {
    const full = p.fullName?.trim();
    if (full) return full;
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() || 'Patient';
}

/** Unified orders mock slots map to registry patients (0–3). */
export function demoPatientBySlot(slot: 0 | 1 | 2 | 3): DemoPatientRef {
    const p = DEMO_PATIENT_SEARCH_FIXTURES[slot];
    const id = p._id?.trim() || '';
    return {
        id,
        patientName: fixtureDisplayName(p),
        mrn: p.mrn?.trim() || '—',
    };
}
