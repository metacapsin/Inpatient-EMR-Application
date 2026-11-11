// @ts-check
import { codeable, instant, patientRef, SYSTEMS } from './terminology.js';

/** @type {Record<string, { code: string, display: string }>} */
const NOTE_TYPE_LOINC = {
    hp: { code: '34117-2', display: 'History and physical note' },
    progress: { code: '11506-3', display: 'Progress note' },
    discharge_summary: { code: '18842-5', display: 'Discharge summary' },
    consult: { code: '11488-4', display: 'Consultation note' },
};

/**
 * Map a signed EMR clinical_notes row to FHIR R4 DocumentReference.
 * Draft notes must not be passed in.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.DocumentReference}
 */
export function toFhirDocumentReference(row) {
    const id = String(row.id);
    const noteType = String(row.note_type || 'progress');
    const loinc = NOTE_TYPE_LOINC[noteType] ?? NOTE_TYPE_LOINC.progress ?? {
        code: '11506-3',
        display: 'Progress note',
    };
    const title = row.title ? String(row.title) : loinc.display;
    const contentText =
        typeof row.rich_text === 'string' && row.rich_text
            ? row.rich_text
            : JSON.stringify(row.content || {});
    const b64 = Buffer.from(contentText, 'utf8').toString('base64');
    const dated = instant(/** @type {string|Date|undefined} */ (row.signed_at || row.updated_at || row.created_at));

    /** @type {fhir4.DocumentReference} */
    return {
        resourceType: 'DocumentReference',
        id,
        meta: { lastUpdated: dated },
        status: 'current',
        type: codeable(SYSTEMS.loinc, loinc.code, loinc.display, title),
        category: [codeable(SYSTEMS.docClass, 'clinical-note', 'Clinical Note')],
        subject: patientRef('Patient', String(row.patient_id)),
        date: dated,
        author: row.signed_by ? [{ reference: `Practitioner/${row.signed_by}` }] : undefined,
        content: [
            {
                attachment: {
                    contentType: 'text/plain; charset=utf-8',
                    data: b64,
                    title,
                    creation: dated,
                },
            },
        ],
        context: row.encounter_id
            ? { encounter: [{ reference: `Encounter/${row.encounter_id}` }] }
            : undefined,
    };
}
