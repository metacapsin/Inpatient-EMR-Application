import { describe, expect, it } from 'vitest';
import { SMART_SCOPES, patientAccountSchema, smartClientSchema } from './patientAccess';

describe('patientAccess schemas', () => {
    it('includes patient/*.read in SMART_SCOPES', () => {
        expect(SMART_SCOPES).toContain('patient/*.read');
        expect(SMART_SCOPES).toContain('offline_access');
    });

    it('parses portal account status', () => {
        const a = patientAccountSchema.parse({ status: 'invited', email: 'a@b.com', isActive: true });
        expect(a.status).toBe('invited');
    });

    it('parses smart client', () => {
        const c = smartClientSchema.parse({
            id: '1',
            clientId: 'app',
            name: 'App',
            redirectUris: ['http://localhost/cb'],
            allowedScopes: ['patient/*.read'],
            isConfidential: false,
            isActive: true,
        });
        expect(c.clientId).toBe('app');
    });
});
