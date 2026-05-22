import type { AlliedHealthDiscipline, AlliedHealthNote, AlliedHealthVisitType } from '../types/alliedHealthNote.types';

const notesByEncounter = new Map<string, AlliedHealthNote[]>();

function encounterKey(encounterId: string): string {
    return encounterId.trim();
}

function nextId(): string {
    return `ahn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Simulates GET /api/AlliedHealthNote/encounter/:encounterId */
export async function fetchAlliedHealthNotesByEncounter(
    encounterId: string,
    filters?: { discipline?: AlliedHealthDiscipline | ''; visitType?: AlliedHealthVisitType | '' },
): Promise<AlliedHealthNote[]> {
    await delay(120);
    let list = [...(notesByEncounter.get(encounterKey(encounterId)) ?? [])];
    if (filters?.discipline) {
        list = list.filter((n) => n.discipline === filters.discipline);
    }
    if (filters?.visitType) {
        list = list.filter((n) => n.visitType === filters.visitType);
    }
    return list.sort((a, b) => new Date(b.visitDateTime).getTime() - new Date(a.visitDateTime).getTime());
}

export type CreateAlliedHealthNoteInput = Omit<AlliedHealthNote, 'id' | 'status' | 'signedAt'> & {
    status?: AlliedHealthNote['status'];
    signedAt?: string | null;
};

/** Simulates POST /api/AlliedHealthNote/create */
export async function createAlliedHealthNote(input: CreateAlliedHealthNoteInput): Promise<AlliedHealthNote> {
    await delay(150);
    const note: AlliedHealthNote = {
        ...input,
        id: nextId(),
        status: input.status ?? 'Draft',
        signedAt: input.signedAt ?? null,
    };
    const key = encounterKey(input.encounterId);
    const existing = notesByEncounter.get(key) ?? [];
    notesByEncounter.set(key, [note, ...existing]);
    return note;
}

export type UpdateAlliedHealthNoteInput = Partial<
    Omit<AlliedHealthNote, 'id' | 'patientId' | 'encounterId' | 'status' | 'signedAt' | 'signedBy' | 'credentials'>
>;

/** Simulates PUT /api/AlliedHealthNote/:noteId */
export async function updateAlliedHealthNote(noteId: string, patch: UpdateAlliedHealthNoteInput): Promise<AlliedHealthNote> {
    await delay(150);
    const found = findNote(noteId);
    if (!found) throw new Error('Note not found');
    if (found.note.status !== 'Draft') throw new Error('Only draft notes can be edited');
    const updated: AlliedHealthNote = { ...found.note, ...patch };
    const list = notesByEncounter.get(encounterKey(found.note.encounterId)) ?? [];
    list[found.index] = updated;
    notesByEncounter.set(encounterKey(found.note.encounterId), list);
    return updated;
}

/** Simulates PUT /api/AlliedHealthNote/:noteId/sign */
export async function signAlliedHealthNote(noteId: string, signedAt: string): Promise<AlliedHealthNote> {
    await delay(150);
    const found = findNote(noteId);
    if (!found) throw new Error('Note not found');
    if (found.note.status === 'Signed') throw new Error('Note is already signed');
    const updated: AlliedHealthNote = {
        ...found.note,
        status: 'Signed',
        signedAt,
    };
    const list = notesByEncounter.get(encounterKey(found.note.encounterId)) ?? [];
    list[found.index] = updated;
    notesByEncounter.set(encounterKey(found.note.encounterId), list);
    return updated;
}

function findNote(noteId: string): { note: AlliedHealthNote; index: number } | null {
    for (const [, list] of notesByEncounter) {
        const index = list.findIndex((n) => n.id === noteId);
        if (index >= 0) return { note: list[index], index };
    }
    return null;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
