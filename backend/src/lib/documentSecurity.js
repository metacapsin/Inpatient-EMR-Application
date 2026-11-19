// SEC-18: an allowlist of real clinical document types plus a check that the actual file bytes match
// the claimed type — stops, for example, an executable renamed to "result.pdf" from being accepted on
// the strength of its mime label alone (which the uploader fully controls and which can also be
// overridden by whatever's embedded in a data: URL prefix — see records.js for where that's resolved
// before this is called).

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'text/plain',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/dicom',
]);

function startsWith(buf, bytes) {
    return buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
}

/**
 * @param {string} mime
 * @param {Buffer} buf
 * @returns {boolean}
 */
export function matchesMagicBytes(mime, buf) {
    switch (mime) {
        case 'application/pdf':
            return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
        case 'image/jpeg':
            return startsWith(buf, [0xff, 0xd8, 0xff]);
        case 'image/png':
            return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/tiff':
            return startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a]);
        case 'application/msword':
        case 'application/vnd.ms-excel':
            return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE compound file
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            // OOXML is a zip archive — 'PK\x03\x04' (or the rare empty-archive 'PK\x05\x06').
            return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]);
        case 'application/dicom':
            // 128-byte preamble, then the literal 'DICM'. No reasonable magic check for text/plain.
            return buf.length >= 132 && buf.subarray(128, 132).toString('ascii') === 'DICM';
        case 'text/plain':
            return true;
        default:
            return false;
    }
}
