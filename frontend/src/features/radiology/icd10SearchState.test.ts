import { describe, expect, it } from 'vitest';

/**
 * Stale-response guard used by ICD typeahead / add-problem search:
 * only the latest sequence number may commit results.
 */
function applySearchResult(seq: number, currentSeq: number, hits: string[]): string[] | null {
    if (seq !== currentSeq) return null;
    return hits;
}

describe('ICD-10 search stale response handling', () => {
    it('ignores older responses when a newer search started', () => {
        let current = 0;
        current += 1;
        const first = current;
        current += 1;
        const second = current;
        expect(applySearchResult(first, current, ['old'])).toBeNull();
        expect(applySearchResult(second, current, ['new'])).toEqual(['new']);
    });

    it('accepts the response when seq matches', () => {
        expect(applySearchResult(3, 3, ['E11.9'])).toEqual(['E11.9']);
    });
});
