/** Normalized medication row from GET /api/patients/:patientId/medications */
export interface PatientMedicationRow {
    id: string;
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
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
    quantityOrdered: number;
    batchNumber?: string;
    expiryDate?: string;
    unitPrice: number;
}

export interface PrescriptionRow {
    prescriptionId: string;
    patientId: string;
    medicines: PrescriptionMedicineRow[];
    prescriberName?: string;
    orderedAt?: string;
}

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
