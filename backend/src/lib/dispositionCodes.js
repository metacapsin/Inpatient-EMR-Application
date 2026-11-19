// UB-04 patient discharge status codes (CMS, public domain — no licensing concern, unlike CPT).
// A practical subset covering this app's actual discharge options, not the full ~70-code set.
export const DISPOSITION_CODES = {
    '01': 'Discharged to home or self care',
    '02': 'Discharged/transferred to another short-term general hospital',
    '03': 'Discharged/transferred to skilled nursing facility (SNF)',
    '05': 'Discharged/transferred to another type of institution',
    '06': 'Discharged/transferred to home under organized home health service',
    '07': 'Left against medical advice (AMA)',
    '20': 'Expired',
    '50': 'Hospice — home',
    '51': 'Hospice — medical facility',
    '62': 'Discharged/transferred to inpatient rehabilitation facility',
    '63': 'Discharged/transferred to long term care hospital',
    '65': 'Discharged/transferred to psychiatric hospital',
    '66': 'Discharged/transferred to critical access hospital',
};

export const AMA_CODE = '07';
export const EXPIRED_CODE = '20';

export function isValidDispositionCode(code) {
    return Object.prototype.hasOwnProperty.call(DISPOSITION_CODES, code);
}
