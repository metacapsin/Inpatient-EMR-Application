import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { isValidNpi } from '../lib/npi.js';

export const tenantProfileRouter = Router();
const admin = requireRole(); // admin always passes anyway; stated for clarity

// Regexes ported 1:1 from PracticeInformationCard.tsx so client and server agree.
const namePattern = /^(?!\s)(?!.*\s$).+$/;
const addressPattern = /^(?! )[A-Za-z0-9,.\/\-#]+(?: [A-Za-z0-9,.\/\-#]+)*(?<! )$/;
const cityPattern = /^(?! )[A-Za-z.'\-]+(?: [A-Za-z.'\-]+)*(?<! )$/;
const zipPattern = /^\d{5}(-\d{4})?$/;
const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
const einPattern = /^\d{2}-\d{7}$/;
const npiShapePattern = /^[1-9]\d{9}$/;

/** Treats null/undefined and blank/whitespace-only strings as "not provided" so optional fields
 *  skip validation entirely, mirroring the frontend's `f.field?.trim()` guards. `null` shows up
 *  routinely here: GET returns `null` for unset columns, and a field the user never touches in
 *  the edit form round-trips that same `null` straight back in the PUT body. */
const optional = (schema) =>
    z.preprocess((v) => (v == null || (typeof v === 'string' && v.trim() === '') ? undefined : v), schema.optional());

const nameSchema = z
    .string()
    .min(3, 'Name must be at least 3 characters.')
    .max(35, 'Name must be at most 35 characters.')
    .regex(namePattern, 'Name cannot have leading or trailing spaces.');

const addressSchema = (field) =>
    z
        .string()
        .min(5, `${field} must be at least 5 characters.`)
        .max(250, `${field} must be at most 250 characters.`)
        .regex(addressPattern, `${field}: only alphanumeric and , . - # / allowed, no leading/trailing spaces.`);

const citySchema = z
    .string()
    .min(3, 'City must be at least 3 characters.')
    .max(50, 'City must be at most 50 characters.')
    .regex(cityPattern, "City: only letters, . ' - allowed, no leading/trailing spaces.");

const zipSchema = z.string().regex(zipPattern, 'Zip must be 12345 or 12345-6789.');

const phoneSchema = z
    .string()
    .regex(phonePattern, 'Phone must be a valid 10-digit number.')
    .refine((v) => v.replace(/\D/g, '')[0] !== '0' && v.replace(/\D/g, '')[0] !== '1', 'Area code cannot start with 0 or 1.')
    .refine((v) => v.replace(/\D/g, '')[3] !== '0' && v.replace(/\D/g, '')[3] !== '1', 'Exchange code cannot start with 0 or 1.');

const einSchema = z.string().regex(einPattern, 'EIN must be in format 12-3456789.');

// Shape (10 digits, first 1-9) plus the real Luhn check digit — see lib/npi.js.
const npiSchema = z
    .string()
    .regex(npiShapePattern, 'NPI must be exactly 10 digits, first digit 1-9.')
    .refine(isValidNpi, 'NPI check digit is invalid — not a real NPI.');

const profileSchema = z.object({
    name: nameSchema,
    address: addressSchema('Address'),
    address2: optional(addressSchema('Address 2')),
    city: citySchema,
    state: z.string().trim().min(1, 'State is required.').max(10),
    zip: zipSchema,
    phone: phoneSchema,
    fax: optional(z.string().max(14, 'Fax must be at most 14 characters.')),
    ein: optional(einSchema),
    groupNpi: optional(npiSchema),
});

function profileOut(tenantName, p) {
    return {
        tenantId: p?.tenant_id ?? null,
        name: tenantName,
        practiceType: p?.practice_type ?? null,
        type: p?.practice_type ?? null, // PracticeInformationCard reads either key
        address: p?.address1 ?? null,
        address2: p?.address2 ?? null,
        city: p?.city ?? null,
        state: p?.state ?? null,
        zip: p?.zip ?? null,
        phone: p?.phone ?? null,
        fax: p?.fax ?? null,
        ein: p?.ein ?? null,
        groupNpi: p?.npi ?? null,
        logoUrl: p?.logo_url ?? null,
        timezone: p?.timezone ?? null,
        createdAt: p?.created_at?.toISOString() ?? null,
        updatedAt: p?.updated_at?.toISOString() ?? null,
    };
}

// Singleton fetch, scoped to the caller's tenant.
tenantProfileRouter.get('/api/tenant/profile', h(async (req, res) => {
    const t = await query('SELECT name FROM tenants WHERE id = $1', [req.user.tenantId]);
    if (!t.rowCount) throw notFound('Tenant not found');
    const p = await query('SELECT * FROM tenant_profile WHERE tenant_id = $1', [req.user.tenantId]);
    ok(res, profileOut(t.rows[0].name, p.rows[0]));
}));

// Upsert: a tenant created before this feature shipped has no tenant_profile row yet.
tenantProfileRouter.put('/api/tenant/profile', admin, h(async (req, res) => {
    const b = parse(profileSchema, req.body);
    await query('UPDATE tenants SET name = $1 WHERE id = $2', [b.name, req.user.tenantId]);
    const r = await query(
        `INSERT INTO tenant_profile (tenant_id, address1, address2, city, state, zip, phone, fax, npi, ein, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (tenant_id) DO UPDATE SET
             address1 = EXCLUDED.address1, address2 = EXCLUDED.address2, city = EXCLUDED.city,
             state = EXCLUDED.state, zip = EXCLUDED.zip, phone = EXCLUDED.phone, fax = EXCLUDED.fax,
             npi = EXCLUDED.npi, ein = EXCLUDED.ein, updated_at = now()
         RETURNING *`,
        [req.user.tenantId, b.address, b.address2 ?? null, b.city, b.state, b.zip, b.phone, b.fax ?? null, b.groupNpi ?? null, b.ein ?? null],
    );
    ok(res, profileOut(b.name, r.rows[0]), { message: 'Practice information updated' });
}));
