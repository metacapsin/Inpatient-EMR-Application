import { z } from 'zod';

export const AUDIT_ACTIONS = [
    'read',
    'create',
    'update',
    'delete',
    'login',
    'login_failed',
    'logout',
    'refresh',
    'password_reset',
    'export',
    'platform',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditEventSchema = z.object({
    id: z.string(),
    tenantId: z.string().nullable().optional(),
    actorType: z.enum(['staff', 'platform_admin', 'patient', 'anonymous']),
    actorId: z.string().nullable().optional(),
    actorRole: z.string().nullable().optional(),
    action: z.string(),
    resource: z.string().nullable().optional(),
    resourceId: z.string().nullable().optional(),
    patientId: z.string().nullable().optional(),
    encounterId: z.string().nullable().optional(),
    method: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    queryKeys: z.array(z.string()).optional().default([]),
    status: z.number().nullable().optional(),
    latencyMs: z.number().nullable().optional(),
    ip: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    details: z.record(z.string(), z.unknown()).optional().default({}),
    at: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export interface AuditEventFilters {
    patientId?: string;
    actorId?: string;
    action?: string;
    resource?: string;
    from?: string;
    to?: string;
    limit?: number;
    skip?: number;
}
