import {
    toNursingFlowsheetApiPayload,
    type NursingFlowsheetApiPayload,
    type NursingFlowsheetDocument,
} from '../types/nursingFlowsheet.types';

const now = new Date();

export function buildMockNursingFlowsheetDocument(args: {
    patientId: string;
    encounterId: string;
    tenantId?: string;
}): NursingFlowsheetDocument {
    const tenantId = args.tenantId ?? 'tenant-demo-01';
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return {
        id: `nfs-${args.encounterId}-v3`,
        patientId: args.patientId,
        encounterId: args.encounterId,
        tenantId,
        shiftDate: `${y}-${m}-${day}`,
        shiftType: 'Day (7a–7p)',
        chartStatus: 'draft',
        version: 3,
        updatedAtIso: now.toISOString(),
        createdAtIso: '2026-05-12T22:40:00.000Z',
        signedBy: null,
        signedByName: null,
        signerCredentials: 'RN',
        signedAt: null,
        isAmended: false,
        amendedBy: null,
        amendedAt: null,
        amendmentReason: null,
        attestationAccepted: false,
        shiftInfo: {
            assessedAt: now,
            primaryNurseId: 'rn-4421',
            primaryNurseDisplay: 'Jordan Lee, RN',
        },
        neurological: {
            levelOfConsciousness: 'Alert',
            orientation: ['Person', 'Place', 'Time'],
            leftPupil: 'PERRL',
            rightPupil: 'PERRL',
            gcsE: 4,
            gcsV: 5,
            gcsM: 6,
            extremityMovement: 'Equal & Strong',
        },
        cardiovascular: {
            heartRate: 78,
            heartRhythm: 'Regular',
            peripheralPulseRA: '2+ = Normal',
            peripheralPulseLA: '2+ = Normal',
            peripheralPulseRL: '2+ = Normal',
            capillaryRefill: '<2 sec',
            edemaDistribution: 'None',
            edemaGrade: '',
        },
        respiratory: {
            respiratoryRate: 18,
            spo2Percent: 94,
            oxygenDeliveryDevice: 'Nasal Cannula',
            o2FlowLpm: 2,
            lungSoundsRight: ['Clear'],
            lungSoundsLeft: ['Clear'],
            cough: 'None',
            productiveSputumColor: '',
        },
        gastrointestinal: {
            bowelSoundsRuq: 'Active',
            bowelSoundsLuq: 'Active',
            bowelSoundsRlq: 'Hypoactive',
            bowelSoundsLlq: 'Active',
            abdomenAppearance: 'Soft',
            nauseaOrVomiting: false,
            nauseaVomitingDetail: '',
            lastBm: new Date('2026-05-12T18:00:00.000Z'),
            dietTolerance: 'NPO',
        },
        genitourinary: {
            urineOutputLast4hMl: 120,
            urineColor: 'Yellow',
            foleyCatheterPresent: true,
            foleyInsertionDate: new Date('2026-05-10T08:00:00.000Z'),
            foleyIndication: 'Strict I/O',
            bladderDistension: false,
        },
        integumentary: {
            skinColor: 'Normal',
            skinTemperature: 'Warm',
            skinTurgor: 'Normal',
            woundOrIncisionPresent: true,
            woundOrIncisionDetail: 'Midline — dry dressing',
            pressureInjuryPresent: false,
            pressureInjuryDetail: '',
            rashPresent: false,
            rashDetail: '',
            surgicalDrainPresent: false,
            surgicalDrainDetail: '',
            bradenScore: 16,
        },
        ivAccess: [
            {
                id: 'iv-1',
                accessType: 'Peripheral IV',
                siteLocation: 'L antecubital',
                gaugeFrench: '20G',
                insertionDate: new Date('2026-05-11T14:00:00.000Z'),
                siteCondition: 'Intact',
                dressingIntact: true,
            },
        ],
        pain: {
            intensity0to10: 4,
            location: 'Lower abdomen incisional',
            quality: ['Aching'],
            radiation: false,
            radiationWhere: '',
            aggravatingFactors: 'Movement',
            interventionGiven: 'PRN analgesic per protocol',
        },
        musculoskeletal: {
            mobilityStatus: 'Bed Rest',
            gait: 'N/A',
            fallPrecautionsActive: true,
            morseFallScore: 55,
        },
        psychosocial: {
            moodAffect: 'Anxious',
            behavior: 'Cooperative',
            safetyRisk: [],
            patientEducationProvided: ['Medications'],
        },
    };
}

export const MOCK_VERSIONS = [
    {
        id: 'v-3',
        version: 3,
        status: 'draft' as const,
        savedAtIso: now.toISOString(),
        savedByDisplay: 'Jordan Lee, RN',
        summary: 'Autosave — draft in progress',
    },
    {
        id: 'v-2',
        version: 2,
        status: 'signed' as const,
        savedAtIso: '2026-05-12T19:12:00.000Z',
        savedByDisplay: 'A. Patel, RN',
        summary: 'Signed head-to-toe — night shift',
    },
];

export const MOCK_AUDIT = [
    {
        id: 'a1',
        atIso: now.toISOString(),
        actorDisplay: 'Jordan Lee, RN',
        action: 'FIELD_EDIT',
        detail: 'respiratory.spo2Percent → 94',
    },
    {
        id: 'a2',
        atIso: '2026-05-12T19:12:00.000Z',
        actorDisplay: 'A. Patel, RN',
        action: 'SIGN',
        detail: 'Document version 2 locked',
    },
];

/** Example body shape for POST / PUT (no client-only fields). */
export const MOCK_NURSING_FLOWSHEET_API_PAYLOAD_SAMPLE: NursingFlowsheetApiPayload = toNursingFlowsheetApiPayload(
    buildMockNursingFlowsheetDocument({ patientId: 'demo-patient', encounterId: 'demo-encounter' })
);
