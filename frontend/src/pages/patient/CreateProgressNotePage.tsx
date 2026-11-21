import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { CheckCircle2, FileText, Pencil, Save, Signature } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import {
    PROGRESS_NOTE_TYPE,
    createPatientChartNote,
    fetchActiveEncountersForPatient,
    fetchProviderOptions,
    getPatientChartNoteById,
    signPatientChartNote,
    updatePatientChartNote,
    type PatientChartNote,
} from '../../services/patientChartNotes.service';

type Mode = 'create' | 'edit' | 'view';

function displayName(user: { name?: string; firstName?: string; lastName?: string; username?: string; email?: string } | null | undefined): string {
    if (!user) return 'Provider';
    if (user.name?.trim()) return user.name.trim();
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (full) return full;
    return user.username || user.email || 'Provider';
}

function toInputDate(value?: string): string {
    if (!value) return new Date().toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
}

const CreateProgressNotePage: React.FC = () => {
    const navigate = useNavigate();
    const { noteId } = useParams<{ noteId?: string }>();
    const [searchParams] = useSearchParams();
    const patientId = usePatientId();
    const { user, role } = useAuth();
    const { moduleSurfaceClass } = useFacesheetChartLayout();

    const initialMode: Mode = noteId ? (searchParams.get('mode') === 'edit' ? 'edit' : 'view') : 'create';
    const [mode, setMode] = useState<Mode>(initialMode);
    const [loading, setLoading] = useState(Boolean(noteId));
    const [saving, setSaving] = useState(false);
    const [note, setNote] = useState<PatientChartNote | null>(null);

    const [notesType] = useState(PROGRESS_NOTE_TYPE);
    const [encounterId, setEncounterId] = useState('');
    const [visitDate, setVisitDate] = useState(toInputDate());
    const [assignedProviderId, setAssignedProviderId] = useState('');
    const [notesText, setNotesText] = useState('');
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
    const [encounters, setEncounters] = useState<Array<{ id: string; label: string }>>([]);

    const facesheetBase = patientId ? `/app/facesheet/${encodeURIComponent(patientId)}/notes` : '/app/notes';
    const isReadOnly = mode === 'view' || note?.noteStatus === 'Completed' || note?.noteStatus === 'Marked in Error';
    const noteStatus = note?.noteStatus || 'In Draft';
    const userId = String(user?.id || user?._id || '');
    const userName = displayName(user);
    const canSign =
        Boolean(note?.id) &&
        !note?.providerSigned &&
        noteStatus !== 'Completed' &&
        noteStatus !== 'Marked in Error' &&
        mode !== 'create' &&
        Boolean(assignedProviderId) &&
        (role === 'admin' ||
            ((role === 'physician' || role === 'nurse') && userId === assignedProviderId));

    const errors = useMemo(() => {
        const e: Record<string, string> = {};
        if (!encounterId) e.encounterId = 'Encounter is required.';
        if (!visitDate) e.date = 'Visit Date is required.';
        if (!assignedProviderId) e.assignedProvider = 'Assigned Provider is required.';
        if (!notesText.trim()) e.notesText = 'Notes text is required.';
        else if (notesText.trim().length < 5) e.notesText = 'Input should be more than 5 characters.';
        return e;
    }, [encounterId, visitDate, assignedProviderId, notesText]);

    const shellTitle = mode === 'create' ? 'New Progress Note' : mode === 'edit' ? 'Edit Progress Note' : 'View Progress Note';

    const loadLookups = useCallback(async () => {
        if (!patientId) return;
        try {
            const [prov, enc] = await Promise.all([
                fetchProviderOptions(),
                fetchActiveEncountersForPatient(patientId),
            ]);
            setProviders(prov);
            setEncounters(enc);
            if (!noteId) {
                if (enc.length === 1) setEncounterId(enc[0].id);
                if (userId && prov.some((p) => p.id === userId)) setAssignedProviderId(userId);
                else if (prov.length === 1) setAssignedProviderId(prov[0].id);
            }
        } catch {
            toast.error('Could not load providers or encounters');
        }
    }, [patientId, noteId, userId]);

    const loadNote = useCallback(async () => {
        if (!noteId) return;
        setLoading(true);
        try {
            const n = await getPatientChartNoteById(noteId);
            setNote(n);
            setEncounterId(n.encounterId || '');
            setVisitDate(toInputDate(n.date));
            setAssignedProviderId(n.assignedProvider?.id || n.assignedProvider?._id || '');
            setNotesText(n.notesText || '');
            if (n.noteStatus === 'Completed' || n.noteStatus === 'Marked in Error') setMode('view');
            else if (searchParams.get('mode') === 'edit') setMode('edit');
            else setMode('view');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to load note');
            navigate(facesheetBase);
        } finally {
            setLoading(false);
        }
    }, [noteId, navigate, facesheetBase, searchParams]);

    useEffect(() => {
        loadLookups();
    }, [loadLookups]);

    useEffect(() => {
        loadNote();
    }, [loadNote]);

    const markTouched = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

    const buildPayload = () => {
        const provider = providers.find((p) => p.id === assignedProviderId);
        return {
            patientId: patientId!,
            encounterId,
            notesType: PROGRESS_NOTE_TYPE as typeof PROGRESS_NOTE_TYPE,
            notesText: notesText.trim(),
            date: visitDate,
            assignedProviderId,
            assignedProviderName: provider?.name || userName,
        };
    };

    const handleSave = async () => {
        setTouched({ encounterId: true, date: true, assignedProvider: true, notesText: true });
        if (Object.keys(errors).length) {
            toast.error('Please fix the required fields');
            return;
        }
        if (!patientId) {
            toast.error('Patient ID is required');
            return;
        }
        setSaving(true);
        try {
            if (mode === 'create') {
                await createPatientChartNote(buildPayload());
                toast.success('Note created');
                navigate(facesheetBase, { replace: true });
            } else if (note?.id) {
                const updated = await updatePatientChartNote({ id: note.id, ...buildPayload() });
                setNote(updated);
                toast.success('Note updated');
                setMode('view');
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to save note');
        } finally {
            setSaving(false);
        }
    };

    const handleSign = async () => {
        if (!note?.id) return;
        if (Object.keys(errors).length) {
            setTouched({ encounterId: true, date: true, assignedProvider: true, notesText: true });
            toast.error('Please fix the required fields before signing');
            return;
        }
        setSaving(true);
        try {
            if (mode === 'edit') {
                await updatePatientChartNote({ id: note.id, ...buildPayload() });
            }
            await signPatientChartNote(note.id, userName);
            toast.success('Note signed');
            navigate(facesheetBase, { replace: true });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to sign note');
        } finally {
            setSaving(false);
        }
    };

    if (!patientId) {
        return (
            <div className={moduleSurfaceClass}>
                <p className="text-sm text-gray-600 dark:text-gray-300">Open Notes from a patient facesheet to create documentation.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={moduleSurfaceClass}>
                <div className="py-16 text-center text-sm text-gray-500">Loading note…</div>
            </div>
        );
    }

    return (
        <div className={moduleSurfaceClass}>
            <header className="mb-5 flex flex-col gap-3 border-b border-white-light pb-4 dark:border-[#191e3a] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <Link to={facesheetBase} className="text-primary hover:underline">
                            Notes
                        </Link>
                        <span>/</span>
                        <span className="font-medium text-gray-900 dark:text-white">{shellTitle}</span>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                noteStatus === 'Completed'
                                    ? 'bg-success/15 text-success'
                                    : noteStatus === 'Marked in Error'
                                      ? 'bg-danger/15 text-danger'
                                      : 'bg-warning/15 text-warning'
                            }`}
                        >
                            {noteStatus}
                        </span>
                    </div>
                    <h3 className="flex items-center gap-2 truncate text-xl font-semibold text-gray-900 dark:text-white">
                        <FileText className="h-5 w-5 shrink-0 text-primary" />
                        {shellTitle}
                    </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {note?.providerSigned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm text-success">
                            <Signature className="h-4 w-4" />
                            Signed · {note.providerSigned}
                        </span>
                    ) : null}
                    <Link to={facesheetBase} className="btn btn-outline-primary btn-sm">
                        Back
                    </Link>
                </div>
            </header>

            {encounters.length === 0 && mode === 'create' ? (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    No active encounter for this patient. Admit the patient from ADT before creating a note.
                </div>
            ) : null}

            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Note Type</label>
                    <select className="form-select w-full" value={notesType} disabled>
                        <option value={PROGRESS_NOTE_TYPE}>{PROGRESS_NOTE_TYPE}</option>
                    </select>
                </div>
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Visit Date <span className="text-danger">*</span>
                    </label>
                    <input
                        type="date"
                        className="form-input w-full"
                        value={visitDate}
                        disabled={isReadOnly}
                        onBlur={() => markTouched('date')}
                        onChange={(e) => setVisitDate(e.target.value)}
                    />
                    {touched.date && errors.date ? <p className="mt-1 text-xs text-danger">{errors.date}</p> : null}
                </div>
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Assigned Provider <span className="text-danger">*</span>
                    </label>
                    <select
                        className="form-select w-full"
                        value={assignedProviderId}
                        disabled={isReadOnly}
                        onBlur={() => markTouched('assignedProvider')}
                        onChange={(e) => setAssignedProviderId(e.target.value)}
                    >
                        <option value="">Select provider</option>
                        {providers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    {touched.assignedProvider && errors.assignedProvider ? (
                        <p className="mt-1 text-xs text-danger">{errors.assignedProvider}</p>
                    ) : null}
                </div>
                <div className="md:col-span-3">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Encounter <span className="text-danger">*</span>
                    </label>
                    <select
                        className="form-select w-full"
                        value={encounterId}
                        disabled={isReadOnly || (mode !== 'create' && Boolean(note?.encounterId))}
                        onBlur={() => markTouched('encounterId')}
                        onChange={(e) => setEncounterId(e.target.value)}
                    >
                        <option value="">Select encounter</option>
                        {encounters.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.label}
                            </option>
                        ))}
                        {encounterId && !encounters.some((e) => e.id === encounterId) ? (
                            <option value={encounterId}>Current encounter · {encounterId.slice(0, 8)}</option>
                        ) : null}
                    </select>
                    {touched.encounterId && errors.encounterId ? (
                        <p className="mt-1 text-xs text-danger">{errors.encounterId}</p>
                    ) : null}
                </div>
            </div>

            <section className="panel mb-5 overflow-hidden p-0">
                <header className="flex flex-col gap-2 border-b border-white-light bg-white-light/40 px-4 py-3 dark:border-[#191e3a] dark:bg-[#0e1726] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            Final Clinical Note <span className="text-danger">*</span>
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">This is what gets signed and saved to the chart. Required.</p>
                    </div>
                </header>
                <div className="p-4">
                    <textarea
                        id="notesTextProgressNote"
                        className="form-textarea min-h-[280px] w-full resize-y text-sm leading-relaxed"
                        rows={14}
                        placeholder="Compose or paste the final clinical note here…"
                        value={notesText}
                        disabled={isReadOnly}
                        onBlur={() => markTouched('notesText')}
                        onChange={(e) => setNotesText(e.target.value)}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            {touched.notesText && errors.notesText ? (
                                <p className="text-xs text-danger">{errors.notesText}</p>
                            ) : (
                                <p className="text-xs text-gray-500">Minimum 5 characters.</p>
                            )}
                        </div>
                        <span className="text-xs tabular-nums text-gray-400">{notesText.length}</span>
                    </div>
                </div>
            </section>

            {note?.providerSigned ? (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>
                        Electronically signed by <strong>{note.providerSigned}</strong>
                        {note.signedDate ? ` on ${note.signedDate}` : ''}
                        {note.signedTime ? ` ${note.signedTime}` : ''}
                    </span>
                </div>
            ) : null}

            <footer className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-white-light bg-white/95 px-1 py-3 backdrop-blur dark:border-[#191e3a] dark:bg-[#0e1726]/95">
                <Link to={facesheetBase} className="btn btn-outline-dark">
                    Back
                </Link>
                {mode === 'view' && noteStatus !== 'Completed' && noteStatus !== 'Marked in Error' ? (
                    <button type="button" className="btn btn-outline-primary inline-flex items-center gap-1.5" onClick={() => setMode('edit')}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </button>
                ) : null}
                {canSign ? (
                    <button type="button" className="btn btn-primary inline-flex items-center gap-1.5" disabled={saving} onClick={handleSign}>
                        <Signature className="h-4 w-4" />
                        Sign
                    </button>
                ) : null}
                {(mode === 'create' || mode === 'edit') && noteStatus !== 'Completed' && noteStatus !== 'Marked in Error' ? (
                    <button
                        type="button"
                        className="btn btn-primary inline-flex items-center gap-1.5"
                        disabled={saving || (mode === 'create' && encounters.length === 0)}
                        onClick={handleSave}
                    >
                        <Save className="h-4 w-4" />
                        {mode === 'create' ? 'Create Note' : 'Update Note'}
                    </button>
                ) : null}
            </footer>
        </div>
    );
};

export default CreateProgressNotePage;
