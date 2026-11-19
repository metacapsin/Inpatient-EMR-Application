import zlib from 'node:zlib';

/**
 * Minimal pure-JS ZIP reader (SAF-13) — just enough to read a standard PKZIP archive's central
 * directory and extract entries via Node's built-in zlib (raw DEFLATE) or a stored copy. No new
 * dependency, same approach this codebase already takes for TOTP (lib/totp.js) and the HL7 builder
 * (lib/hl7Adt.js): implement the well-documented format directly on Node's built-ins rather than
 * shell out to a platform-specific tool (the previous `powershell.exe` call this replaces).
 *
 * Supports compression method 0 (stored) and 8 (deflate) — the two every common zip tool produces,
 * including the CMS/NCHS ICD-10-CM archive this is built for. Does not support multi-disk archives,
 * ZIP64, or encryption — none of which apply here.
 */
const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

/** @param {Buffer} buf */
function findEocd(buf) {
    // The EOCD's comment field is variable length (up to 65535 bytes), so scan backward for the
    // signature instead of assuming a fixed offset from the end.
    const maxBack = Math.min(buf.length, 65535 + 22);
    for (let i = buf.length - 22; i >= buf.length - maxBack && i >= 0; i--) {
        if (buf.readUInt32LE(i) === EOCD_SIG) return i;
    }
    throw new Error('Not a valid zip file (End Of Central Directory record not found)');
}

/**
 * @param {Buffer} buf
 * @returns {{ name: string, method: number, compressedSize: number, uncompressedSize: number, localHeaderOffset: number }[]}
 */
export function listZipEntries(buf) {
    const eocdOffset = findEocd(buf);
    const totalEntries = buf.readUInt16LE(eocdOffset + 10);
    let cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const entries = [];
    for (let i = 0; i < totalEntries; i++) {
        if (buf.readUInt32LE(cdOffset) !== CDFH_SIG) {
            throw new Error(`Malformed central directory entry at offset ${cdOffset}`);
        }
        const method = buf.readUInt16LE(cdOffset + 10);
        const compressedSize = buf.readUInt32LE(cdOffset + 20);
        const uncompressedSize = buf.readUInt32LE(cdOffset + 24);
        const nameLen = buf.readUInt16LE(cdOffset + 28);
        const extraLen = buf.readUInt16LE(cdOffset + 30);
        const commentLen = buf.readUInt16LE(cdOffset + 32);
        const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);
        const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
        entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
        cdOffset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

/**
 * @param {Buffer} buf
 * @param {{ method: number, compressedSize: number, localHeaderOffset: number }} entry
 * @returns {Buffer}
 */
export function extractZipEntry(buf, entry) {
    const off = entry.localHeaderOffset;
    if (buf.readUInt32LE(off) !== LFH_SIG) throw new Error(`Malformed local file header at offset ${off}`);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const dataStart = off + 30 + nameLen + extraLen;
    const compressed = buf.subarray(dataStart, dataStart + entry.compressedSize);
    if (entry.method === 0) return Buffer.from(compressed);
    if (entry.method === 8) return zlib.inflateRawSync(compressed);
    throw new Error(`Unsupported zip compression method ${entry.method} for ${entry.localHeaderOffset}`);
}

/** Finds the first entry whose name matches `pattern` (RegExp or exact string) and returns its decompressed bytes, or null. */
export function extractZipEntryByName(buf, pattern) {
    const entries = listZipEntries(buf);
    const match = entries.find((e) => (pattern instanceof RegExp ? pattern.test(e.name) : e.name === pattern));
    return match ? extractZipEntry(buf, match) : null;
}
