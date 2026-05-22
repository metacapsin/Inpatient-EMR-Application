import type { BundleKey } from '../../types/quality';

export interface BundleColumnMeta {
    key: BundleKey;
    header: string;
    shortLabel: string;
}

export const BUNDLE_COLUMNS: BundleColumnMeta[] = [
    { key: 'sep1', header: 'Sepsis Bundle (SEP-1)', shortLabel: 'SEP-1' },
    { key: 'vte', header: 'VTE Prophylaxis', shortLabel: 'VTE' },
    { key: 'glycemic', header: 'Glycemic Control', shortLabel: 'Glycemic' },
    { key: 'cauti', header: 'CAUTI Prevention', shortLabel: 'CAUTI' },
    { key: 'clabsi', header: 'CLABSI Prevention', shortLabel: 'CLABSI' },
    { key: 'fall', header: 'Fall Prevention', shortLabel: 'Fall' },
    { key: 'pressure', header: 'Pressure Injury', shortLabel: 'Pressure' },
];

export const BUNDLE_LABELS: Record<BundleKey, string> = {
    sep1: 'SEP-1 Sepsis Bundle',
    vte: 'VTE Prophylaxis Bundle',
    glycemic: 'Glycemic Control',
    cauti: 'CAUTI Prevention',
    clabsi: 'CLABSI Prevention',
    fall: 'Fall Prevention',
    pressure: 'Pressure Injury Prevention',
};
