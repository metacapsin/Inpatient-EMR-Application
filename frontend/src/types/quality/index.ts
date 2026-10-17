/** Compliance status for bundle elements and column cells */
export type ComplianceStatus = 'compliant' | 'pending' | 'deficient' | 'na';

export type BundleKey =
    | 'sep1'
    | 'vte'
    | 'glycemic'
    | 'cauti'
    | 'clabsi'
    | 'fall'
    | 'pressure';

export type UnitType = 'icu' | 'med-surg' | 'step-down' | 'telemetry';

export interface BundleComplianceCell {
    status: ComplianceStatus;
    /** 0–100 for progress visualization */
    score: number;
    overdueCount: number;
}

export interface PatientComplianceRow {
    encounterId: string;
    measureId: string;
    patientName: string;
    mrn: string;
    roomNumber: string;
    losDays: number;
    highRisk: boolean;
    bundles: Record<BundleKey, BundleComplianceCell>;
    overall: {
        score: number;
        status: ComplianceStatus;
    };
}

export interface QualityDashboardKpis {
    totalPatients: number;
    overallCompliancePct: number;
    activeDeficiencies: number;
    overdueBundleElements: number;
    highRiskPatients: number;
    bundleCompletionRate: number;
    sparklines: {
        totalPatients: number[];
        overallCompliance: number[];
        activeDeficiencies: number[];
        overdueElements: number[];
        highRisk: number[];
        completionRate: number[];
    };
}

export interface ComplianceSummaryChips {
    compliant: number;
    pending: number;
    deficient: number;
    na: number;
}

export interface QualityDashboardResponse {
    unitId: string;
    unitName: string;
    unitType: UnitType;
    lastEvaluatedAt: string;
    kpis: QualityDashboardKpis;
    complianceSummary: ComplianceSummaryChips;
    patients: PatientComplianceRow[];
}

export interface MeasureElement {
    id: string;
    elementName: string;
    status: ComplianceStatus;
    dueBy: string | null;
    completedAt: string | null;
    completedBy: string | null;
    overdueBy: string | null;
    notes: string | null;
    assignTo: string | null;
}

export interface QualityMeasureEncounterResponse {
    encounterId: string;
    measureId: string;
    patientName: string;
    mrn: string;
    roomNumber: string;
    unitId: string;
    bundleKey: BundleKey;
    bundleLabel: string;
    elements: MeasureElement[];
}

export interface UpdateMeasureElementPayload {
    elementId: string;
    notes?: string | null;
    assignTo?: string | null;
}

export interface UpdateMeasureElementResponse {
    measureId: string;
    element: MeasureElement;
}

export interface EvaluateEncounterResponse {
    encounterId: string;
    evaluatedAt: string;
    success: boolean;
}

export type SelectedBundleContext = {
    encounterId: string;
    measureId: string;
    bundleKey: BundleKey;
    bundleLabel: string;
    patientName: string;
    mrn: string;
    roomNumber: string;
};
