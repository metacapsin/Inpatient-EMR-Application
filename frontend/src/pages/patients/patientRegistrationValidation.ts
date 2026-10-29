/**
 * Pure state shapes, formatters and validation for patient registration (create and edit).
 * Kept free of React so the rules can be unit-tested. Rules port the *intent* of EMR-ng's
 * patient-form-validation.service.ts, not its Angular validator code.
 */
import type { PatientEmergencyContactInput, PatientInsuranceInput } from '../../services/patient.service';

export const PERSON_NAME = /^(?! )(?=.*[A-Za-z])[A-Za-z0-9.'-]+(?: [A-Za-z0-9.'-]+)*(?<! )$/;
export const CITY_NAME = /^(?! )[A-Za-z.'-]+(?: [A-Za-z.'-]+)*(?<! )$/;
export const EMAIL = /^(?!\s)([a-z0-9]+([._%+-]?[a-z0-9]+)*)@[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;
export const PHONE_US = /^(?!\(000\) 000-0000$)\(\d{3}\) \d{3}-\d{4}$/;
export const ZIP_US = /^\d{5}$/;
export const MONEY = /^(\d+(\.\d{1,2})?)?$/;

/** Live-format a phone as (XXX) XXX-XXXX from whatever digits were typed. */
export function formatUsPhone(raw: string): string {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function ageInYears(dob: string, today: Date = new Date()): number | null {
    if (!dob) return null;
    const b = new Date(dob);
    if (Number.isNaN(b.getTime())) return null;
    let y = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) y -= 1;
    return y;
}

export const todayYmd = () => new Date().toISOString().slice(0, 10);

export interface PersonalState {
    prefix: string;
    firstName: string;
    middleName: string;
    lastName: string;
    suffix: string;
    dOB: string;
    sex: string;
    maritalStatus: string;
    email: string;
    workEmail: string;
    pregnant: '' | 'yes' | 'no';
    breastfeeding: '' | 'yes' | 'no';
    address1: string;
    address2: string;
    city: string;
    state: string;
    zipCode: string;
    mailingSameAsHome: boolean;
    mailingAddress1: string;
    mailingAddress2: string;
    mailingCity: string;
    mailingState: string;
    mailingZipCode: string;
    homePhone: string;
    mobilePhone: string;
    workPhone: string;
    otherPhone: string;
    advancedHealthCareDirective: string;
    preferredLanguage: string;
    ethnicity: string;
    race: string;
    noticeOfPrivacyPracticesDate: string;
    countryOfBirth: string;
}

export type InsuranceState = Required<Omit<PatientInsuranceInput, 'coPayAmount' | 'insuranceStatus'>> & {
    coPayAmount: string;
    insuranceStatus: '' | 'Active' | 'Inactive';
};

export type ContactState = Required<PatientEmergencyContactInput>;

export const EMPTY_PERSONAL: PersonalState = {
    prefix: '', firstName: '', middleName: '', lastName: '', suffix: '', dOB: '', sex: '', maritalStatus: '',
    email: '', workEmail: '', pregnant: '', breastfeeding: '',
    address1: '', address2: '', city: '', state: '', zipCode: '',
    mailingSameAsHome: false, mailingAddress1: '', mailingAddress2: '', mailingCity: '', mailingState: '', mailingZipCode: '',
    homePhone: '', mobilePhone: '', workPhone: '', otherPhone: '',
    advancedHealthCareDirective: '', preferredLanguage: '', ethnicity: '', race: '', noticeOfPrivacyPracticesDate: '', countryOfBirth: '',
};

export const EMPTY_INSURANCE: InsuranceState = {
    insuranceType: '', insuranceCompany: '', tradingPartnerServiceId: '', subscriberId: '', insurancePlan: '', groupNumber: '', phoneNumber: '',
    coverageStartDate: '', terminationDate: '', insuranceStatus: 'Active', coPayAmount: '', medicalGroup: '', pcp: '',
    guarantor: 'Self', guarantorName: '', guarantorAddress: '', guarantorDOB: '', guarantorSubscriberId: '',
};

export const EMPTY_CONTACT: ContactState = {
    relationshipToPatient: '', contactName: '', contactPhone: '', street: '', emergencyCity: '', emergencyState: '', emergencyZipCode: '',
};

export type Errors = Record<string, string>;

export function validateInsurance(prefix: string, ins: InsuranceState, isMinor: boolean, errors: Errors, today = todayYmd()): void {
    if (!ins.insuranceCompany.trim()) errors[`${prefix}.insuranceCompany`] = 'Insurance company is required.';
    if (!ins.subscriberId.trim()) errors[`${prefix}.subscriberId`] = 'Member ID is required.';
    if (!ins.insuranceStatus) errors[`${prefix}.insuranceStatus`] = 'Select a status.';
    if (ins.phoneNumber && !PHONE_US.test(ins.phoneNumber)) errors[`${prefix}.phoneNumber`] = 'Enter a 10-digit US phone.';
    if (ins.coPayAmount && !MONEY.test(ins.coPayAmount)) errors[`${prefix}.coPayAmount`] = 'Enter an amount like 25 or 25.50.';
    if (ins.coverageStartDate && ins.terminationDate && ins.terminationDate < ins.coverageStartDate) {
        errors[`${prefix}.terminationDate`] = 'Termination date must be after the effective date.';
    }
    if (isMinor && ins.guarantor === 'Self') errors[`${prefix}.guarantor`] = 'A minor cannot be their own guarantor.';
    if (ins.guarantor && ins.guarantor !== 'Self') {
        if (!ins.guarantorName.trim()) errors[`${prefix}.guarantorName`] = 'Guarantor name is required.';
        else if (!PERSON_NAME.test(ins.guarantorName.trim())) errors[`${prefix}.guarantorName`] = 'Enter a valid name.';
        if (ins.guarantorDOB && ins.guarantorDOB > today) errors[`${prefix}.guarantorDOB`] = 'Cannot be in the future.';
    }
}

export function validateContact(index: number, c: ContactState, errors: Errors): void {
    const prefix = `contact${index}`;
    const any = Object.values(c).some((v) => v.trim());
    if (!any) return;
    if (!c.contactName.trim()) errors[`${prefix}.contactName`] = 'Contact name is required when a contact is entered.';
    else if (!PERSON_NAME.test(c.contactName.trim())) errors[`${prefix}.contactName`] = 'Enter a valid name.';
    if (!c.contactPhone.trim()) errors[`${prefix}.contactPhone`] = 'Contact phone is required when a contact is entered.';
    else if (!PHONE_US.test(c.contactPhone)) errors[`${prefix}.contactPhone`] = 'Enter a 10-digit US phone.';
    if (c.emergencyZipCode && !ZIP_US.test(c.emergencyZipCode)) errors[`${prefix}.emergencyZipCode`] = 'ZIP must be 5 digits.';
}

export interface RegistrationInput {
    form: PersonalState;
    hasInsurance: 'yes' | 'no';
    hasSecondary: 'yes' | 'no';
    insurance: InsuranceState;
    secondary: InsuranceState;
    contacts: readonly [ContactState, ContactState];
}

/** Full-form validation. Returns a map of field-path → message; empty means valid. */
export function validateRegistration(input: RegistrationInput, today = todayYmd()): Errors {
    const { form, hasInsurance, hasSecondary, insurance, secondary, contacts } = input;
    const e: Errors = {};
    const age = ageInYears(form.dOB, new Date(today));
    const isMinor = age !== null && age < 18;

    const name = (k: 'firstName' | 'lastName' | 'middleName', label: string, required: boolean) => {
        const v = form[k].trim();
        if (!v) { if (required) e[k] = `${label} is required.`; return; }
        const min = k === 'middleName' ? 1 : 2;
        if (v.length < min || v.length > 35) e[k] = `${label} must be ${min}–35 characters.`;
        else if (!PERSON_NAME.test(v)) e[k] = `${label} contains invalid characters.`;
    };
    name('firstName', 'First name', true);
    name('middleName', 'Middle name', false);
    name('lastName', 'Last name', true);
    if (!form.dOB) e.dOB = 'Date of birth is required.';
    else if (form.dOB > today) e.dOB = 'Date of birth cannot be in the future.';
    else if ((age ?? 0) > 130) e.dOB = 'Check the date of birth.';
    if (!form.sex) e.sex = 'Sex is required.';
    if (!form.maritalStatus) e.maritalStatus = 'Marital status is required.';
    if (form.email && !EMAIL.test(form.email.trim())) e.email = 'Enter a valid email.';
    if (form.workEmail && !EMAIL.test(form.workEmail.trim())) e.workEmail = 'Enter a valid email.';

    if (!form.address1.trim()) e.address1 = 'Address is required.';
    if (!form.city.trim()) e.city = 'City is required.';
    else if (!CITY_NAME.test(form.city.trim()) || form.city.trim().length < 3) e.city = 'Enter a valid city.';
    if (!form.state) e.state = 'State is required.';
    if (!ZIP_US.test(form.zipCode)) e.zipCode = 'ZIP must be 5 digits.';
    if (!form.mailingSameAsHome) {
        if (form.mailingZipCode && !ZIP_US.test(form.mailingZipCode)) e.mailingZipCode = 'ZIP must be 5 digits.';
        if (form.mailingCity && !CITY_NAME.test(form.mailingCity.trim())) e.mailingCity = 'Enter a valid city.';
    }

    if (!form.homePhone) e.homePhone = 'Home phone is required.';
    else if (!PHONE_US.test(form.homePhone)) e.homePhone = 'Enter a 10-digit US phone.';
    if (!form.mobilePhone) e.mobilePhone = 'Mobile phone is required.';
    else if (!PHONE_US.test(form.mobilePhone)) e.mobilePhone = 'Enter a 10-digit US phone.';
    if (form.workPhone && !PHONE_US.test(form.workPhone)) e.workPhone = 'Enter a 10-digit US phone.';
    if (form.otherPhone && !PHONE_US.test(form.otherPhone)) e.otherPhone = 'Enter a 10-digit US phone.';
    if (form.noticeOfPrivacyPracticesDate && form.noticeOfPrivacyPracticesDate > today) e.noticeOfPrivacyPracticesDate = 'Cannot be in the future.';

    if (hasInsurance === 'yes') {
        validateInsurance('insurance', insurance, isMinor, e, today);
        if (hasSecondary === 'yes') validateInsurance('secondaryInsurance', secondary, isMinor, e, today);
        // Cross-field rule: with insurance declared, at least one block must be Active.
        const anyActive = insurance.insuranceStatus === 'Active' || (hasSecondary === 'yes' && secondary.insuranceStatus === 'Active');
        if (!anyActive) e['insurance.insuranceStatus'] = e['insurance.insuranceStatus'] || 'At least one insurance must be Active when the patient has insurance.';
    }
    validateContact(0, contacts[0], e);
    validateContact(1, contacts[1], e);
    return e;
}

/** A minimal valid form, handy for tests and for seeding fixtures. */
export function validPersonalFixture(overrides: Partial<PersonalState> = {}): PersonalState {
    return {
        ...EMPTY_PERSONAL,
        firstName: 'Jane', lastName: 'Doe', dOB: '1990-01-01', sex: 'F', maritalStatus: 'Single',
        address1: '1 Main St', city: 'Springfield', state: 'IL', zipCode: '62701',
        homePhone: '(217) 555-0100', mobilePhone: '(217) 555-0101',
        ...overrides,
    };
}
