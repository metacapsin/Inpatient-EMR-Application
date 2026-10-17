import { create } from 'zustand';
import type { BundleKey, SelectedBundleContext } from '../../types/quality';

export type DateRangeFilter = { from: string; to: string } | null;

type QualityMeasuresState = {
    unitId: string;
    searchQuery: string;
    dateRange: DateRangeFilter;
    selectedBundle: SelectedBundleContext | null;
    panelOpen: boolean;
    mobileFiltersOpen: boolean;
    setUnitId: (id: string) => void;
    setSearchQuery: (q: string) => void;
    setDateRange: (range: DateRangeFilter) => void;
    openBundlePanel: (ctx: SelectedBundleContext) => void;
    closeBundlePanel: () => void;
    setMobileFiltersOpen: (open: boolean) => void;
};

export const useQualityMeasuresStore = create<QualityMeasuresState>((set) => ({
    unitId: 'unit-ms-6e',
    searchQuery: '',
    dateRange: null,
    selectedBundle: null,
    panelOpen: false,
    mobileFiltersOpen: false,
    setUnitId: (unitId) => set({ unitId }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setDateRange: (dateRange) => set({ dateRange }),
    openBundlePanel: (selectedBundle) => set({ selectedBundle, panelOpen: true }),
    closeBundlePanel: () => set({ panelOpen: false, selectedBundle: null }),
    setMobileFiltersOpen: (mobileFiltersOpen) => set({ mobileFiltersOpen }),
}));

export function bundleKeyFromColumn(columnId: string): BundleKey | null {
    const keys: BundleKey[] = ['sep1', 'vte', 'glycemic', 'cauti', 'clabsi', 'fall', 'pressure'];
    return keys.includes(columnId as BundleKey) ? (columnId as BundleKey) : null;
}
