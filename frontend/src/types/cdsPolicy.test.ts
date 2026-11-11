import { describe, expect, it } from 'vitest';
import { cdsAlertSchema, requiresOverride, sortAlertsBySeverity } from './cds';

describe('cds policy helpers', () => {
    it('requiresOverride only for major/contraindicated', () => {
        expect(requiresOverride([{ ruleId: null, ruleType: null, severity: 'minor', message: 'x' }])).toBe(false);
        expect(requiresOverride([{ ruleId: '1', ruleType: 'drug_drug', severity: 'major', message: 'x' }])).toBe(true);
    });

    it('sorts by severity desc', () => {
        const sorted = sortAlertsBySeverity([
            { ruleId: null, ruleType: null, severity: 'minor', message: 'm' },
            { ruleId: '1', ruleType: 'drug_allergy_class', severity: 'contraindicated', message: 'c' },
        ]);
        expect(sorted[0]?.severity).toBe('contraindicated');
    });

    it('rejects malformed alert payloads', () => {
        expect(() => cdsAlertSchema.parse({ severity: 'mega', message: 'x' })).toThrow();
    });

    it('keeps major/contraindicated alerts visible for live preview (not filtered away)', () => {
        const alerts = [
            cdsAlertSchema.parse({ ruleId: '1', ruleType: 'drug_allergy_class', severity: 'contraindicated', message: 'DA' }),
            cdsAlertSchema.parse({ ruleId: '2', ruleType: 'drug_drug', severity: 'moderate', message: 'DDI' }),
        ];
        const sorted = sortAlertsBySeverity(alerts);
        expect(sorted).toHaveLength(2);
        expect(requiresOverride(sorted)).toBe(true);
        expect(sorted.map((a) => a.severity)).toEqual(['contraindicated', 'moderate']);
    });
});
