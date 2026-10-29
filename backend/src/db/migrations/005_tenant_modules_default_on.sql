-- `enabled_modules` is now actually enforced (see middleware/moduleGate.js). An empty-by-default
-- column would silently lock every existing and self-registered tenant out of the whole app, which
-- is the opposite of what "enabled modules" should mean day one: new tenants start with everything
-- on, and a Super Admin opts a tenant OUT of specific modules, not in.
ALTER TABLE tenants
    ALTER COLUMN enabled_modules SET DEFAULT '["adt","patients","medication","billing","staffing"]'::jsonb;

-- Backfill only tenants still on the old empty default (self-registered/demo tenants); tenants a
-- Super Admin already provisioned with a deliberate module selection are left untouched.
UPDATE tenants
SET enabled_modules = '["adt","patients","medication","billing","staffing"]'::jsonb
WHERE enabled_modules = '[]'::jsonb;
