/** Unified order-entry (CPOE) — matches backend/src/routes/orders.js. */

export const CPOE_ORDER_TYPES = ['medication', 'prn_stat', 'lab', 'radiology', 'dietary', 'therapy', 'procedure', 'consult', 'nursing'] as const;
export type CpoeOrderType = (typeof CPOE_ORDER_TYPES)[number];

export type CpoeOrderStatus = 'draft' | 'active' | 'held' | 'completed' | 'discontinued' | 'cancelled';

export type CpoeOrderPriority = 'routine' | 'urgent' | 'stat';

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
    acknowledgedBy?: string | null;
    acknowledgedAt?: string | null;
    isVerbal?: boolean;
    readBackConfirmed?: boolean;
    requiresCosign?: boolean;
    cosignedBy?: string | null;
    cosignedAt?: string | null;
    reason?: string | null;
    replacesOrderId?: string | null;
    orderSetId?: string | null;
};

export type CdsOverrideInput = { reason: string };

/** A verbal/telephone order can be any order type — read-back must be confirmed at entry. */
export type VerbalOrderFields = {
    isVerbal?: boolean;
    readBackConfirmed?: boolean;
};

export type MedicationOrderInput = VerbalOrderFields & {
    orderType: 'medication';
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    nextScheduledTime?: string;
    rxnormCode?: string | null;
    priority?: CpoeOrderPriority;
    cdsOverride?: CdsOverrideInput;
};

export type PrnStatOrderInput = VerbalOrderFields & {
    orderType: 'prn_stat';
    medicationName: string;
    type: 'PRN' | 'STAT';
    indication: string;
    orderedTime: string;
    givenBy: string;
    interval?: string;
    maxDose?: string;
    urgencyLevel?: string;
    rxnormCode?: string | null;
    cdsOverride?: CdsOverrideInput;
};

export type LabOrderInput = VerbalOrderFields & {
    orderType: 'lab';
    labTests: Array<{ name: string; code?: string; specimen?: string }>;
    priority: 'Routine' | 'Urgent' | 'STAT';
    orderingProviderName?: string;
    officeNotes?: string;
    /** Reason for order (CPOE gap #1 for labs). */
    clinicalIndication?: string;
};

export type RadiologyOrderInput = VerbalOrderFields & {
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

export type DietaryOrderInput = VerbalOrderFields & {
    orderType: 'dietary';
    dietType: string;
    restrictions?: string;
    notes?: string;
    priority?: CpoeOrderPriority;
};

export type TherapyOrderInput = VerbalOrderFields & {
    orderType: 'therapy';
    therapyType: string;
    frequency?: string;
    notes?: string;
    priority?: CpoeOrderPriority;
};

export type ProcedureOrderInput = VerbalOrderFields & {
    orderType: 'procedure';
    procedureName: string;
    laterality?: string;
    scheduledFor?: string;
    notes?: string;
    priority?: CpoeOrderPriority;
};

export type ConsultOrderInput = VerbalOrderFields & {
    orderType: 'consult';
    consultingService: string;
    reason: string;
    priority?: CpoeOrderPriority;
};

export type NursingOrderInput = VerbalOrderFields & {
    orderType: 'nursing';
    nursingOrderType: string;
    details?: string;
    priority?: CpoeOrderPriority;
};

export type CpoeOrderInput =
    | MedicationOrderInput
    | PrnStatOrderInput
    | LabOrderInput
    | RadiologyOrderInput
    | DietaryOrderInput
    | TherapyOrderInput
    | ProcedureOrderInput
    | ConsultOrderInput
    | NursingOrderInput;

export type PlaceOrderBody = CpoeOrderInput & { patientId: string; encounterId: string };

/** A saved, reusable bundle of orders (`order_sets` + `order_set_items`). */
export type OrderSetItem = { orderType: CpoeOrderType; detail: Record<string, unknown> };
export type OrderSet = {
    id: string;
    name: string;
    description?: string | null;
    isActive?: boolean;
    createdBy?: string | null;
    createdAt?: string;
    items: OrderSetItem[];
};
export type OrderSetInput = { name: string; description?: string | null; items: OrderSetItem[] };
