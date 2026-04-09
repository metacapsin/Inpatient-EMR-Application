import api from '../../../services/api';
import type {
    ClinicalAlertRow,
    ClinicalApiResponse,
    CpoeOrderRow,
    InpatientVitalRow,
    NursingNoteRow,
    PhysicianNote,
} from '../types';

const BASE = '/api/inpatient/clinical';

export async function fetchPhysicianNotes(patientId: string, encounterId?: string) {
    const params: Record<string, string> = {};
    if (encounterId) params.encounterId = encounterId;
    const { data } = await api.get<ClinicalApiResponse<PhysicianNote[]>>(`${BASE}/notes/patient/${patientId}`, { params });
    return data;
}

export async function createPhysicianNote(body: Record<string, unknown>) {
    const { data } = await api.post<ClinicalApiResponse<PhysicianNote>>(`${BASE}/notes/create`, body);
    return data;
}

export async function updatePhysicianNote(id: string, body: Record<string, unknown>) {
    const { data } = await api.put<ClinicalApiResponse<PhysicianNote>>(`${BASE}/notes/update/${id}`, body);
    return data;
}

export async function signPhysicianNote(id: string) {
    const { data } = await api.post<ClinicalApiResponse<PhysicianNote>>(`${BASE}/notes/sign/${id}`, {});
    return data;
}

export async function addPhysicianNoteAddendum(id: string, text: string) {
    const { data } = await api.post<ClinicalApiResponse<PhysicianNote>>(`${BASE}/notes/addendum/${id}`, { text });
    return data;
}

export async function createNursingNote(body: Record<string, unknown>) {
    const { data } = await api.post<ClinicalApiResponse<NursingNoteRow>>(`${BASE}/nursing-notes`, body);
    return data;
}

export async function fetchNursingNotes(patientId: string, encounterId?: string) {
    const params: Record<string, string> = {};
    if (encounterId) params.encounterId = encounterId;
    const { data } = await api.get<ClinicalApiResponse<NursingNoteRow[]>>(`${BASE}/nursing-notes/patient/${patientId}`, { params });
    return data;
}

export async function createHandover(body: Record<string, unknown>) {
    const { data } = await api.post(`${BASE}/handover`, body);
    return data;
}

export async function fetchHandovers(patientId: string, encounterId?: string) {
    const params: Record<string, string> = {};
    if (encounterId) params.encounterId = encounterId;
    const { data } = await api.get(`${BASE}/handover/patient/${patientId}`, { params });
    return data;
}

export async function createVital(body: Record<string, unknown>) {
    const { data } = await api.post<ClinicalApiResponse<InpatientVitalRow & { fhirObservationStub?: unknown }>>(`${BASE}/vitals`, body);
    return data;
}

export async function fetchVitals(patientId: string, encounterId?: string) {
    const params: Record<string, string> = {};
    if (encounterId) params.encounterId = encounterId;
    const { data } = await api.get<ClinicalApiResponse<InpatientVitalRow[]>>(`${BASE}/vitals/patient/${patientId}`, { params });
    return data;
}

export async function createOrder(body: Record<string, unknown>) {
    const { data } = await api.post<ClinicalApiResponse<CpoeOrderRow>>(`${BASE}/orders`, body);
    return data;
}

export async function fetchOrders(patientId: string, encounterId?: string) {
    const params: Record<string, string> = {};
    if (encounterId) params.encounterId = encounterId;
    const { data } = await api.get<ClinicalApiResponse<CpoeOrderRow[]>>(`${BASE}/orders/patient/${patientId}`, { params });
    return data;
}

export async function updateOrderStatus(id: string, status: string, cancelReason?: string) {
    const { data } = await api.put<ClinicalApiResponse<CpoeOrderRow>>(`${BASE}/orders/status/${id}`, { status, cancelReason });
    return data;
}

export async function fetchClinicalAlerts(patientId: string, status?: string) {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const { data } = await api.get<ClinicalApiResponse<ClinicalAlertRow[]>>(`${BASE}/alerts/patient/${patientId}`, { params });
    return data;
}

export async function acknowledgeAlert(id: string) {
    const { data } = await api.post<ClinicalApiResponse<ClinicalAlertRow>>(`${BASE}/alerts/acknowledge/${id}`, {});
    return data;
}
