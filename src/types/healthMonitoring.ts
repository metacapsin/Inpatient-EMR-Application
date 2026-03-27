/**
 * Types for Health Monitoring API (align with backend).
 * Base path: /api/health-monitoring/patients/{patientId}/...
 */

// --- Vitals ---
export interface VitalsRecord {
  id?: string;
  patientId?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRateBpm?: number;
  temperatureFahrenheit?: number;
  weightLbs?: number;
  heightInches?: number;
  spo2Percent?: number;
  respiratoryRatePerMin?: number;
  recordedAt?: string;
  [key: string]: unknown;
}

export interface VitalsListParams {
  from?: string; // ISO date
  to?: string;
  limit?: number;
}

export interface VitalsHistoryParams {
  page?: number;
  limit?: number;
}

export interface VitalsHistoryResponse {
  items: VitalsRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

// --- Medications ---
export interface MedicationRecord {
  id?: string;
  patientId?: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MedicationCreateUpdate {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

// --- Conditions ---
export interface ConditionRecord {
  id?: string;
  patientId?: string;
  name?: string;
  code?: string;
  status?: string;
  onsetDate?: string;
  [key: string]: unknown;
}

export interface ConditionCreateUpdate {
  name: string;
  code?: string;
  status?: string;
  onsetDate?: string;
}

// --- Allergies ---
export interface AllergyRecord {
  id?: string;
  patientId?: string;
  allergen?: string;
  type?: string;
  severity?: string;
  reaction?: string;
  status?: string;
  onsetDate?: string;
  [key: string]: unknown;
}

export interface AllergyCreateUpdate {
  allergen: string;
  type?: string;
  severity?: string;
  reaction?: string;
  status?: string;
  onsetDate?: string;
}

// --- Immunizations ---
export interface ImmunizationRecord {
  id?: string;
  patientId?: string;
  vaccineName?: string;
  date?: string;
  dose?: string;
  manufacturer?: string;
  lotNumber?: string;
  [key: string]: unknown;
}

export interface ImmunizationCreateUpdate {
  vaccineName: string;
  date?: string;
  dose?: string;
  manufacturer?: string;
  lotNumber?: string;
}

// --- Lab results ---
export interface LabResultRecord {
  id?: string;
  patientId?: string;
  name?: string;
  code?: string;
  value?: string | number;
  unit?: string;
  category?: string;
  date?: string;
  referenceRange?: string;
  status?: string;
  [key: string]: unknown;
}

export interface LabResultsListParams {
  from?: string;
  to?: string;
  category?: string;
}

// --- Health summary ---
export interface HealthSummary {
  patientId?: string;
  latestVitals?: VitalsRecord;
  recentMedications?: MedicationRecord[];
  conditions?: ConditionRecord[];
  allergies?: AllergyRecord[];
  immunizations?: ImmunizationRecord[];
  labHighlights?: LabResultRecord[];
  [key: string]: unknown;
}
