import { z } from 'zod';

export const SMART_SCOPES = [
    'openid',
    'fhirUser',
    'launch/patient',
    'offline_access',
    'patient/*.read',
    'patient/Patient.read',
    'patient/Encounter.read',
    'patient/Condition.read',
    'patient/AllergyIntolerance.read',
    'patient/MedicationRequest.read',
    'patient/Observation.read',
    'patient/Immunization.read',
    'patient/DocumentReference.read',
] as const;
export type SmartScope = (typeof SMART_SCOPES)[number];

export const SCOPE_LABELS: Record<string, string> = {
    openid: 'Sign you in',
    fhirUser: 'Identify you as the patient',
    'launch/patient': 'Open your chart',
    offline_access: 'Stay connected when offline',
    'patient/*.read': 'Read all of your clinical data',
    'patient/Patient.read': 'Read your demographics',
    'patient/Encounter.read': 'Read your visits',
    'patient/Condition.read': 'Read your problem list',
    'patient/AllergyIntolerance.read': 'Read your allergies',
    'patient/MedicationRequest.read': 'Read your medications',
    'patient/Observation.read': 'Read vitals and lab results',
    'patient/Immunization.read': 'Read your immunizations',
    'patient/DocumentReference.read': 'Read your clinical documents',
};

export const patientAccountSchema = z.object({
    id: z.string().optional().nullable(),
    patientId: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    isActive: z.boolean().optional().nullable(),
    status: z.enum(['none', 'invited', 'active', 'deactivated']).or(z.string()),
    lastLoginAt: z.string().nullable().optional(),
    createdAt: z.string().optional().nullable(),
    hasPassword: z.boolean().optional(),
    emailSent: z.boolean().optional(),
    inviteToken: z.string().optional(),
});
export type PatientAccountStatus = z.infer<typeof patientAccountSchema>;

export const smartClientSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    name: z.string(),
    redirectUris: z.array(z.string()),
    allowedScopes: z.array(z.string()),
    isConfidential: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string().optional().nullable(),
    clientSecret: z.string().optional(),
});
export type SmartClient = z.infer<typeof smartClientSchema>;
