import api from './api';

/** Raw row from GET /Patient/getAllPatientListPaginated */
export interface PatientApiRecord {
    id?: string;
    patientId?: string;
    fullName?: string;
    mrn?: string;
    dOB?: string;
    sex?: string;
    mobilePhone?: string;
    homePhone?: string;
    createdOn?: string;
    email?: string;
    emailAddress?: string;
    profilePicture?: string;
    [key: string]: unknown;
}

export interface PatientListItem {
    id: string;
    name: string;
    email: string;
    mrn: string;
    dob: string;
    gender: string;
    phone: string;
    createdDate: string;
    statusLabel: string;
    ward: string;
    bed: string;
    profilePicture?: string;
    raw: PatientApiRecord;
}

/** Sort keys in UI / URL (`sortBy` query); mapped to `sortField` for getAllPatientListPaginated */
export type PatientListSortField =
    | 'patient'
    | 'mrn'
    | 'dob'
    | 'gender'
    | 'phone'
    | 'createdDate'
    | 'ward'
    | 'bed'
    | 'status';

export interface GetPatientsListParams {
    page: number;
    limit: number;
    /** Active / inactive / omitted for all */
    status?: string;
    sex?: string;
    ageRange?: string;
    recent?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    sortBy?: PatientListSortField;
    sortOrder?: 'asc' | 'desc';
}

export interface GetPatientsParams {
    page: number;
    limit: number;
    /** `true` / `false` when filtering; omit property for "all" (if backend supports it). */
    status?: boolean;
}

export interface PaginatedPatientsResult {
    items: PatientListItem[];
    total: number;
    page: number;
    limit: number;
}

function pickString(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function formatDisplayDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function mapPatientRecord(raw: PatientApiRecord): PatientListItem {
    const phone = pickString(raw.mobilePhone) || pickString(raw.homePhone);
    const id =
        pickString(raw._id as string | undefined) ||
        pickString(raw.id) ||
        pickString(raw.patientId) ||
        pickString(raw.mrn) ||
        `row-${Math.random().toString(36).slice(2, 11)}`;

    return {
        id,
        name: pickString(raw.fullName) || '—',
        email: pickString(raw.email) || pickString(raw.emailAddress),
        mrn: pickString(raw.mrn) || '—',
        dob: formatDisplayDate(pickString(raw.dOB)),
        gender: pickString(raw.sex) || '—',
        phone: phone || '—',
        createdDate: formatDisplayDate(pickString(raw.createdOn)),
        statusLabel:
            pickString(raw.status as string | undefined) ||
            pickString(raw.patientStatus as string | undefined) ||
            pickString(raw.statusLabel as string | undefined) ||
            'Active',
        ward: pickString(raw.ward as string | undefined) || pickString(raw.wardName as string | undefined) || '—',
        bed:
            pickString(raw.bed as string | undefined) ||
            pickString(raw.bedNumber as string | undefined) ||
            pickString(raw.bedName as string | undefined) ||
            '—',
        profilePicture: pickString(raw.profilePicture) || undefined,
        raw,
    };
}

function extractRowsAndTotal(payload: unknown): { rows: PatientApiRecord[]; total: number } {
    const root = payload as Record<string, unknown>;
    const data = (root?.data ?? root?.result ?? root) as Record<string, unknown> | unknown[];

    if (Array.isArray(data)) {
        return { rows: data as PatientApiRecord[], total: data.length };
    }

    const obj = data as Record<string, unknown>;
    const list =
        (obj?.items as PatientApiRecord[]) ||
        (obj?.rows as PatientApiRecord[]) ||
        (obj?.patients as PatientApiRecord[]) ||
        (obj?.list as PatientApiRecord[]) ||
        (obj?.data as PatientApiRecord[]) ||
        [];

    const total =
        Number(obj?.total ?? obj?.totalCount ?? obj?.count ?? root?.total ?? root?.totalCount ?? list.length) ||
        list.length;

    return { rows: Array.isArray(list) ? list : [], total };
}

/**
 * GET /Patient/getAllPatientListPaginated
 * Query: page, limit, and status=true|false when filter is not "all".
 */
/** Normalized patient for facesheet header and shared EMR context (from GET /Patient/getPatientById/:id). */
export interface FacesheetPatient {
    id: string;
    fullName: string;
    mrn: string;
    dOB: string;
    sex: string;
    mobilePhone: string;
    address: string;
    raw: Record<string, unknown>;
}

function extractSinglePatientPayload(data: unknown): Record<string, unknown> {
    const root = data as Record<string, unknown> | null;
    if (!root || typeof root !== 'object') return {};
    const inner = (root.data ?? root.result ?? root.patient ?? root) as unknown;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
    }
    return {};
}

function buildPatientAddress(p: Record<string, unknown>): string {
    const direct = pickString(p.address);
    if (direct) return direct;
    const mailing = p.mailingAddress as Record<string, unknown> | undefined;
    if (mailing && typeof mailing === 'object') {
        const m = [
            pickString(mailing.address1),
            pickString(mailing.address2),
            pickString(mailing.city),
            pickString(mailing.state),
            pickString(mailing.zipCode ?? mailing.zip),
        ]
            .filter(Boolean)
            .join(', ');
        if (m) return m;
    }
    const parts = [
        pickString(p.address1),
        pickString(p.address2),
        pickString(p.city),
        pickString(p.state),
        pickString(p.zip ?? p.zipCode),
    ].filter(Boolean);
    return parts.join(', ');
}

function formatSexDisplay(sex: string): string {
    const s = sex.toLowerCase();
    if (s === 'f' || s === 'female') return 'Female';
    if (s === 'm' || s === 'male') return 'Male';
    return sex || '—';
}

/**
 * GET /Patient/getPatientById/:id — provider EMR; used for facesheet and global patient context.
 */
export async function getPatientById(id: string): Promise<FacesheetPatient> {
    const { data } = await api.get<unknown>(`/Patient/getPatientById/${encodeURIComponent(id)}`);
    const p = extractSinglePatientPayload(data);
    const resolvedId =
        pickString(p._id) || pickString(p.id) || pickString(p.patientId) || id.trim();
    const first = pickString(p.firstName);
    const last = pickString(p.lastName);
    const middle = pickString(p.middleName);
    const composed = [first, middle, last].filter(Boolean).join(' ').trim();
    const fullName = pickString(p.fullName) || composed || '—';
    const dobRaw = pickString(p.dOB);
    return {
        id: resolvedId,
        fullName,
        mrn: pickString(p.mrn) || '—',
        dOB: dobRaw ? formatDisplayDate(dobRaw) : '—',
        sex: formatSexDisplay(pickString(p.sex)),
        mobilePhone: pickString(p.mobilePhone) || pickString(p.homePhone) || '—',
        address: buildPatientAddress(p) || '—',
        raw: p,
    };
}

export async function getPatients({ page, limit, status }: GetPatientsParams): Promise<PaginatedPatientsResult> {
    const params: Record<string, string | number | boolean> = { page, limit };
    if (status !== undefined) {
        params.status = status;
    }

    const { data } = await api.get<unknown>('/Patient/getAllPatientListPaginated', { params });
    const { rows, total } = extractRowsAndTotal(data);
    const items = rows.map(mapPatientRecord);

    return {
        items,
        total,
        page,
        limit,
    };
}

const SORT_FIELDS: ReadonlySet<string> = new Set([
    'patient',
    'mrn',
    'dob',
    'gender',
    'phone',
    'createdDate',
    'ward',
    'bed',
    'status',
]);

export function parsePatientListSortField(value: string | null | undefined): PatientListSortField | null {
    if (!value || !SORT_FIELDS.has(value)) return null;
    return value as PatientListSortField;
}

/** Maps UI sort keys to API `sortField` names (Patient record fields). */
function patientListSortFieldToApi(field: PatientListSortField | undefined): string {
    const map: Record<PatientListSortField, string> = {
        patient: 'fullName',
        mrn: 'mrn',
        dob: 'dOB',
        gender: 'sex',
        phone: 'mobilePhone',
        createdDate: 'createdOn',
        ward: 'ward',
        bed: 'bed',
        status: 'status',
    };
    return map[field ?? 'patient'] ?? 'fullName';
}

function compactQueryParams(record: Record<string, unknown>): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        out[key] = value as string | number | boolean;
    }
    return out;
}

/**
 * GET /Patient/getAllPatientListPaginated — pagination, search, sort, filters.
 */
export async function getPatientsList(params: GetPatientsListParams): Promise<PaginatedPatientsResult> {
    const qp: Record<string, unknown> = {
        page: params.page,
        limit: params.limit,
        includeSignedUrls: true,
        sortField: patientListSortFieldToApi(params.sortBy),
        sortOrder: params.sortOrder ?? 'asc',
    };

    if (params.status === 'active') qp.status = true;
    else if (params.status === 'inactive') qp.status = false;

    const q = params.search?.trim();
    if (q) qp.search = q;

    if (params.sex && params.sex !== 'all') qp.sex = params.sex;
    if (params.ageRange && params.ageRange !== 'all') qp.ageRange = params.ageRange;
    if (params.recent && params.recent !== 'all') qp.recent = params.recent;
    if (params.fromDate) qp.fromDate = params.fromDate;
    if (params.toDate) qp.toDate = params.toDate;

    const { data } = await api.get<unknown>('/Patient/getAllPatientListPaginated', {
        params: compactQueryParams(qp),
    });
    const { rows, total } = extractRowsAndTotal(data);
    const items = rows.map(mapPatientRecord);

    return {
        items,
        total,
        page: params.page,
        limit: params.limit,
    };
}
