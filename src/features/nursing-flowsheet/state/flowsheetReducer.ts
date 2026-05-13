import type {
    FlowsheetAction,
    FlowsheetRuntimeState,
    FlowsheetUiState,
    NursingFlowsheetDocument,
    NursingFlowsheetPatch,
} from '../types/nursingFlowsheet.types';

const defaultUi: FlowsheetUiState = {
    activeAccordionIndices: [0, 1, 2],
    historyDrawerVisible: false,
    reassessmentBannerDismissed: false,
    serverClockSkewMs: 0,
};

function chartIsLocked(doc: NursingFlowsheetDocument): boolean {
    return doc.chartStatus === 'signed';
}

function mergeDocument(prev: NursingFlowsheetDocument, patch: NursingFlowsheetPatch): NursingFlowsheetDocument {
    const next: NursingFlowsheetDocument = {
        ...prev,
        ...patch,
        shiftInfo: patch.shiftInfo ? { ...prev.shiftInfo, ...patch.shiftInfo } : prev.shiftInfo,
        neurological: patch.neurological ? { ...prev.neurological, ...patch.neurological } : prev.neurological,
        cardiovascular: patch.cardiovascular
            ? { ...prev.cardiovascular, ...patch.cardiovascular }
            : prev.cardiovascular,
        respiratory: patch.respiratory ? { ...prev.respiratory, ...patch.respiratory } : prev.respiratory,
        gastrointestinal: patch.gastrointestinal
            ? { ...prev.gastrointestinal, ...patch.gastrointestinal }
            : prev.gastrointestinal,
        genitourinary: patch.genitourinary ? { ...prev.genitourinary, ...patch.genitourinary } : prev.genitourinary,
        integumentary: patch.integumentary ? { ...prev.integumentary, ...patch.integumentary } : prev.integumentary,
        pain: patch.pain ? { ...prev.pain, ...patch.pain } : prev.pain,
        musculoskeletal: patch.musculoskeletal
            ? { ...prev.musculoskeletal, ...patch.musculoskeletal }
            : prev.musculoskeletal,
        psychosocial: patch.psychosocial ? { ...prev.psychosocial, ...patch.psychosocial } : prev.psychosocial,
        ivAccess: patch.ivAccess ?? prev.ivAccess,
    };
    return next;
}

export function createFlowsheetReducer(initialDoc: NursingFlowsheetDocument) {
    const initial: FlowsheetRuntimeState = {
        document: initialDoc,
        ui: { ...defaultUi },
        save: {
            status: 'saved',
            lastError: null,
            lastSavedAtIso: initialDoc.updatedAtIso,
            pendingSinceIso: null,
        },
        validationErrors: {},
        isLoading: false,
        loadError: null,
        versions: [],
        auditTrail: [],
    };

    function reducer(state: FlowsheetRuntimeState, action: FlowsheetAction): FlowsheetRuntimeState {
        switch (action.type) {
            case 'HYDRATE':
                return { ...state, ...action.payload, document: action.payload.document ?? state.document };
            case 'SET_LOADING':
                return { ...state, isLoading: action.payload };
            case 'SET_LOAD_ERROR':
                return { ...state, loadError: action.payload };
            case 'PATCH_DOCUMENT': {
                const nextDoc: NursingFlowsheetDocument = {
                    ...mergeDocument(state.document, action.payload),
                    updatedAtIso: new Date().toISOString(),
                };
                return {
                    ...state,
                    document: nextDoc,
                    save: {
                        ...state.save,
                        status: chartIsLocked(state.document) ? state.save.status : 'dirty',
                        pendingSinceIso: state.save.pendingSinceIso ?? new Date().toISOString(),
                    },
                };
            }
            case 'REPLACE_IV_LINES':
                return {
                    ...state,
                    document: {
                        ...state.document,
                        ivAccess: action.payload,
                        updatedAtIso: new Date().toISOString(),
                    },
                    save: {
                        ...state.save,
                        status: chartIsLocked(state.document) ? state.save.status : 'dirty',
                        pendingSinceIso: state.save.pendingSinceIso ?? new Date().toISOString(),
                    },
                };
            case 'SET_CHART_STATUS':
                return {
                    ...state,
                    document: {
                        ...state.document,
                        chartStatus: action.payload,
                        updatedAtIso: new Date().toISOString(),
                    },
                };
            case 'SET_SAVE':
                return { ...state, save: { ...state.save, ...action.payload } };
            case 'SET_VALIDATION':
                return { ...state, validationErrors: action.payload };
            case 'CLEAR_FIELD_ERROR': {
                const { [action.payload]: _, ...rest } = state.validationErrors;
                return { ...state, validationErrors: rest };
            }
            case 'SET_UI':
                return { ...state, ui: { ...state.ui, ...action.payload } };
            case 'BUMP_VERSION':
                return {
                    ...state,
                    document: {
                        ...state.document,
                        version: state.document.version + 1,
                        updatedAtIso: new Date().toISOString(),
                    },
                };
            case 'APPLY_SIGNED':
                return {
                    ...state,
                    document: {
                        ...state.document,
                        chartStatus: 'signed',
                        signedAt: action.payload.signedAt,
                        signedByName: action.payload.signedByName,
                        signedBy: action.payload.signedBy,
                        attestationAccepted: true,
                        amendmentReason: '',
                        updatedAtIso: new Date().toISOString(),
                    },
                };
            case 'ADD_AUDIT':
                return { ...state, auditTrail: [action.payload, ...state.auditTrail] };
            case 'ADD_VERSION':
                return { ...state, versions: [action.payload, ...state.versions] };
            default:
                return state;
        }
    }

    return { initial, reducer };
}
