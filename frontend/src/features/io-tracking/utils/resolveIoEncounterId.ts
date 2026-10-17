import { USE_IO_MOCK } from '../config/ioMock.config';

/**
 * Resolve encounter id for I&O API/mock calls.
 * In offline mock dev, falls back to flowsheet document or a stable dev key so forms stay usable without ADT.
 */
export function resolveIoEncounterId(args: {
    adtEncounterId: string;
    documentEncounterId?: string;
    patientId: string;
}): string {
    const fromAdt = args.adtEncounterId.trim();
    if (fromAdt) return fromAdt;

    const fromDoc = args.documentEncounterId?.trim() ?? '';
    if (fromDoc) return fromDoc;

    if (USE_IO_MOCK && args.patientId.trim()) {
        return `dev-io-${args.patientId.trim()}`;
    }

    return '';
}
