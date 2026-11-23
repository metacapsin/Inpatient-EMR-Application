import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputTextarea } from 'primereact/inputtextarea';
import { CheckCircle2, FileText, Pencil, Save, Signature } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { FollowUpProgressFields } from '../../features/chart-notes/FollowUpProgressFields';
import { NeurologyHpFields } from '../../features/chart-notes/NeurologyHpFields';
import { NotesDateInput } from '../../features/chart-notes/NotesDateInput';
import { composeFollowUpNote } from '../../features/chart-notes/composeFollowUpNote';
import { composeNeurologyHpNote } from '../../features/chart-notes/composeNeurologyHpNote';
import {
    ClinicalFieldLabel,
    ClinicalNoteActionBar,
    ClinicalNoteSection,
    NoteFormSkeleton,
    NoteStatusTag,
    notesDropdownOptionTemplate,
    notesDropdownValueTemplate,
    syncOverlayWidth,
} from '../../features/chart-notes/notesUi';
import {
    emptyFollowUpProgressData,
    FOLLOW_UP_NOTE_TYPE,
    validateFollowUpProgress,
    type FollowUpProgressData,
} from '../../features/chart-notes/followUpProgress.types';
import {
    emptyNeurologyHpData,
    NEUROLOGY_HP_NOTE_TYPE,
    validateNeurologyHp,
    type NeurologyHpData,
} from '../../features/chart-notes/neurologyHp.types';
import {
    NOTE_TYPE_SHORT_LABEL,
    PHASE1_NOTE_TYPES,
    PROGRESS_NOTE_TYPE,
    createPatientChartNote,
    fetchActiveEncountersForPatient,
    fetchProviderOptions,
    getPatientChartNoteById,
    isPhase1NoteType,
    signPatientChartNote,
    updatePatientChartNote,
    type PatientChartNote,
    type Phase1NoteType,
} from '../../services/patientChartNotes.service';

function mergeFollowUpPayload(raw: unknown): FollowUpProgressData {
    const base = emptyFollowUpProgressData();
    if (!raw || typeof raw !== 'object') return base;
    const p = raw as Partial<FollowUpProgressData>;
    return {
        ...base,
        ...p,
        encounter: { ...base.encounter, ...(p.encounter || {}) },
        chiefComplaint: { ...base.chiefComplaint, ...(p.chiefComplaint || {}) },
        vitals: { ...base.vitals, ...(p.vitals || {}) },
        ros: { ...base.ros, ...(p.ros || {}) },
        physExam: { ...base.physExam, ...(p.physExam || {}) },
        assessmentPlan:
            Array.isArray(p.assessmentPlan) && p.assessmentPlan.length
                ? p.assessmentPlan.map((r) => ({
                      dx: r?.dx || '',
                      icd10: r?.icd10 || '',
                      plan: r?.plan || '',
                  }))
                : base.assessmentPlan,
    };
}

function mergeNeurologyPayload(raw: unknown): NeurologyHpData {
    const base = emptyNeurologyHpData();
    if (!raw || typeof raw !== 'object') return base;
    const p = raw as Partial<NeurologyHpData>;
    return {
        ...base,
        ...p,
        identifying: { ...base.identifying, ...(p.identifying || {}) },
        hpi: {
            ...base.hpi,
            ...(p.hpi || {}),
            neurologicSymptoms: {
                ...base.hpi.neurologicSymptoms,
                ...(p.hpi?.neurologicSymptoms || {}),
            },
        },
        pmh: { ...base.pmh, ...(p.pmh || {}) },
        psh: { ...base.psh, ...(p.psh || {}) },
        familyHistory: { ...base.familyHistory, ...(p.familyHistory || {}) },
        socialHistory: { ...base.socialHistory, ...(p.socialHistory || {}) },
        physicalExam: {
            ...base.physicalExam,
            ...(p.physicalExam || {}),
            vitalSigns: {
                ...base.physicalExam.vitalSigns,
                ...(p.physicalExam?.vitalSigns || {}),
            },
        },
        assessment: { ...base.assessment, ...(p.assessment || {}) },
        plan: { ...base.plan, ...(p.plan || {}) },
    };
}

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
    const typeFromQuery = searchParams.get('notesType') || '';
    const initialNotesType: Phase1NoteType =
        isPhase1NoteType(typeFromQuery) ? typeFromQuery : PROGRESS_NOTE_TYPE;
    const [mode, setMode] = useState<Mode>(initialMode);
    const [loading, setLoading] = useState(Boolean(noteId));
    const [saving, setSaving] = useState(false);
    const [note, setNote] = useState<PatientChartNote | null>(null);

    const [notesType, setNotesType] = useState<Phase1NoteType>(initialNotesType);
    const [encounterId, setEncounterId] = useState('');
    const [visitDate, setVisitDate] = useState(toInputDate());
    const [assignedProviderId, setAssignedProviderId] = useState('');
    const [notesText, setNotesText] = useState('');
    const [followUpData, setFollowUpData] = useState<FollowUpProgressData>(emptyFollowUpProgressData);
    const [neurologyData, setNeurologyData] = useState<NeurologyHpData>(emptyNeurologyHpData);
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
    const [encounters, setEncounters] = useState<Array<{ id: string; label: string }>>([]);

    const noteTypeDdRef = useRef<Dropdown>(null);
    const providerDdRef = useRef<Dropdown>(null);
    const encounterDdRef = useRef<Dropdown>(null);

    const onDropdownShow = (ref: React.RefObject<Dropdown | null>, panelClass: string) => () => {
        syncOverlayWidth(ref.current?.getElement?.() ?? null, `.${panelClass}`, '--notes-dd-w');
    };

    const facesheetBase = patientId ? `/app/facesheet/${encodeURIComponent(patientId)}/notes` : '/app/notes';
    const isReadOnly = mode === 'view' || note?.noteStatus === 'Completed' || note?.noteStatus === 'Marked in Error';
    const isFollowUp = notesType === FOLLOW_UP_NOTE_TYPE;
    const isNeurology = notesType === NEUROLOGY_HP_NOTE_TYPE;
    const isStructured = isFollowUp || isNeurology;
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

    const composedStructured = useMemo(() => {
        if (isFollowUp) return composeFollowUpNote(followUpData);
        if (isNeurology) return composeNeurologyHpNote(neurologyData);
        return '';
    }, [isFollowUp, isNeurology, followUpData, neurologyData]);

    const errors = useMemo(() => {
        const e: Record<string, string> = {};
        if (!encounterId) e.encounterId = 'Encounter is required.';
        if (!visitDate) e.date = 'Visit Date is required.';
        if (!assignedProviderId) e.assignedProvider = 'Assigned Provider is required.';
        if (isFollowUp) {
            Object.assign(e, validateFollowUpProgress(followUpData));
            if (!composedStructured.trim() || composedStructured.trim().length < 5) {
                e.notesText = 'Complete the structured sections so the clinical note can be composed.';
            }
        } else if (isNeurology) {
            Object.assign(e, validateNeurologyHp(neurologyData));
            if (!composedStructured.trim() || composedStructured.trim().length < 5) {
                e.notesText = 'Complete the structured sections so the clinical note can be composed.';
            }
        } else if (!notesText.trim()) {
            e.notesText = 'Notes text is required.';
        } else if (notesText.trim().length < 5) {
            e.notesText = 'Input should be more than 5 characters.';
        }
        return e;
    }, [
        encounterId,
        visitDate,
        assignedProviderId,
        notesText,
        isFollowUp,
        isNeurology,
        followUpData,
        neurologyData,
        composedStructured,
    ]);

    const shortLabel = NOTE_TYPE_SHORT_LABEL[notesType] || 'Note';
    const shellTitle =
        mode === 'create' ? `New ${shortLabel}` : mode === 'edit' ? `Edit ${shortLabel}` : `View ${shortLabel}`;

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
            if (isPhase1NoteType(n.notesType)) setNotesType(n.notesType);
            setEncounterId(n.encounterId || '');
            setVisitDate(toInputDate(n.date));
            setAssignedProviderId(n.assignedProvider?.id || n.assignedProvider?._id || '');
            setNotesText(n.notesText || '');
            if (n.notesType === FOLLOW_UP_NOTE_TYPE) {
                setFollowUpData(mergeFollowUpPayload(n.structuredPayload));
            }
            if (n.notesType === NEUROLOGY_HP_NOTE_TYPE) {
                setNeurologyData(mergeNeurologyPayload(n.structuredPayload));
            }
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
        const text = isStructured ? composedStructured.trim() : notesText.trim();
        let structuredPayload: Record<string, unknown> | null = null;
        if (isFollowUp) structuredPayload = followUpData as unknown as Record<string, unknown>;
        if (isNeurology) structuredPayload = neurologyData as unknown as Record<string, unknown>;
        return {
            patientId: patientId!,
            encounterId,
            notesType,
            notesText: text,
            structuredPayload,
            date: visitDate,
            assignedProviderId,
            assignedProviderName: provider?.name || userName,
        };
    };

    const handleSave = async () => {
        setTouched({
            encounterId: true,
            date: true,
            assignedProvider: true,
            notesText: true,
            cptCode: true,
            chiefComplaint: true,
            bp: true,
            hr: true,
            ros: true,
            assessmentPlan: true,
        });
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
            setTouched({
                encounterId: true,
                date: true,
                assignedProvider: true,
                notesText: true,
                cptCode: true,
                chiefComplaint: true,
                bp: true,
                hr: true,
                ros: true,
                assessmentPlan: true,
            });
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

    const noteTypeOptions = useMemo(() => PHASE1_NOTE_TYPES.map((t) => ({ label: t, value: t })), []);
    const providerOptions = useMemo(
        () => [{ label: 'Select provider', value: '' }, ...providers.map((p) => ({ label: p.name, value: p.id }))],
        [providers],
    );
    const encounterOptions = useMemo(() => {
        const opts = [{ label: 'Select encounter', value: '' }, ...encounters.map((e) => ({ label: e.label, value: e.id }))];
        if (encounterId && !encounters.some((e) => e.id === encounterId)) {
            opts.push({ label: `Current encounter · ${encounterId.slice(0, 8)}`, value: encounterId });
        }
        return opts;
    }, [encounters, encounterId]);

    if (!patientId) {
        return (
            <div className={moduleSurfaceClass}>
                <p className="text-sm text-gray-600 dark:text-gray-300">Open Notes from a patient facesheet to create documentation.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`${moduleSurfaceClass} notes-module w-full min-w-0`}>
                <NoteFormSkeleton />
            </div>
        );
    }

    return (
        <div className={`${moduleSurfaceClass} notes-module w-full min-w-0`}>
            <header className="mb-5 flex flex-col gap-3 border-b border-emr-border/80 pb-4 pr-1 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <Link to={facesheetBase} className="text-primary hover:underline">
                            Clinical Notes
                        </Link>
                        <span aria-hidden>/</span>
                        <span className="font-medium text-gray-900 dark:text-white">{shellTitle}</span>
                        <NoteStatusTag status={noteStatus} />
                    </nav>
                    <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        {shellTitle}
                    </h1>
                </div>
                <div className="notes-header-actions flex flex-wrap items-center gap-2">
                    {note?.providerSigned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm text-success">
                            <Signature className="h-4 w-4" aria-hidden />
                            Signed · {note.providerSigned}
                        </span>
                    ) : null}
                    <Link to={facesheetBase} className="inline-flex">
                        <Button type="button" label="Back" outlined size="small" className="notes-action-btn" />
                    </Link>
                </div>
            </header>

            {encounters.length === 0 && mode === 'create' ? (
                <div
                    className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                    role="status"
                >
                    No active encounter for this patient. Admit the patient from ADT before creating a note.
                </div>
            ) : null}

            <ClinicalNoteSection title="Visit metadata">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="min-w-0">
                        <ClinicalFieldLabel>Note Type</ClinicalFieldLabel>
                        <Dropdown
                            ref={noteTypeDdRef}
                            value={notesType}
                            options={noteTypeOptions}
                            disabled={mode !== 'create'}
                            className="w-full"
                            panelClassName="notes-dd-panel notes-dd-panel-note-type"
                            appendTo={typeof document !== 'undefined' ? document.body : undefined}
                            itemTemplate={notesDropdownOptionTemplate}
                            valueTemplate={notesDropdownValueTemplate}
                            onShow={onDropdownShow(noteTypeDdRef, 'notes-dd-panel-note-type')}
                            onChange={(e) => {
                                const next = e.value as string;
                                if (isPhase1NoteType(next)) {
                                    setNotesType(next);
                                    if (next === FOLLOW_UP_NOTE_TYPE) setFollowUpData(emptyFollowUpProgressData());
                                    if (next === NEUROLOGY_HP_NOTE_TYPE) setNeurologyData(emptyNeurologyHpData());
                                }
                            }}
                        />
                    </div>
                    <div className="min-w-0">
                        <ClinicalFieldLabel required>Visit Date</ClinicalFieldLabel>
                        <NotesDateInput
                            id="notes-visit-date"
                            value={visitDate}
                            disabled={isReadOnly}
                            onChange={setVisitDate}
                            onBlur={() => markTouched('date')}
                        />
                        {touched.date && errors.date ? <p className="mt-1 text-xs text-danger">{errors.date}</p> : null}
                    </div>
                    <div className="min-w-0">
                        <ClinicalFieldLabel required>Assigned Provider</ClinicalFieldLabel>
                        <Dropdown
                            ref={providerDdRef}
                            value={assignedProviderId}
                            options={providerOptions}
                            disabled={isReadOnly}
                            className="w-full"
                            panelClassName="notes-dd-panel notes-dd-panel-assigned"
                            appendTo={typeof document !== 'undefined' ? document.body : undefined}
                            filter
                            filterPlaceholder="Search provider"
                            itemTemplate={notesDropdownOptionTemplate}
                            valueTemplate={notesDropdownValueTemplate}
                            onShow={onDropdownShow(providerDdRef, 'notes-dd-panel-assigned')}
                            onChange={(e) => {
                                setAssignedProviderId(e.value || '');
                                markTouched('assignedProvider');
                            }}
                        />
                        {touched.assignedProvider && errors.assignedProvider ? (
                            <p className="mt-1 text-xs text-danger">{errors.assignedProvider}</p>
                        ) : null}
                    </div>
                    <div className="min-w-0 md:col-span-3">
                        <ClinicalFieldLabel required>Encounter</ClinicalFieldLabel>
                        <Dropdown
                            ref={encounterDdRef}
                            value={encounterId}
                            options={encounterOptions}
                            disabled={isReadOnly || (mode !== 'create' && Boolean(note?.encounterId))}
                            className="w-full"
                            panelClassName="notes-dd-panel notes-dd-panel-encounter"
                            appendTo={typeof document !== 'undefined' ? document.body : undefined}
                            itemTemplate={notesDropdownOptionTemplate}
                            valueTemplate={notesDropdownValueTemplate}
                            onShow={onDropdownShow(encounterDdRef, 'notes-dd-panel-encounter')}
                            onChange={(e) => {
                                setEncounterId(e.value || '');
                                markTouched('encounterId');
                            }}
                        />
                        {touched.encounterId && errors.encounterId ? (
                            <p className="mt-1 text-xs text-danger">{errors.encounterId}</p>
                        ) : null}
                    </div>
                </div>
            </ClinicalNoteSection>

            {isFollowUp ? (
                <FollowUpProgressFields
                    value={followUpData}
                    onChange={setFollowUpData}
                    readOnly={isReadOnly}
                    errors={touched.notesText || Object.keys(touched).length ? errors : {}}
                />
            ) : null}

            {isNeurology ? (
                <NeurologyHpFields
                    value={neurologyData}
                    onChange={setNeurologyData}
                    readOnly={isReadOnly}
                    errors={touched.notesText || Object.keys(touched).length ? errors : {}}
                />
            ) : null}

            <ClinicalNoteSection title="Final Clinical Note *">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isStructured
                        ? 'Auto-composed from the structured sections above. This is what gets signed.'
                        : 'This is what gets signed and saved to the chart. Required.'}
                </p>
                <InputTextarea
                    id="notesTextChartNote"
                    className="notes-final-note-textarea w-full text-sm leading-relaxed"
                    rows={22}
                    placeholder={
                        isStructured
                            ? 'Fill the structured sections — the narrative appears here…'
                            : 'Compose or paste the final clinical note here…'
                    }
                    value={isStructured ? composedStructured : notesText}
                    disabled={isReadOnly || isStructured}
                    onBlur={() => markTouched('notesText')}
                    onChange={(e) => setNotesText(e.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        {touched.notesText && errors.notesText ? (
                            <p className="text-xs text-danger">{errors.notesText}</p>
                        ) : (
                            <p className="text-xs text-gray-500">
                                {isStructured ? 'Narrative updates as you fill sections.' : 'Minimum 5 characters.'}
                            </p>
                        )}
                    </div>
                    <span className="text-xs tabular-nums text-gray-400">
                        {(isStructured ? composedStructured : notesText).length}
                    </span>
                </div>
            </ClinicalNoteSection>

            {note?.providerSigned ? (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span>
                        Electronically signed by <strong>{note.providerSigned}</strong>
                        {note.signedDate ? ` on ${note.signedDate}` : ''}
                        {note.signedTime ? ` ${note.signedTime}` : ''}
                    </span>
                </div>
            ) : null}

            <ClinicalNoteActionBar>
                <Link to={facesheetBase}>
                    <Button type="button" label="Back" outlined />
                </Link>
                {mode === 'view' && noteStatus !== 'Completed' && noteStatus !== 'Marked in Error' ? (
                    <Button
                        type="button"
                        label="Edit"
                        outlined
                        icon={<Pencil className="mr-1.5 h-4 w-4" />}
                        onClick={() => setMode('edit')}
                    />
                ) : null}
                {canSign ? (
                    <Button
                        type="button"
                        label="Sign"
                        icon={<Signature className="mr-1.5 h-4 w-4" />}
                        disabled={saving}
                        loading={saving}
                        onClick={handleSign}
                    />
                ) : null}
                {(mode === 'create' || mode === 'edit') && noteStatus !== 'Completed' && noteStatus !== 'Marked in Error' ? (
                    <Button
                        type="button"
                        label={mode === 'create' ? 'Create Note' : 'Update Note'}
                        icon={<Save className="mr-1.5 h-4 w-4" />}
                        disabled={saving || (mode === 'create' && encounters.length === 0)}
                        loading={saving}
                        onClick={handleSave}
                    />
                ) : null}
            </ClinicalNoteActionBar>
        </div>
    );
};

export default CreateProgressNotePage;
