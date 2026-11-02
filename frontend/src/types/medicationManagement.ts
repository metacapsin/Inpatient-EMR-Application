/** Normalized medication row from GET /api/patients/:patientId/medications */
export interface PatientMedicationRow {
    id: string;
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    instructions?: string;
    source?: 'home' | 'inpatient';
    nextScheduledTime?: string;
}

/** MAR schedule / administration row from GET /api/mar/:patientId */
export interface MarRow {
    id: string;
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
    givenTime?: string;
    givenBy?: string;
    status: string;
    remarks?: string;
}

export interface PostMarRequest {
    patientId: string;
    medicationId: string;
    scheduledTime: string;
    givenTime: string;
    givenBy: string;
    status: string;
    remarks?: string;
}

export type PrnStatType = 'PRN' | 'STAT';

export interface PostPrnStatRequest {
    patientId: string;
    medicationName: string;
    type: PrnStatType;
    indication: string;
    lastGivenTime?: string;
    interval?: string;
    maxDose?: string;
    orderedTime: string;
    urgencyLevel?: string;
    givenBy: string;
    doctorApproval?: string;
    remarks?: string;
}

export interface PrnStatRecord extends PostPrnStatRequest {
    id: string;
    createdAt: string;
}

export interface PrescriptionMedicineRow {
    medicineId: string;
    name: string;
    strength?: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    quantity?: number | null;
    refills?: number | null;
    rxnormCode?: string;
    controlledSchedule?: 'II' | 'III' | 'IV' | 'V' | null;
    quantityOrdered: number;
    batchNumber?: string;
    expiryDate?: string;
    unitPrice: number;
}

export type PrescriptionStatus = 'draft' | 'signed' | 'transmitted' | 'printed' | 'dispensed' | 'cancelled' | 'error';

export interface PrescriptionStatusEvent {
    status: PrescriptionStatus;
    at: string;
    by?: string;
    byName?: string | null;
    reason?: string | null;
}

export interface PrescriptionRow {
    id?: string;
    prescriptionId: string;
    patientId: string;
    encounterId?: string | null;
    medicines: PrescriptionMedicineRow[];
    prescriberName?: string;
    prescriberId?: string | null;
    prescriberNpi?: string;
    prescriberDea?: string;
    pharmacyId?: string | null;
    pharmacyName?: string;
    status?: PrescriptionStatus;
    controlledSchedule?: 'II' | 'III' | 'IV' | 'V' | null;
    notes?: string;
    orderedAt?: string;
    signedAt?: string | null;
    transmittedAt?: string | null;
    transmissionRef?: string | null;
    dispensedAt?: string | null;
    cancelledAt?: string | null;
    errorMessage?: string | null;
    statusHistory?: PrescriptionStatusEvent[];
}

export interface NewPrescriptionLine {
    name: string;
    strength?: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    quantity: number;
    refills: number;
    unitPrice?: number;
    rxnormCode?: string;
    controlledSchedule?: 'II' | 'III' | 'IV' | 'V' | null;
}

export interface CreatePrescriptionRequest {
    patientId: string;
    encounterId?: string;
    pharmacyId?: string;
    notes?: string;
    medicines: NewPrescriptionLine[];
}

export interface Pharmacy {
    id: string;
    name: string;
    ncpdpId: string;
    npi: string;
    phone: string;
    fax: string;
    address: { line1?: string; line2?: string; city?: string; state?: string; zip?: string };
    isDefault: boolean;
    active: boolean;
    createdAt?: string;
}

export type PharmacyInput = Partial<Omit<Pharmacy, 'id' | 'createdAt'>> & { name: string };

export interface DispenseMedicineLine {
    medicineId: string;
    quantityDispensed: number;
    batchNumber: string;
    expiryDate: string;
    unitPrice: number;
}

export interface PostDispenseRequest {
    prescriptionId: string;
    medicines: DispenseMedicineLine[];
    dispensedBy: string;
    totalCost: number;
}

export interface DischargeMedLine {
    name: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions: string;
}

export interface DischargeMedPayload {
    patientId: string;
    /** Present when loaded from encounter-scoped discharge meds API */
    encounterId?: string;
    medications: DischargeMedLine[];
    preparedBy?: string;
    reviewedBy?: string;
    counsellingDone?: boolean;
}

export interface PostDischargeRequest {
    patientId: string;
    medications: DischargeMedLine[];
    preparedBy: string;
    reviewedBy: string;
    counsellingDone: boolean;
}

/** POST /api/discharges/:encounterId/medications */
export type PostDischargeEncounterMedicationsRequest = {
    patientId?: string;
    medications: DischargeMedLine[];
    preparedBy: string;
    reviewedBy: string;
    counsellingDone: boolean;
};
