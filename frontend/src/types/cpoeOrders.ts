/** Unified order-entry (CPOE) — matches backend/src/routes/orders.js. */

export const CPOE_ORDER_TYPES = ['medication', 'prn_stat', 'lab', 'radiology'] as const;
export type CpoeOrderType = (typeof CPOE_ORDER_TYPES)[number];

export type CpoeOrderStatus = 'draft' | 'active' | 'completed' | 'discontinued' | 'cancelled';

/** Ledger row (`orders` table) merged with its type-specific detail row. */
export type CpoeOrderRow = {
    id: string;
    patientId: string;
    encounterId: string;
    orderType: CpoeOrderType;
    status: CpoeOrderStatus;
    refTable: string;
    refId: string;
    orderedBy: string | null;
    orderedAt: string;
    createdAt: string;
    detail: Record<string, unknown> | null;
};

export type MedicationOrderInput = {
    orderType: 'medication';
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    nextScheduledTime?: string;
};

export type PrnStatOrderInput = {
    orderType: 'prn_stat';
    medicationName: string;
    type: 'PRN' | 'STAT';
    indication: string;
    orderedTime: string;
    givenBy: string;
    interval?: string;
    maxDose?: string;
    urgencyLevel?: string;
};

export type LabOrderInput = {
    orderType: 'lab';
    labTests: Array<{ name: string; code?: string; specimen?: string }>;
    priority: 'Routine' | 'Urgent' | 'STAT';
    orderingProviderName?: string;
    officeNotes?: string;
};

export type RadiologyOrderInput = {
    orderType: 'radiology';
    modality: string;
    bodyRegion: string;
    clinicalIndication: string;
    priority: 'Routine' | 'Urgent' | 'STAT';
    laterality?: string;
    contrast?: string;
    specialInstructions?: string;
    transportRequired?: boolean;
};

export type CpoeOrderInput = MedicationOrderInput | PrnStatOrderInput | LabOrderInput | RadiologyOrderInput;

export type PlaceOrderBody = CpoeOrderInput & { patientId: string; encounterId: string };
