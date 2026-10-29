import { describe, expect, it } from 'vitest';
import {
    EMPTY_CONTACT,
    EMPTY_INSURANCE,
    ageInYears,
    formatUsPhone,
    validateRegistration,
    validPersonalFixture,
    type RegistrationInput,
} from './patientRegistrationValidation';

const TODAY = '2026-10-28';
const base = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
    form: validPersonalFixture(),
    hasInsurance: 'no',
    hasSecondary: 'no',
    insurance: EMPTY_INSURANCE,
    secondary: EMPTY_INSURANCE,
    contacts: [EMPTY_CONTACT, EMPTY_CONTACT],
    ...over,
});

describe('formatUsPhone', () => {
    it('formats progressively as digits are typed', () => {
        expect(formatUsPhone('217')).toBe('217');
        expect(formatUsPhone('2175')).toBe('(217) 5');
        expect(formatUsPhone('2175550101')).toBe('(217) 555-0101');
    });
    it('strips non-digits and caps at 10 digits', () => {
        expect(formatUsPhone('+1 (217) 555-0101 ext 9')).toBe('(121) 755-5010');
    });
});

describe('ageInYears', () => {
    it('counts completed years only', () => {
        expect(ageInYears('2008-10-29', new Date(TODAY))).toBe(17);
        expect(ageInYears('2008-10-28', new Date(TODAY))).toBe(18);
        expect(ageInYears('', new Date(TODAY))).toBeNull();
        expect(ageInYears('not-a-date', new Date(TODAY))).toBeNull();
    });
});

describe('validateRegistration', () => {
    it('accepts the minimal valid form', () => {
        expect(validateRegistration(base(), TODAY)).toEqual({});
    });

    it('requires identity, address and both phones', () => {
        const e = validateRegistration(base({ form: validPersonalFixture({ firstName: '', lastName: '', dOB: '', sex: '', maritalStatus: '', address1: '', city: '', state: '', zipCode: '', homePhone: '', mobilePhone: '' }) }), TODAY);
        expect(Object.keys(e).sort()).toEqual(['address1', 'city', 'dOB', 'firstName', 'homePhone', 'lastName', 'maritalStatus', 'mobilePhone', 'sex', 'state', 'zipCode']);
    });

    it('rejects future DOB, numeric-only names, bad emails and short zips', () => {
        const e = validateRegistration(base({ form: validPersonalFixture({ dOB: '2030-01-01', firstName: '1234', email: 'nope@', zipCode: '123', workPhone: '555' }) }), TODAY);
        expect(e.dOB).toMatch(/future/);
        expect(e.firstName).toMatch(/invalid/);
        expect(e.email).toBeDefined();
        expect(e.zipCode).toBeDefined();
        expect(e.workPhone).toBeDefined();
    });

    it('skips mailing-address checks when same-as-home is set', () => {
        const bad = validateRegistration(base({ form: validPersonalFixture({ mailingZipCode: '12' }) }), TODAY);
        expect(bad.mailingZipCode).toBeDefined();
        const ok = validateRegistration(base({ form: validPersonalFixture({ mailingZipCode: '12', mailingSameAsHome: true }) }), TODAY);
        expect(ok.mailingZipCode).toBeUndefined();
    });

    it('insurance: company + member id required, at least one block Active', () => {
        const ins = { ...EMPTY_INSURANCE, insuranceCompany: 'Aetna', subscriberId: 'A1', insuranceStatus: 'Inactive' as const };
        const e = validateRegistration(base({ hasInsurance: 'yes', insurance: ins }), TODAY);
        expect(e['insurance.insuranceStatus']).toMatch(/at least one/i);
        const sec = { ...ins, insuranceStatus: 'Active' as const };
        expect(validateRegistration(base({ hasInsurance: 'yes', hasSecondary: 'yes', insurance: ins, secondary: sec }), TODAY)).toEqual({});
        const missing = validateRegistration(base({ hasInsurance: 'yes', insurance: EMPTY_INSURANCE }), TODAY);
        expect(missing['insurance.insuranceCompany']).toBeDefined();
        expect(missing['insurance.subscriberId']).toBeDefined();
    });

    it('insurance: minors cannot be their own guarantor; non-self guarantor needs a name', () => {
        const ins = { ...EMPTY_INSURANCE, insuranceCompany: 'Aetna', subscriberId: 'A1' };
        const minor = validateRegistration(base({ form: validPersonalFixture({ dOB: '2015-05-05' }), hasInsurance: 'yes', insurance: ins }), TODAY);
        expect(minor['insurance.guarantor']).toMatch(/minor/);
        const spouse = validateRegistration(base({ hasInsurance: 'yes', insurance: { ...ins, guarantor: 'Spouse', guarantorDOB: '2031-01-01' } }), TODAY);
        expect(spouse['insurance.guarantorName']).toBeDefined();
        expect(spouse['insurance.guarantorDOB']).toMatch(/future/);
    });

    it('insurance: termination before effective date is rejected', () => {
        const ins = { ...EMPTY_INSURANCE, insuranceCompany: 'Aetna', subscriberId: 'A1', coverageStartDate: '2025-06-01', terminationDate: '2025-01-01' };
        expect(validateRegistration(base({ hasInsurance: 'yes', insurance: ins }), TODAY)['insurance.terminationDate']).toBeDefined();
    });

    it('emergency contacts are optional, but a started contact needs name + valid phone', () => {
        expect(validateRegistration(base(), TODAY)).toEqual({});
        const started = validateRegistration(base({ contacts: [{ ...EMPTY_CONTACT, relationshipToPatient: 'Spouse' }, EMPTY_CONTACT] }), TODAY);
        expect(started['contact0.contactName']).toBeDefined();
        expect(started['contact0.contactPhone']).toBeDefined();
        const second = validateRegistration(base({ contacts: [EMPTY_CONTACT, { ...EMPTY_CONTACT, contactName: 'Sam', contactPhone: '(217) 555-0199', emergencyZipCode: '1' }] }), TODAY);
        expect(second['contact1.emergencyZipCode']).toBeDefined();
        expect(second['contact1.contactName']).toBeUndefined();
    });
});
