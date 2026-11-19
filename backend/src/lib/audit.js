import { query } from '../db/pool.js';

/**
 * Writes one row to the append-only `audit_events` table. Fire-and-forget by design — a logging
 * failure must never fail the request it's describing — so callers should not await this inside a
 * response path that still needs to succeed; errors are swallowed to a console line.
 *
 * `details` must never contain PHI free text (names, notes, raw clinical values) — ids, codes and
 * counts only. See `middleware/audit.js` for the per-request version of this that most routes get
 * for free; this function is for the explicit events a request shape alone can't capture (which
 * user failed to log in, what a platform admin changed on a tenant, whether a patient granted or
 * denied a SMART authorization).
 *
 * @param {{
 *   tenantId?: string | null,
 *   actorType: 'staff' | 'platform_admin' | 'patient' | 'anonymous',
 *   actorId?: string | null,
 *   actorRole?: string | null,
 *   action: 'read'|'create'|'update'|'delete'|'login'|'login_failed'|'logout'|'refresh'|'password_reset'|'export'|'platform',
 *   resource?: string | null,
 *   resourceId?: string | null,
 *   patientId?: string | null,
 *   encounterId?: string | null,
 *   method?: string | null,
 *   path?: string | null,
 *   status?: number | null,
 *   latencyMs?: number | null,
 *   ip?: string | null,
 *   userAgent?: string | null,
 *   queryKeys?: string[],
 *   details?: Record<string, unknown>,
 * }} event
 */
export async function recordAuditEvent(event) {
    try {
        await query(
            `INSERT INTO audit_events
                (tenant_id, actor_type, actor_id, actor_role, action, resource, resource_id,
                 patient_id, encounter_id, method, path, query_keys, status, latency_ms, ip, user_agent, details)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17::jsonb)`,
            [
                event.tenantId ?? null,
                event.actorType,
                event.actorId ?? null,
                event.actorRole ?? null,
                event.action,
                event.resource ?? null,
                event.resourceId ?? null,
                event.patientId ?? null,
                event.encounterId ?? null,
                event.method ?? null,
                event.path ? String(event.path).slice(0, 2000) : null,
                JSON.stringify(event.queryKeys ?? []),
                event.status ?? null,
                event.latencyMs ?? null,
                event.ip ?? null,
                event.userAgent ? String(event.userAgent).slice(0, 300) : null,
                JSON.stringify(event.details ?? {}),
            ],
        );
    } catch (e) {
        console.error('[audit_events]', /** @type {Error} */ (e).message);
    }
}
