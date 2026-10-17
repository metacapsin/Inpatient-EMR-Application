export type IpdKpis = {
    totalAdmittedPatients: number;
    occupiedBeds: number;
    availableBeds: number;
    dischargedToday: number;
};

export type IpdBedRow = {
    id: string;
    ward: string;
    room: string;
    bed: string;
    patientName: string | null;
    status: string;
    doctor: string;
    admitDate: string | null;
    encounterId: string | null;
    patientId: string | null;
};

export type IpdAlerts = {
    criticalPatients: string[];
    bedsPendingCleaning: string[];
    transferRequests: string[];
};

export type IpdDashboardPayload = {
    kpis: IpdKpis;
    bedBoard: IpdBedRow[];
    alerts: IpdAlerts;
};
