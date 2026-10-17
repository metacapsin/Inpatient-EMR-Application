import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type ReactNode,
} from 'react';
import type { Toast } from 'primereact/toast';
import { createFlowsheetReducer } from './flowsheetReducer';
import type {
    FlowsheetAction,
    FlowsheetRuntimeState,
    IvAccessLine,
    NursingFlowsheetDocument,
    NursingFlowsheetPatch,
} from '../types/nursingFlowsheet.types';
import { flowsheetDraftStorageKey, removeDraftFromStorage, writeDraftToStorage } from '../utils/draftStorage';
import { validateAmendmentReason, validateFlowsheetForSign } from '../validation/flowsheetValidation';
import { MOCK_AUDIT, MOCK_VERSIONS } from '../data/mockNursingFlowsheet';
import { toNursingFlowsheetApiPayload } from '../types/nursingFlowsheet.types';
import { saveNursingFlowsheet } from '../../../services/nursingFlowsheet.service';

interface NursingFlowsheetContextValue {
    state: FlowsheetRuntimeState;
    dispatch: React.Dispatch<FlowsheetAction>;
    patchDocument: (p: NursingFlowsheetPatch) => void;
    replaceIvLines: (lines: IvAccessLine[]) => void;
    requestAutosave: () => void;
    /** Immediate persist (footer Save now / floating save). */
    persistDraftNow: () => void;
    signDocument: (signerDisplay: string) => boolean;
    beginAmendment: (reason: string) => string | null;
    cancelAmendment: () => void;
    openHistory: () => void;
    closeHistory: () => void;
    toastRef: React.RefObject<Toast | null>;
    isChartLocked: boolean;
}

const NursingFlowsheetContext = createContext<NursingFlowsheetContextValue | null>(null);

interface ProviderProps {
    children: ReactNode;
    initialDocument: NursingFlowsheetDocument;
}

export function NursingFlowsheetProvider({ children, initialDocument }: ProviderProps) {
    const { initial, reducer } = useMemo(() => createFlowsheetReducer(initialDocument), [initialDocument]);
    const [state, dispatch] = useReducer(reducer, initial, (base) => ({
        ...base,
        versions: MOCK_VERSIONS,
        auditTrail: MOCK_AUDIT,
    }));

    const toastRef = useRef<Toast | null>(null);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveInFlight = useRef(false);
    const documentRef = useRef(state.document);
    documentRef.current = state.document;
    const draftKey = flowsheetDraftStorageKey(state.document);

    const isChartLocked = state.document.chartStatus === 'signed';

    const patchDocument = useCallback(
        (p: NursingFlowsheetPatch) => {
            if (isChartLocked) {
                toastRef.current?.show({
                    severity: 'warn',
                    summary: 'Chart locked',
                    detail: 'Open an amendment to edit a signed document.',
                    life: 3500,
                });
                return;
            }
            dispatch({ type: 'PATCH_DOCUMENT', payload: p });
        },
        [isChartLocked]
    );

    const replaceIvLines = useCallback(
        (lines: IvAccessLine[]) => {
            if (isChartLocked) return;
            dispatch({ type: 'REPLACE_IV_LINES', payload: lines });
        },
        [isChartLocked]
    );

    const flushAutosave = useCallback(() => {
        if (saveInFlight.current) return;
        saveInFlight.current = true;
        dispatch({ type: 'SET_SAVE', payload: { status: 'saving', lastError: null } });
        const doc = documentRef.current;
        const key = flowsheetDraftStorageKey(doc);
        void (async () => {
            try {
                await saveNursingFlowsheet(toNursingFlowsheetApiPayload(doc));
                try {
                    writeDraftToStorage(key, JSON.stringify(doc));
                } catch {
                    /* local backup optional */
                }
                const savedAt = new Date().toISOString();
                dispatch({
                    type: 'SET_SAVE',
                    payload: {
                        status: 'saved',
                        lastSavedAtIso: savedAt,
                        pendingSinceIso: null,
                    },
                });
                dispatch({
                    type: 'ADD_AUDIT',
                    payload: {
                        id: `a-${Date.now()}`,
                        atIso: savedAt,
                        actorDisplay: doc.shiftInfo.primaryNurseDisplay || 'Unknown user',
                        action: 'AUTOSAVE',
                        detail: 'POST /api/NursingFlowsheet/save',
                    },
                });
                toastRef.current?.show({
                    severity: 'success',
                    summary: 'Saved',
                    detail: 'Flowsheet synced to server.',
                    life: 1800,
                });
            } catch {
                try {
                    writeDraftToStorage(key, JSON.stringify(doc));
                } catch {
                    /* ignore */
                }
                dispatch({
                    type: 'SET_SAVE',
                    payload: { status: 'error', lastError: 'Server save failed; draft kept locally.', pendingSinceIso: null },
                });
                toastRef.current?.show({
                    severity: 'warn',
                    summary: 'Offline / server error',
                    detail: 'Could not reach the API. Draft was saved in this browser only.',
                    life: 5000,
                });
            } finally {
                saveInFlight.current = false;
            }
        })();
    }, []);

    const requestAutosave = useCallback(() => {
        if (isChartLocked) return;
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
            flushAutosave();
        }, 900);
    }, [flushAutosave, isChartLocked]);

    const persistDraftNow = useCallback(() => {
        if (isChartLocked) return;
        if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = null;
        }
        flushAutosave();
    }, [flushAutosave, isChartLocked]);

    useEffect(() => {
        if (isChartLocked) return;
        if (state.save.status !== 'dirty') return;
        requestAutosave();
        return () => {
            if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        };
    }, [isChartLocked, requestAutosave, state.document.updatedAtIso, state.save.status]);

    const signDocument = useCallback(
        (signerDisplay: string) => {
            const errs = validateFlowsheetForSign(state.document);
            dispatch({ type: 'SET_VALIDATION', payload: errs });
            if (Object.keys(errs).length) {
                toastRef.current?.show({
                    severity: 'error',
                    summary: 'Cannot sign',
                    detail: 'Fix validation errors in highlighted fields.',
                    life: 5000,
                });
                return false;
            }
            const iso = new Date().toISOString();
            const signedBy = state.document.shiftInfo.primaryNurseId.trim() || 'unknown-rn';
            dispatch({
                type: 'APPLY_SIGNED',
                payload: {
                    signedAt: iso,
                    signedByName: signerDisplay.trim() || state.document.shiftInfo.primaryNurseDisplay,
                    signedBy,
                },
            });
            dispatch({ type: 'BUMP_VERSION' });
            dispatch({
                type: 'ADD_VERSION',
                payload: {
                    id: `v-${Date.now()}`,
                    version: state.document.version + 1,
                    status: 'signed',
                    savedAtIso: iso,
                    savedByDisplay: signerDisplay,
                    summary: 'Signed head-to-toe assessment',
                },
            });
            dispatch({
                type: 'ADD_AUDIT',
                payload: {
                    id: `a-${Date.now()}`,
                    atIso: iso,
                    actorDisplay: signerDisplay,
                    action: 'SIGN',
                    detail: `Version ${state.document.version + 1} locked`,
                },
            });
            removeDraftFromStorage(draftKey);
            dispatch({
                type: 'SET_SAVE',
                payload: { status: 'saved', lastSavedAtIso: iso, lastError: null, pendingSinceIso: null },
            });
            const nextVersion = state.document.version + 1;
            const signedDoc: NursingFlowsheetDocument = {
                ...state.document,
                chartStatus: 'signed',
                signedAt: iso,
                signedByName: signerDisplay.trim() || state.document.shiftInfo.primaryNurseDisplay,
                signedBy,
                attestationAccepted: true,
                amendmentReason: '',
                version: nextVersion,
                updatedAtIso: iso,
            };
            void saveNursingFlowsheet(toNursingFlowsheetApiPayload(signedDoc)).catch(() => {
                toastRef.current?.show({
                    severity: 'warn',
                    summary: 'Signed locally',
                    detail: 'Server did not confirm the signed chart. Retry save when online.',
                    life: 5000,
                });
            });
            toastRef.current?.show({ severity: 'success', summary: 'Signed', detail: 'Document locked.', life: 3000 });
            return true;
        },
        [draftKey, state.document, state.document.version]
    );

    const beginAmendment = useCallback(
        (reason: string) => {
            const err = validateAmendmentReason(reason);
            if (err) return err;
            if (state.document.chartStatus !== 'signed') {
                toastRef.current?.show({
                    severity: 'warn',
                    summary: 'Amendment',
                    detail: 'Only a signed document can be amended.',
                    life: 3500,
                });
                return 'Document is not signed.';
            }
            dispatch({
                type: 'PATCH_DOCUMENT',
                payload: { chartStatus: 'amending', amendmentReason: reason.trim() },
            });
            dispatch({
                type: 'ADD_AUDIT',
                payload: {
                    id: `a-${Date.now()}`,
                    atIso: new Date().toISOString(),
                    actorDisplay: state.document.shiftInfo.primaryNurseDisplay || 'Unknown user',
                    action: 'AMENDMENT_OPEN',
                    detail: reason.trim(),
                },
            });
            toastRef.current?.show({
                severity: 'info',
                summary: 'Amendment mode',
                detail: 'Edits will append to the legal record with reason captured.',
                life: 4000,
            });
            return null;
        },
        [state.document.shiftInfo.primaryNurseDisplay, state.document.chartStatus]
    );

    const cancelAmendment = useCallback(() => {
        dispatch({ type: 'PATCH_DOCUMENT', payload: { chartStatus: 'signed', amendmentReason: '' } });
    }, []);

    const openHistory = useCallback(() => {
        dispatch({ type: 'SET_UI', payload: { historyDrawerVisible: true } });
    }, []);

    const closeHistory = useCallback(() => {
        dispatch({ type: 'SET_UI', payload: { historyDrawerVisible: false } });
    }, []);

    const value = useMemo<NursingFlowsheetContextValue>(
        () => ({
            state,
            dispatch,
            patchDocument,
            replaceIvLines,
            requestAutosave,
            persistDraftNow,
            signDocument,
            beginAmendment,
            cancelAmendment,
            openHistory,
            closeHistory,
            toastRef,
            isChartLocked,
        }),
        [
            state,
            patchDocument,
            replaceIvLines,
            requestAutosave,
            persistDraftNow,
            signDocument,
            beginAmendment,
            cancelAmendment,
            openHistory,
            closeHistory,
            isChartLocked,
        ]
    );

    return <NursingFlowsheetContext.Provider value={value}>{children}</NursingFlowsheetContext.Provider>;
}

export function useNursingFlowsheet(): NursingFlowsheetContextValue {
    const ctx = useContext(NursingFlowsheetContext);
    if (!ctx) throw new Error('useNursingFlowsheet must be used within NursingFlowsheetProvider');
    return ctx;
}
