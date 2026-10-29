/**
 * Pure mapping (ported from EMR-Backend/api/services/eligibilityMapper.js + stediPayers.js):
 *   - patient + insurance + practice → Stedi 270 JSON request
 *   - Stedi 271 response              → compact summary the UI renders and auto-fills from
 * No I/O, so it is unit-testable.
 */

/**
 * Name → trading-partner id fallback for the handful of common payers, used only when the
 * insurance row carries no tradingPartnerServiceId picked from the live /Payers/search directory.
 * Traditional Medicare Part A/B must route to CMS (HETS) regardless of any stored id.
 */
const PAYER_MAP = {
    'aetna': 'AETNA',
    'blue cross blue shield': 'BCBSTX',
    'bcbs': 'BCBSTX',
    'cigna': 'CIGNA',
    'united healthcare': 'UHC',
    'unitedhealthcare': 'UHC',
    'uhc': 'UHC',
    'humana': 'HUMANA',
    'medicare': 'CMS',
    'medicare part a': 'CMS',
    'medicare part b': 'CMS',
    'medicare part a & b': 'CMS',
    'medicare part a and b': 'CMS',
    'medicare a & b': 'CMS',
    'medicare a/b': 'CMS',
    'medicare a and b': 'CMS',
    'traditional medicare': 'CMS',
    'cms': 'CMS',
    'medicaid': 'SKMD0',
};

export function resolvePayerId(insuranceCompanyName) {
    if (!insuranceCompanyName || typeof insuranceCompanyName !== 'string') return null;
    return PAYER_MAP[insuranceCompanyName.trim().toLowerCase()] ?? null;
}

/** Accepts YYYY-MM-DD (our storage), MM/DD/YYYY or ISO; returns YYYYMMDD or null. */
export function formatDob(dob) {
    if (!dob) return null;
    const s = String(dob).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}${m[2]}${m[3]}`;
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (m) return `${m[3]}${m[1]}${m[2]}`;
    return null;
}

function normalizeGender(value) {
    if (!value) return undefined;
    const v = String(value).trim().toUpperCase();
    if (v === 'M' || v === 'MALE') return 'M';
    if (v === 'F' || v === 'FEMALE') return 'F';
    return undefined;
}

function normalizeNpi(value) {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    return digits.length === 10 ? digits : null;
}

const fail = (message, code) => Object.assign(new Error(message), { code });

export function buildEligibilityRequest({ patient, insurance, practice, serviceTypeCodes }) {
    if (!patient) throw fail('patient is required', 'INVALID_INPUT');
    if (!insurance) throw fail('insurance is required', 'INVALID_INPUT');
    if (!practice) throw fail('practice is required', 'INVALID_INPUT');

    const mapped = resolvePayerId(insurance.insuranceCompany);
    const rawPayerId = mapped === 'CMS' ? 'CMS' : (insurance.tradingPartnerServiceId || insurance.primaryPayerId || insurance.stediId || mapped);
    const tradingPartnerServiceId = rawPayerId ? String(rawPayerId).trim() : '';
    if (!tradingPartnerServiceId) throw fail(`Unsupported payer: ${insurance.insuranceCompany || '(unknown)'}`, 'UNSUPPORTED_PAYER');

    const dateOfBirth = formatDob(patient.dOB || patient.dob);
    if (!dateOfBirth) throw fail('Invalid or missing date of birth', 'INVALID_DOB');

    const subscriberId = insurance.subscriberId || insurance.policyNumber;
    if (!subscriberId) throw fail('Missing subscriber / member ID on insurance', 'MISSING_SUBSCRIBER_ID');

    const npi = normalizeNpi(practice.npi);
    if (!npi) throw fail('Practice NPI is missing or not 10 digits — set it under Settings → Practice Information', 'INVALID_NPI');

    const subscriber = { memberId: String(subscriberId), firstName: patient.firstName, lastName: patient.lastName, dateOfBirth };
    const gender = normalizeGender(patient.sex || patient.gender);
    if (gender) subscriber.gender = gender;
    if (insurance.groupNumber) subscriber.groupNumber = String(insurance.groupNumber);

    const codes = Array.isArray(serviceTypeCodes) && serviceTypeCodes.length ? serviceTypeCodes : ['30'];
    const request = {
        tradingPartnerServiceId,
        provider: { organizationName: practice.organizationName || 'EMR Practice', npi },
        subscriber,
        encounter: { serviceTypeCodes: codes },
    };
    if (patient.externalPatientId) request.externalPatientId = String(patient.externalPatientId);
    return request;
}

// X12 EB01: C = deductible, G = OOP max, B = copay, A = coinsurance, F = limitation.
function groupBenefits(benefits) {
    const empty = () => ({ deductible: [], outOfPocketMax: [], copay: [], coinsurance: [], limitations: [], other: [] });
    const result = { inNetwork: empty(), outOfNetwork: empty(), notApplicable: empty() };
    for (const b of benefits ?? []) {
        const bucket = result[b.inPlanNetworkIndicatorCode === 'Y' ? 'inNetwork' : b.inPlanNetworkIndicatorCode === 'N' ? 'outOfNetwork' : 'notApplicable'];
        if (b.code === 'C') bucket.deductible.push(b);
        else if (b.code === 'G') bucket.outOfPocketMax.push(b);
        else if (b.code === 'B') bucket.copay.push(b);
        else if (b.code === 'A') bucket.coinsurance.push(b);
        else if (b.code === 'F') bucket.limitations.push(b);
        else bucket.other.push(b);
    }
    return result;
}

const findActiveCoverageRow = (benefits) =>
    (benefits ?? []).find((b) => b.code === '1' && (b.serviceTypeCodes ?? []).includes('30')) || (benefits ?? []).find((b) => b.code === '1');

const pickFirstAmount = (rows, predicate) => {
    const m = (rows ?? []).find(predicate);
    return m && (m.benefitAmount ?? m.benefitPercent);
};

export function summarizeEligibilityResponse(r) {
    if (!r || typeof r !== 'object') return { status: 'unknown', errors: ['Empty response'], warnings: [] };
    const errors = Array.isArray(r.errors) ? r.errors.map((e) => e.description || e.code || e.message || JSON.stringify(e)) : [];
    const warnings = Array.isArray(r.warnings) ? r.warnings.map((w) => w.description || w.code || w.message || JSON.stringify(w)) : [];
    if (errors.length && !r.benefitsInformation) return { status: 'error', errors, warnings };

    const benefits = Array.isArray(r.benefitsInformation) ? r.benefitsInformation : [];
    const planStatusObj = benefits.find((b) => b.code === '1' || b.name === 'Active Coverage' || b.code === '6');
    let status = 'unknown';
    if (planStatusObj) {
        if (planStatusObj.code === '1' || planStatusObj.name === 'Active Coverage') status = 'active';
        else if (planStatusObj.code === '6' || planStatusObj.name === 'Inactive') status = 'inactive';
    }
    const activeRow = findActiveCoverageRow(benefits);
    const planInfo = r.planInformation ?? {};
    const planDates = r.planDateInformation ?? {};
    const subscriber = r.subscriber ?? {};
    const payer = r.payer ?? {};
    const provider = r.provider ?? {};
    const grouped = groupBenefits(benefits);
    const byPlanYear = (b) => b.timeQualifierCode === '25' || !b.timeQualifierCode;

    return {
        status,
        planName: activeRow?.planCoverage || planInfo.planName,
        coverageStartDate: planDates.planBegin,
        coverageEndDate: planDates.planEnd,
        copay: pickFirstAmount(grouped.inNetwork.copay, () => true),
        deductible: pickFirstAmount(grouped.inNetwork.deductible, byPlanYear),
        outOfPocketMax: pickFirstAmount(grouped.inNetwork.outOfPocketMax, byPlanYear),
        inNetwork: Boolean(activeRow && activeRow.inPlanNetworkIndicatorCode === 'Y'),
        eligibilityCheckId: r.id,
        tradingPartnerServiceId: r.tradingPartnerServiceId,
        payerName: payer.name,
        errors,
        warnings,
        details: {
            planNumber: planInfo.planNumber,
            groupNumber: planInfo.groupNumber || subscriber.groupNumber,
            groupDescription: planInfo.groupDescription,
            insuranceType: activeRow?.insuranceType,
            insuranceTypeCode: activeRow?.insuranceTypeCode,
            coverageLevel: activeRow?.coverageLevel,
            dateOfService: planDates.service,
            planStatus: Array.isArray(r.planStatus) ? r.planStatus : [],
            subscriber: {
                memberId: subscriber.memberId, firstName: subscriber.firstName, middleName: subscriber.middleName, lastName: subscriber.lastName,
                dateOfBirth: subscriber.dateOfBirth, gender: subscriber.gender, groupNumber: subscriber.groupNumber, address: subscriber.address ?? null,
            },
            payer: { name: payer.name, payorIdentification: payer.payorIdentification },
            provider: { name: provider.providerName || provider.organizationName, npi: provider.npi },
            benefits: grouped,
        },
    };
}

/** Flatten Stedi's `{ payer: {...}, score, matches }` search hits to the row shape the UI binds. */
export function flattenPayerHit(entry) {
    if (entry && (entry.stediId || entry.displayName) && !entry.payer) return entry;
    const p = entry?.payer ?? {};
    return {
        stediId: p.stediId,
        displayName: p.displayName || p.names?.[0] || '',
        primaryPayerId: p.primaryPayerId,
        aliases: p.aliases ?? [],
        transactions: p.transactionSupport ?? {},
    };
}
