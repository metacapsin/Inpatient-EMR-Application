// Pure-function tests for the Stedi 270 builder / 271 summarizer (no DB, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEligibilityRequest, summarizeEligibilityResponse, resolvePayerId, formatDob, flattenPayerHit } from '../src/lib/eligibilityMapper.js';

const patient = { firstName: 'Jane', lastName: 'Doe', dOB: '1990-04-12', sex: 'F' };
const practice = { organizationName: 'Codavia Health', npi: '1234567893' };

test('mapper: builds a 270 request from our storage shapes', () => {
    const req = buildEligibilityRequest({
        patient, practice,
        insurance: { insuranceCompany: 'Aetna', tradingPartnerServiceId: '60054', subscriberId: 'W123', groupNumber: 'G1' },
        serviceTypeCodes: ['48'],
    });
    assert.deepEqual(req, {
        tradingPartnerServiceId: '60054',
        provider: { organizationName: 'Codavia Health', npi: '1234567893' },
        subscriber: { memberId: 'W123', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '19900412', gender: 'F', groupNumber: 'G1' },
        encounter: { serviceTypeCodes: ['48'] },
    });
});

test('mapper: payer resolution — picked id wins, static map is the fallback, Medicare always CMS', () => {
    assert.equal(buildEligibilityRequest({ patient, practice, insurance: { insuranceCompany: 'Cigna', subscriberId: 'x' } }).tradingPartnerServiceId, 'CIGNA');
    assert.equal(buildEligibilityRequest({ patient, practice, insurance: { insuranceCompany: 'Medicare', tradingPartnerServiceId: 'Z95707', subscriberId: 'x' } }).tradingPartnerServiceId, 'CMS');
    assert.equal(resolvePayerId('  BCBS '), 'BCBSTX');
    assert.equal(resolvePayerId('Some Unknown Payer'), null);
    assert.throws(() => buildEligibilityRequest({ patient, practice, insurance: { insuranceCompany: 'Some Unknown Payer', subscriberId: 'x' } }), /Unsupported payer/);
});

test('mapper: input guards (DOB, member id, NPI) and defaults (service type 30, formatted NPI)', () => {
    assert.throws(() => buildEligibilityRequest({ patient: { ...patient, dOB: '' }, practice, insurance: { insuranceCompany: 'Aetna', subscriberId: 'x' } }), /date of birth/);
    assert.throws(() => buildEligibilityRequest({ patient, practice, insurance: { insuranceCompany: 'Aetna' } }), /member ID/);
    assert.throws(() => buildEligibilityRequest({ patient, practice: { npi: '12' }, insurance: { insuranceCompany: 'Aetna', subscriberId: 'x' } }), /NPI/);
    const req = buildEligibilityRequest({ patient: { ...patient, sex: 'O', dOB: '04/12/1990' }, practice: { npi: '12-3456-7893' }, insurance: { insuranceCompany: 'Aetna', subscriberId: 'x' } });
    assert.equal(req.provider.npi, '1234567893');
    assert.equal(req.provider.organizationName, 'EMR Practice');
    assert.equal(req.subscriber.gender, undefined, 'unmappable sex is dropped so Stedi does not 400');
    assert.equal(req.subscriber.dateOfBirth, '19900412');
    assert.deepEqual(req.encounter.serviceTypeCodes, ['30']);
    assert.equal(formatDob('not a date'), null);
});

const sample271 = {
    id: 'ec_123', tradingPartnerServiceId: '60054',
    payer: { name: 'AETNA', payorIdentification: '60054' },
    provider: { providerName: 'Codavia Health', npi: '1234567893' },
    subscriber: { memberId: 'W123', firstName: 'JANE', lastName: 'DOE', dateOfBirth: '19900412', gender: 'F', groupNumber: 'G1' },
    planInformation: { groupNumber: 'G1', groupDescription: 'ACME CORP', planNumber: 'P9' },
    planDateInformation: { planBegin: '20250101', planEnd: '20251231', service: '20261028' },
    planStatus: [{ statusCode: '1', status: 'Active Coverage', planDetails: 'Open Choice PPO' }],
    benefitsInformation: [
        { code: '1', name: 'Active Coverage', serviceTypeCodes: ['30'], planCoverage: 'Open Choice PPO', insuranceType: 'Preferred Provider Organization (PPO)', insuranceTypeCode: 'PR', coverageLevel: 'Family', inPlanNetworkIndicatorCode: 'Y' },
        { code: 'B', name: 'Co-Payment', benefitAmount: '30', inPlanNetworkIndicatorCode: 'Y' },
        { code: 'C', name: 'Deductible', benefitAmount: '1500', timeQualifierCode: '25', inPlanNetworkIndicatorCode: 'Y' },
        { code: 'C', name: 'Deductible', benefitAmount: '200', timeQualifierCode: '29', inPlanNetworkIndicatorCode: 'Y' },
        { code: 'G', name: 'Out of Pocket (Stop Loss)', benefitAmount: '6000', timeQualifierCode: '25', inPlanNetworkIndicatorCode: 'Y' },
        { code: 'C', name: 'Deductible', benefitAmount: '3000', timeQualifierCode: '25', inPlanNetworkIndicatorCode: 'N' },
    ],
    warnings: [{ code: 'W1', description: 'Minor warning' }],
};

test('mapper: summarizes an active 271 with in-network amounts and plan metadata', () => {
    const s = summarizeEligibilityResponse(sample271);
    assert.equal(s.status, 'active');
    assert.equal(s.planName, 'Open Choice PPO');
    assert.equal(s.coverageStartDate, '20250101');
    assert.equal(s.coverageEndDate, '20251231');
    assert.equal(s.copay, '30');
    assert.equal(s.deductible, '1500', 'plan-year (25) in-network deductible preferred over remaining (29)');
    assert.equal(s.outOfPocketMax, '6000');
    assert.equal(s.inNetwork, true);
    assert.equal(s.payerName, 'AETNA');
    assert.equal(s.eligibilityCheckId, 'ec_123');
    assert.deepEqual(s.warnings, ['Minor warning']);
    assert.equal(s.details.insuranceType, 'Preferred Provider Organization (PPO)');
    assert.equal(s.details.coverageLevel, 'Family');
    assert.equal(s.details.groupNumber, 'G1');
    assert.equal(s.details.benefits.outOfNetwork.deductible.length, 1);
});

test('mapper: inactive, error-only and empty responses', () => {
    assert.equal(summarizeEligibilityResponse({ benefitsInformation: [{ code: '6', name: 'Inactive' }] }).status, 'inactive');
    const err = summarizeEligibilityResponse({ errors: [{ code: '72', description: 'Invalid/Missing Subscriber/Insured ID' }] });
    assert.equal(err.status, 'error');
    assert.deepEqual(err.errors, ['Invalid/Missing Subscriber/Insured ID']);
    assert.equal(summarizeEligibilityResponse(null).status, 'unknown');
    assert.equal(summarizeEligibilityResponse({ benefitsInformation: [] }).status, 'unknown');
});

test('mapper: flattens Stedi payer search hits', () => {
    const row = flattenPayerHit({ payer: { stediId: 'AETNA', displayName: 'Aetna', primaryPayerId: '60054', aliases: ['AETNA INC'], transactionSupport: { eligibilityCheck: 'SUPPORTED' } }, score: 9 });
    assert.deepEqual(row, { stediId: 'AETNA', displayName: 'Aetna', primaryPayerId: '60054', aliases: ['AETNA INC'], transactions: { eligibilityCheck: 'SUPPORTED' } });
    assert.deepEqual(flattenPayerHit(row), row);
});
