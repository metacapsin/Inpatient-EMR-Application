import { z } from 'zod';
import type { ConsentType, InterpreterType, SignedByType } from '../../../types/consent';

const consentTypeEnum = z.enum([
    'General Treatment',
    'Surgery',
    'Anesthesia',
    'Blood Products',
    'Research',
    'HIPAA NPP',
    'Procedure-Specific',
] as [ConsentType, ...ConsentType[]]);

const signerTypeEnum = z.enum([
    'Patient',
    'Legal Guardian',
    'Healthcare Proxy',
    'Power of Attorney',
] as [SignedByType, ...SignedByType[]]);

const interpreterTypeEnum = z.enum(['In-person', 'Phone', 'Video'] as [InterpreterType, ...InterpreterType[]]);

const nonEmptySignature = z
    .string()
    .min(1, 'Signature is required')
    .refine((v) => v.length > 50 && v.startsWith('data:image'), 'Please sign in the pad');

export const obtainConsentFormSchema = z
    .object({
        consentType: consentTypeEnum,
        procedureName: z.string().optional(),
        templateVersion: z.string(),
        signedByType: signerTypeEnum,
        signedByName: z.string().min(1, 'Signer name is required'),
        signedByRelationship: z.string().optional(),
        patientHasCapacity: z.boolean(),
        capacityAssessmentNote: z.string().optional(),
        languageUsed: z.string().min(1, 'Language is required'),
        interpreterUsed: z.boolean(),
        interpreterName: z.string().optional(),
        interpreterType: interpreterTypeEnum.optional(),
        patientSignatureData: nonEmptySignature,
        witnessSignatureData: nonEmptySignature,
        witnessName: z.string().min(1),
        signedAt: z.string().min(1),
        obtainedByName: z.string().min(1),
    })
    .superRefine((data, ctx) => {
        if (data.consentType === 'Procedure-Specific' && !data.procedureName?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Procedure name is required for procedure-specific consent',
                path: ['procedureName'],
            });
        }
        if (!data.patientHasCapacity && !data.capacityAssessmentNote?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Capacity assessment note is required when patient lacks decision-making capacity',
                path: ['capacityAssessmentNote'],
            });
        }
        if (data.signedByType !== 'Patient' && !data.signedByRelationship?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Signer relationship is required',
                path: ['signedByRelationship'],
            });
        }
        if (data.interpreterUsed) {
            if (!data.interpreterName?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Interpreter name or service is required',
                    path: ['interpreterName'],
                });
            }
            if (!data.interpreterType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Interpreter type is required',
                    path: ['interpreterType'],
                });
            }
        }
    });

export type ObtainConsentFormValues = z.infer<typeof obtainConsentFormSchema>;

export const revokeConsentSchema = z.object({
    revokedReason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)'),
});

export type RevokeConsentFormValues = z.infer<typeof revokeConsentSchema>;
