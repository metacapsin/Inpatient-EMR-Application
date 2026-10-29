import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatIcd10Code, parseOrderLine } from '../src/db/icd10OrderFile.js';

test('formatIcd10Code inserts decimal after third character', () => {
    assert.equal(formatIcd10Code('A00'), 'A00');
    assert.equal(formatIcd10Code('A000'), 'A00.0');
    assert.equal(formatIcd10Code('E119'), 'E11.9');
    assert.equal(formatIcd10Code('e11.9'), 'E11.9');
});

test('parseOrderLine reads CMS order-file fixed-width rows', () => {
    const header = '00001 A00     0 Cholera                                                      Cholera';
    const leaf =
        '00002 A000    1 Cholera due to Vibrio cholerae 01, biovar cholerae           Cholera due to Vibrio cholerae 01, biovar cholerae';
    const h = parseOrderLine(header);
    assert.equal(h.code, 'A00');
    assert.equal(h.billable, false);
    assert.match(h.description, /Cholera/);
    const b = parseOrderLine(leaf);
    assert.equal(b.code, 'A00.0');
    assert.equal(b.billable, true);
    assert.match(b.description, /Vibrio/);
    assert.equal(parseOrderLine(''), null);
});
