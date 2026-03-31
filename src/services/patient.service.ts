import { format } from 'date-fns';
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
    /** Often boolean in list API (matches `status` query filter) */
    status?: boolean | string | number;
    isActive?: boolean;
    active?: boolean;
    patientStatus?: string;
    statusLabel?: string;
    accountStatus?: string;
    [key: string]: unknown;
}

export interface PatientListItem {
    id: string;
    name: string;
    email: string;
    mrn: string;
    /** DOB formatted MM/DD/YYYY for display */
    dob: string;
    /** Raw API date string (ISO or parseable) for age calculation */
    dobRaw: string;
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
    /** Filter: `all` or API values `M` / `F`. */
    gender?: string;
    /** UI bucket `0-18` | `19-64` | `65+` — mapped to `ageMin`/`ageMax` + `fromDOB`/`toDOB` for the API */
    ageRange?: string;
    recent?: string;
    startDate?: string;
    endDate?: string;
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

function startOfLocalDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addYears(d: Date, years: number): Date {
    const x = new Date(d.getTime());
    x.setFullYear(x.getFullYear() + years);
    return x;
}

function addDays(d: Date, days: number): Date {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + days);
    return x;
}

function toYmd(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

/**
 * Maps UI age buckets to API params. Sends `ageMin`/`ageMax` and inclusive DOB bounds (`fromDOB`/`toDOB`)
 * so the backend can filter by either convention. Does not send legacy `ageRange`.
 */
export function buildAgeFilterParams(ageRange: string | undefined): {
    ageMin: number;
    ageMax: number;
    fromDOB: string;
    toDOB: string;
} | null {
    if (!ageRange || ageRange === 'all') return null;
    const today = startOfLocalDay(new Date());
    switch (ageRange) {
        case '0-18': {
            const from = addDays(addYears(today, -19), 1);
            return { ageMin: 0, ageMax: 18, fromDOB: toYmd(from), toDOB: toYmd(today) };
        }
        case '19-35': {
            const from = addDays(addYears(today, -36), 1);
            const to = addYears(today, -19);
            return {
                ageMin: 19,
                ageMax: 35,
                fromDOB: toYmd(from),
                toDOB: toYmd(to),
            };
        }
        case '65+': {
            const to = addYears(today, -65);
            return { ageMin: 65, ageMax: 200, fromDOB: '1900-01-01', toDOB: toYmd(to) };
        }
        // Legacy URL values
        case '0-17':
            return buildAgeFilterParams('0-18');
        case '18-64':
            return buildAgeFilterParams('19-64');
        default:
            return null;
    }
}

function parseDobDate(raw: string): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

/** MM/DD/YYYY for patient list DOB column */
function formatDobMMDDYYYY(raw: string): string {
    const d = parseDobDate(raw);
    if (!d) return raw ? raw.trim() : '—';
    return format(d, 'MM/dd/yyyy');
}

function monthsBetweenBirthAndRef(birth: Date, ref: Date): number {
    let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
    if (ref.getDate() < birth.getDate()) months -= 1;
    return Math.max(0, months);
}

/**
 * Human-readable age from DOB (calendar years, or months if under one year).
 */
export function formatAgeLabelFromDobRaw(raw: string): string {
    const birth = parseDobDate(raw);
    if (!birth) return '—';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        years -= 1;
    }
    if (years >= 1) {
        return `${years} ${years === 1 ? 'Year' : 'Years'}`;
    }
    const months = monthsBetweenBirthAndRef(birth, today);
    if (months === 0) return 'Newborn';
    return `${months} ${months === 1 ? 'Month' : 'Months'}`;
}

function formatDisplayDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Coerce API flag values to boolean; unknown shapes → null */
function apiTruthyToBool(v: unknown): boolean | null {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    return null;
}

/**
 * Derive a single status label for the patient list from common API shapes:
 * `status: true|false`, `isActive`, string enums, etc.
 */
export function mapPatientStatusFromApi(raw: PatientApiRecord): string {
    const r = raw as Record<string, unknown>;

    const boolStatus = apiTruthyToBool(r.status);
    if (boolStatus === true) return 'Active';
    if (boolStatus === false) return 'Inactive';

    const stringStatusKeys = [
        'status',
        'patientStatus',
        'statusLabel',
        'accountStatus',
        'recordStatus',
        'patientRecordStatus',
    ] as const;
    for (const key of stringStatusKeys) {
        const s = pickString(r[key] as string | undefined);
        if (!s) continue;
        const low = s.toLowerCase();
        if (low === 'true' || low === '1' || low === 'yes' || low === 'y' || low === 'active') return 'Active';
        if (low === 'false' || low === '0' || low === 'no' || low === 'n' || low === 'inactive') return 'Inactive';
        return s;
    }

    const boolKeys = ['isActive', 'active', 'patientIsActive', 'isPatientActive', 'patientActive'] as const;
    for (const key of boolKeys) {
        const b = apiTruthyToBool(r[key]);
        if (b === true) return 'Active';
        if (b === false) return 'Inactive';
    }

    return '—';
}

export function mapPatientRecord(raw: PatientApiRecord): PatientListItem {
    const phone = pickString(raw.mobilePhone) || pickString(raw.homePhone);
    const id =
        pickString(raw._id as string | undefined) ||
        pickString(raw.id) ||
        pickString(raw.patientId) ||
        pickString(raw.mrn) ||
        `row-${Math.random().toString(36).slice(2, 11)}`;
    const dobRaw = pickString(raw.dOB);

    return {
        id,
        name: pickString(raw.fullName) || '—',
        email: pickString(raw.email) || pickString(raw.emailAddress),
        mrn: pickString(raw.mrn) || '—',
        dob: formatDobMMDDYYYY(dobRaw),
        dobRaw,
        gender: pickString(raw.sex) || '—',
        phone: phone || '—',
        createdDate: formatDisplayDate(pickString(raw.createdOn)),
        statusLabel: mapPatientStatusFromApi(raw),
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

function toApiYmd(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return undefined;
    return format(d, 'yyyy-MM-dd');
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

    if (params.gender && params.gender !== 'all') {
        const g = params.gender.trim().toUpperCase();
        if (g === 'M' || g === 'F') qp.gender = g;
    }
    const ageFilter = buildAgeFilterParams(params.ageRange);
    if (params.ageRange && params.ageRange !== 'all') {
        qp.ageRange = params.ageRange; 
    }
    if (params.recent && params.recent !== 'all') {
        qp.recentlyCreated = params.recent; 
      }
    const startDate = toApiYmd(params.startDate);
    if (startDate) qp.startDate = startDate;

    const endDate = toApiYmd(params.endDate);
    if (endDate) qp.endDate = endDate;

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
