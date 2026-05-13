import type { NursingFlowsheetDocument } from '../types/nursingFlowsheet.types';
import { gcsTotal } from '../types/nursingFlowsheet.types';

export function validateFlowsheetForSign(doc: NursingFlowsheetDocument): Record<string, string> {
    const e: Record<string, string> = {};
    if (!doc.shiftDate?.trim()) e['shiftDate'] = 'Shift date required';
    if (!doc.shiftType?.trim()) e['shiftType'] = 'Shift type required';
    if (!doc.shiftInfo.assessedAt) e['shiftInfo.assessedAt'] = 'Assessment date/time required';
    if (!doc.shiftInfo.primaryNurseDisplay?.trim()) e['shiftInfo.primaryNurseDisplay'] = 'Assessed by required';
    if (!doc.attestationAccepted) e['attestationAccepted'] = 'Attestation required to sign';

    const n = doc.neurological;
    const gcs = gcsTotal(n.gcsE, n.gcsV, n.gcsM);
    if (gcs != null && gcs > 0 && gcs < 3) e['neurological.gcs'] = 'GCS components appear incomplete';

    const p = doc.pain;
    if (p.intensity0to10 != null && p.intensity0to10 > 0) {
        if (!p.interventionGiven?.trim()) e['pain.interventionGiven'] = 'Intervention required when pain score documented';
    }

    if (doc.genitourinary.foleyCatheterPresent && !doc.genitourinary.foleyInsertionDate) {
        e['genitourinary.foleyInsertionDate'] = 'Foley insertion date required when catheter present';
    }

    doc.ivAccess.forEach((line, i) => {
        if (!line.siteLocation?.trim()) e[`ivAccess.${i}.siteLocation`] = 'Site location required';
    });

    if (!doc.signerCredentials?.trim()) e['signerCredentials'] = 'Credentials required to sign';

    return e;
}

export function validateAmendmentReason(reason: string): string | null {
    const t = reason.trim();
    if (t.length < 8) return 'Amendment reason must be at least 8 characters (audit policy).';
    return null;
}
