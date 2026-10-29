import type { PatientProblem, ProblemStatus } from '../../services/problemsApi';

/** Pure helpers for Diagnoses / problem list UI (unit-tested). */

export function statusBadgeClass(status: ProblemStatus): string {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'inactive':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'resolved':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        case 'entered_in_error':
            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        default:
            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
}

export function formatStatusLabel(status: ProblemStatus): string {
    if (status === 'entered_in_error') return 'Entered in error';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export function filterProblemsBySearch(list: PatientProblem[], search: string): PatientProblem[] {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
        (p) =>
            p.icd10Code.toLowerCase().includes(q) ||
            p.icd10Description.toLowerCase().includes(q) ||
            (p.chronicity ?? '').toLowerCase().includes(q)
    );
}

/**
 * EMR clinical order (matches backend list): active chronic → active acute →
 * active unspecified → inactive → resolved. No “last touched” jump to top.
 */
export function sortProblemsClinicalOrder(list: PatientProblem[]): PatientProblem[] {
    const rank = (p: PatientProblem): number => {
        if (p.status === 'active' && p.chronicity === 'chronic') return 0;
        if (p.status === 'active' && p.chronicity === 'acute') return 1;
        if (p.status === 'active') return 2;
        if (p.status === 'inactive') return 3;
        if (p.status === 'resolved') return 4;
        return 5;
    };
    return [...list].sort((a, b) => {
        const d = rank(a) - rank(b);
        if (d !== 0) return d;
        const aTs = Date.parse(a.createdAt || '') || 0;
        const bTs = Date.parse(b.createdAt || '') || 0;
        return bTs - aTs;
    });
}

export type ProblemAction = 'resolve' | 'inactivate' | 'reactivate' | 'entered_in_error';

export function availableActions(status: ProblemStatus): ProblemAction[] {
    switch (status) {
        case 'active':
            return ['resolve', 'inactivate', 'entered_in_error'];
        case 'inactive':
            return ['reactivate', 'resolve', 'entered_in_error'];
        case 'resolved':
            return ['reactivate', 'entered_in_error'];
        default:
            return [];
    }
}

/** Entered-in-error rows are terminal; everything else can open the Edit dialog. */
export function canEditProblem(status: ProblemStatus): boolean {
    return status !== 'entered_in_error';
}

/** Normalize API date (ISO or YYYY-MM-DD) for <input type="date">. */
export function toDateInputValue(dateString?: string | null): string {
    if (!dateString?.trim()) return '';
    const s = dateString.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function actionToStatus(action: ProblemAction): ProblemStatus {
    switch (action) {
        case 'resolve':
            return 'resolved';
        case 'inactivate':
            return 'inactive';
        case 'reactivate':
            return 'active';
        case 'entered_in_error':
            return 'entered_in_error';
    }
}
