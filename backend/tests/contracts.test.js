import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CDS_SEVERITIES, CDS_OVERRIDE_SEVERITIES } from '../src/lib/cds/schemas.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cdsTs = fs.readFileSync(path.join(root, 'frontend/src/types/cds.ts'), 'utf8');
const paTs = fs.readFileSync(path.join(root, 'frontend/src/types/patientAccess.ts'), 'utf8');

describe('cross-package contracts', () => {
    it('frontend cds severities include every backend severity', () => {
        for (const s of CDS_SEVERITIES) assert.match(cdsTs, new RegExp(`['"]${s}['"]`));
        for (const s of CDS_OVERRIDE_SEVERITIES) assert.match(cdsTs, new RegExp(`['"]${s}['"]`));
    });

    it('frontend SMART_SCOPES includes patient/*.read', () => {
        assert.match(paTs, /patient\/\*\.read/);
        assert.match(paTs, /offline_access/);
    });
});
