import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requiresOverride, effectiveSeverity, sortAlertsBySeverity } from '../src/lib/cds/policy.js';
import { cdsAlertSchema } from '../src/lib/cds/schemas.js';
import { searchDrugs, isStub } from '../src/lib/rxnav.js';

describe('cds policy', () => {
    it('requiresOverride for major/contraindicated only', () => {
        assert.equal(requiresOverride([{ severity: 'minor', message: 'a', ruleId: null, ruleType: null }]), false);
        assert.equal(requiresOverride([{ severity: 'moderate', message: 'a', ruleId: null, ruleType: null }]), false);
        assert.equal(requiresOverride([{ severity: 'major', message: 'a', ruleId: '1', ruleType: 'drug_drug' }]), true);
        assert.equal(requiresOverride([{ severity: 'contraindicated', message: 'a', ruleId: '1', ruleType: 'drug_allergy_class' }]), true);
    });

    it('effectiveSeverity honors suppressed and overrides', () => {
        assert.equal(effectiveSeverity('major', 'suppressed'), null);
        assert.equal(effectiveSeverity('major', 'minor'), 'minor');
        assert.equal(effectiveSeverity('major', null), 'major');
    });

    it('sortAlertsBySeverity puts contraindicated first', () => {
        const sorted = sortAlertsBySeverity([
            { severity: 'minor', message: 'm', ruleId: null, ruleType: null },
            { severity: 'contraindicated', message: 'c', ruleId: '1', ruleType: 'drug_allergy_class' },
            { severity: 'major', message: 'j', ruleId: '2', ruleType: 'drug_drug' },
        ]);
        assert.equal(sorted[0].severity, 'contraindicated');
        assert.equal(sorted[1].severity, 'major');
        assert.equal(sorted[2].severity, 'minor');
    });
});

describe('rxnav stub', () => {
    it('is stub in test and finds warfarin', async () => {
        assert.equal(isStub(), true);
        const hits = await searchDrugs('warf');
        assert.ok(hits.some((h) => h.rxnormCode === '11289'));
        assert.equal(hits[0].name.length > 0, true);
    });
});

describe('cdsAlertSchema', () => {
    it('parses a valid alert', () => {
        const a = cdsAlertSchema.parse({
            ruleId: 'r1',
            ruleType: 'drug_drug',
            severity: 'major',
            message: 'Warfarin + aspirin',
            rxnormCodeA: '11289',
            rxnormCodeB: '1191',
        });
        assert.equal(a.severity, 'major');
    });
});
