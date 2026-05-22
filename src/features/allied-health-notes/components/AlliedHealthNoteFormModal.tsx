import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { IRootState } from '../../../store';
import { AppModal } from '../../../components/shared/AppModal';
import AppButton from '../../../components/ui/AppButton';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import NewDropdown from '../../../components/ui/NewDropdown';
import { providerDisplayNameFromUser } from '../../../utils/dischargeReadinessUser';
import { ALLIED_HEALTH_DISCIPLINES, ALLIED_HEALTH_VISIT_TYPES } from '../constants/alliedHealthOptions';
import {
    createAlliedHealthNote,
    signAlliedHealthNote,
    updateAlliedHealthNote,
} from '../mock/alliedHealthNoteStore';
import type { AlliedHealthNote } from '../types/alliedHealthNote.types';
import { buildNotePayload, buildUpdatePayload } from '../utils/buildAlliedHealthNotePayload';
import { emptyFormState, noteToFormState, type AlliedHealthFormState } from '../utils/alliedHealthFormDefaults';
import { AlliedHealthDisciplineFields } from './AlliedHealthDisciplineFields';

type Props = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    encounterId: string;
    editingNote: AlliedHealthNote | null;
    readonly?: boolean;
    onSaved: () => void;
};

const labelClass = 'text-xs font-medium text-gray-600 dark:text-gray-400';

function toOptions(values: readonly string[]) {
    return values.map((v) => ({ value: v, label: v }));
}

function credentialsFromUser(user: IRootState['auth']['user']): string {
    if (!user) return '—';
    const cred = (user as { credentials?: string }).credentials;
    return typeof cred === 'string' && cred.trim() ? cred.trim() : 'PT, DPT';
}

export function AlliedHealthNoteFormModal({
    open,
    onClose,
    patientId,
    encounterId,
    editingNote,
    readonly = false,
    onSaved,
}: Props) {
    const user = useSelector((s: IRootState) => s.auth.user);
    const signedBy = providerDisplayNameFromUser(user) || 'Demo Clinician';
    const credentials = credentialsFromUser(user);
    const signedAtDisplay = useMemo(() => new Date().toLocaleString(), []);

    const [form, setForm] = useState<AlliedHealthFormState>(() => emptyFormState());
    const [busy, setBusy] = useState(false);

    const isSigned = editingNote?.status === 'Signed';
    const formReadonly = readonly || isSigned;

    useEffect(() => {
        if (!open) return;
        if (editingNote) {
            setForm(noteToFormState(editingNote));
        } else {
            setForm(emptyFormState());
        }
    }, [open, editingNote]);

    async function handleSaveDraft() {
        setBusy(true);
        try {
            const ctx = { patientId, encounterId, signedBy, credentials };
            if (editingNote?.id) {
                await updateAlliedHealthNote(editingNote.id, buildUpdatePayload(form));
                toast.success('Draft updated');
            } else {
                await createAlliedHealthNote(buildNotePayload(form, ctx));
                toast.success('Draft saved');
            }
            onSaved();
            onClose();
        } catch {
            toast.error('Save draft failed');
        } finally {
            setBusy(false);
        }
    }

    async function handleLockAndSign() {
        setBusy(true);
        try {
            const ctx = { patientId, encounterId, signedBy, credentials };
            const signedAt = new Date().toISOString();
            let noteId = editingNote?.id;
            if (noteId) {
                if (editingNote?.status === 'Draft') {
                    await updateAlliedHealthNote(noteId, buildUpdatePayload(form));
                }
            } else {
                const created = await createAlliedHealthNote(buildNotePayload(form, ctx));
                noteId = created.id;
            }
            if (!noteId) throw new Error('Missing note id');
            await signAlliedHealthNote(noteId, signedAt);
            toast.success('Note signed and locked');
            onSaved();
            onClose();
        } catch {
            toast.error('Lock & sign failed');
        } finally {
            setBusy(false);
        }
    }

    const title = formReadonly ? 'View allied health note' : editingNote ? 'Edit allied health note' : 'Add allied health note';

    return (
        <AppModal
            open={open}
            title={title}
            size="xl"
            onClose={onClose}
            footer={
                formReadonly ? (
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                            Save Draft
                        </Button>
                        <AppButton type="button" onClick={() => void handleLockAndSign()} disabled={busy}>
                            Lock & Sign
                        </AppButton>
                    </div>
                )
            }
        >
            <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className={labelClass}>Discipline</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(ALLIED_HEALTH_DISCIPLINES)}
                                value={form.discipline}
                                onChange={(v) => setForm((f) => ({ ...f, discipline: String(v) as typeof f.discipline }))}
                                placeholder="Select…"
                                disabled={formReadonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Visit Type</label>
                        <div className="mt-1">
                            <NewDropdown
                                options={toOptions(ALLIED_HEALTH_VISIT_TYPES)}
                                value={form.visitType}
                                onChange={(v) => setForm((f) => ({ ...f, visitType: String(v) as typeof f.visitType }))}
                                placeholder="Select…"
                                disabled={formReadonly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Visit Date/Time</label>
                        <Input
                            className="mt-1"
                            type="datetime-local"
                            value={form.visitDateTime}
                            onChange={(e) => setForm((f) => ({ ...f, visitDateTime: e.target.value }))}
                            readOnly={formReadonly}
                            disabled={formReadonly}
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className={labelClass}>Subjective</label>
                        <Textarea
                            className="mt-1"
                            rows={4}
                            value={form.subjective}
                            onChange={(e) => setForm((f) => ({ ...f, subjective: e.target.value }))}
                            readOnly={formReadonly}
                            disabled={formReadonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Objective</label>
                        <Textarea
                            className="mt-1"
                            rows={4}
                            value={form.objective}
                            onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                            readOnly={formReadonly}
                            disabled={formReadonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Assessment</label>
                        <Textarea
                            className="mt-1"
                            rows={4}
                            value={form.assessment}
                            onChange={(e) => setForm((f) => ({ ...f, assessment: e.target.value }))}
                            readOnly={formReadonly}
                            disabled={formReadonly}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Plan</label>
                        <Textarea
                            className="mt-1"
                            rows={4}
                            value={form.plan}
                            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                            readOnly={formReadonly}
                            disabled={formReadonly}
                        />
                    </div>
                </div>

                <AlliedHealthDisciplineFields discipline={form.discipline} form={form} onChange={setForm} readonly={formReadonly} />

                <div className="grid gap-3 rounded border border-gray-200 bg-gray-50/80 p-3 md:grid-cols-3 dark:border-gray-700 dark:bg-gray-900/40">
                    <div>
                        <label className={labelClass}>Signed By</label>
                        <Input className="mt-1" value={editingNote?.signedBy || signedBy} readOnly disabled />
                    </div>
                    <div>
                        <label className={labelClass}>Credentials</label>
                        <Input className="mt-1" value={editingNote?.credentials || credentials} readOnly disabled />
                    </div>
                    <div>
                        <label className={labelClass}>Signed At</label>
                        <Input
                            className="mt-1"
                            value={
                                editingNote?.signedAt
                                    ? new Date(editingNote.signedAt).toLocaleString()
                                    : isSigned
                                      ? signedAtDisplay
                                      : '— (set on Lock & Sign)'
                            }
                            readOnly
                            disabled
                        />
                    </div>
                </div>
            </div>
        </AppModal>
    );
}
