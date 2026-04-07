/**
 * Canonical shape for inpatient placement (ward → room → bed).
 * Used on the facesheet, patient list mapping, and the location assignment service.
 */
export interface PatientLocationSnapshot {
    wardId: string;
    wardName: string;
    roomId: string;
    roomName: string;
    bedId: string;
    bedName: string;
}

export function emptyPatientLocation(): PatientLocationSnapshot {
    return {
        wardId: '',
        wardName: '',
        roomId: '',
        roomName: '',
        bedId: '',
        bedName: '',
    };
}

export function formatLocationLine(loc: PatientLocationSnapshot | null | undefined): string {
    if (!loc) return '';
    const parts = [loc.wardName, loc.roomName, loc.bedName]
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== '—');
    return parts.join(' · ');
}
