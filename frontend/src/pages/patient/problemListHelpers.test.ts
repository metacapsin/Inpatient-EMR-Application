import { describe, expect, it } from 'vitest';
import { groupProblemsForDisplay, type PatientProblem } from '../../services/problemsApi';
import {
    actionToStatus,
    availableActions,
    canEditProblem,
    filterProblemsBySearch,
    formatStatusLabel,
    sortProblemsClinicalOrder,
    statusBadgeClass,
    toDateInputValue,
} from './problemListHelpers';

const base = (over: Partial<PatientProblem>): PatientProblem => ({
    id: '1',
    tenantId: 't',
    patientId: 'p',
    icd10Code: 'E11.9',
    icd10Description: 'Type 2 diabetes mellitus without complications',
    status: 'active',
    ...over,
});

describe('problemListHelpers', () => {
    it('formats status labels and badge classes', () => {
        expect(formatStatusLabel('entered_in_error')).toBe('Entered in error');
        expect(formatStatusLabel('active')).toBe('Active');
        expect(statusBadgeClass('active')).toContain('green');
        expect(statusBadgeClass('resolved')).toContain('blue');
    });

    it('filters by code and description', () => {
        const list = [
            base({ id: '1', icd10Code: 'E11.9', icd10Description: 'Type 2 diabetes' }),
            base({ id: '2', icd10Code: 'I10', icd10Description: 'Essential hypertension' }),
        ];
        expect(filterProblemsBySearch(list, 'hyper')).toHaveLength(1);
        expect(filterProblemsBySearch(list, 'e11')).toHaveLength(1);
        expect(filterProblemsBySearch(list, '')).toHaveLength(2);
    });

    it('maps actions to statuses and available transitions', () => {
        expect(availableActions('active')).toEqual(['resolve', 'inactivate', 'entered_in_error']);
        expect(availableActions('entered_in_error')).toEqual([]);
        expect(actionToStatus('resolve')).toBe('resolved');
        expect(actionToStatus('reactivate')).toBe('active');
    });

    it('allows edit except for entered_in_error', () => {
        expect(canEditProblem('active')).toBe(true);
        expect(canEditProblem('entered_in_error')).toBe(false);
    });

    it('normalizes dates for input[type=date]', () => {
        expect(toDateInputValue('2026-10-26')).toBe('2026-10-26');
        expect(toDateInputValue('2026-10-26T00:00:00.000Z').startsWith('2026-10-')).toBe(true);
        expect(toDateInputValue(null)).toBe('');
    });

    it('sorts by clinical status order, not last update', () => {
        const sorted = sortProblemsClinicalOrder([
            base({ id: '1', status: 'resolved', updatedAt: '2026-10-29T12:00:00.000Z' }),
            base({ id: '2', status: 'active', chronicity: 'acute', icd10Code: 'J18.9' }),
            base({ id: '3', status: 'active', chronicity: 'chronic', icd10Code: 'I10' }),
            base({ id: '4', status: 'inactive', icd10Code: 'K21.9' }),
        ]);
        expect(sorted.map((p) => p.id)).toEqual(['3', '2', '4', '1']);
    });
});

describe('groupProblemsForDisplay', () => {
    it('groups active chronic/acute and history buckets', () => {
        const g = groupProblemsForDisplay([
            base({ id: '1', status: 'active', chronicity: 'chronic' }),
            base({ id: '2', status: 'active', chronicity: 'acute', icd10Code: 'J18.9' }),
            base({ id: '3', status: 'active', chronicity: null, icd10Code: 'R07.9' }),
            base({ id: '4', status: 'inactive', icd10Code: 'M54.5' }),
            base({ id: '5', status: 'resolved', icd10Code: 'N18.9' }),
            base({ id: '6', status: 'entered_in_error', icd10Code: 'Z87.891' }),
        ]);
        expect(g.activeChronic).toHaveLength(1);
        expect(g.activeAcute).toHaveLength(1);
        expect(g.activeUnspecified).toHaveLength(1);
        expect(g.inactive).toHaveLength(1);
        expect(g.resolved).toHaveLength(1);
        // entered_in_error intentionally omitted from ordinary display groups
        expect([...g.activeChronic, ...g.activeAcute, ...g.activeUnspecified, ...g.inactive, ...g.resolved]).toHaveLength(5);
    });
});
