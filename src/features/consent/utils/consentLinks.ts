/** Cross-module navigation helpers for consent management. */

export function facesheetConsentsPath(patientId: string): string {
    return `/app/facesheet/${encodeURIComponent(patientId.trim())}/consents`;
}

export function facesheetDocumentsPath(patientId: string): string {
    return `/app/facesheet/${encodeURIComponent(patientId.trim())}/documents`;
}

export function facesheetNotesPath(patientId: string, procedureNoteId?: string | null): string {
    const base = `/app/facesheet/${encodeURIComponent(patientId.trim())}/notes`;
    if (!procedureNoteId?.trim()) return base;
    return `${base}?noteId=${encodeURIComponent(procedureNoteId.trim())}`;
}

export function dischargeReadinessPath(patientId: string, encounterId?: string): string {
    const qs = new URLSearchParams();
    if (patientId.trim()) qs.set('patientId', patientId.trim());
    if (encounterId?.trim()) qs.set('encounterId', encounterId.trim());
    const q = qs.toString();
    return q ? `/app/inpatient/discharge-readiness?${q}` : '/app/inpatient/discharge-readiness';
}

export function tenantIdFromUser(user: { tenant?: { id?: string } } | null): string {
    const id = user?.tenant?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : 'tenant-default';
}
