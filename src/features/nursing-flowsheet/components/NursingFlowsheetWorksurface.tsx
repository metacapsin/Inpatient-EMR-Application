import { lazy, Suspense, useCallback, useState } from 'react';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { Slider } from 'primereact/slider';
import { Tag } from 'primereact/tag';
import type { FacesheetPatient } from '../../../services/patient.service';
import NewDropdown from '../../../components/ui/NewDropdown';
import {
    ABDOMEN_APPEARANCE_OPTIONS,
    BEHAVIOR_OPTIONS,
    BOWEL_SOUND_OPTIONS,
    CAPILLARY_REFILL_OPTIONS,
    DIET_TOLERANCE_OPTIONS,
    EDEMA_DISTRIBUTION_OPTIONS,
    EDEMA_GRADE_OPTIONS,
    GAIT_OPTIONS,
    HEART_RHYTHM_OPTIONS,
    MOBILITY_STATUS_OPTIONS,
    MOOD_AFFECT_OPTIONS,
    PAIN_QUALITY_OPTIONS,
    PATIENT_EDUCATION_OPTIONS,
    PERIPHERAL_PULSE_GRADE_OPTIONS,
    SAFETY_RISK_OPTIONS,
    SHIFT_TYPE_OPTIONS,
    SKIN_COLOR_OPTIONS,
    SKIN_TEMPERATURE_OPTIONS,
    SKIN_TURGOR_OPTIONS,
    URINE_COLOR_OPTIONS,
} from '../constants/clinicalOptions';
import { ClinicalField } from '../components/ClinicalField';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedInputNumber,
    FlowsheetOutlinedMultiSelect,
    FlowsheetOutlinedTextInput,
    NFS_OPTION_ACTIVE_CLASS,
    NFS_OPTION_BASE_CLASS,
    NFS_OPTION_IDLE_CLASS,
    NFS_FLOAT_FIELD_LABEL,
    NFS_SECTION_GRID_CLASS,
    NFS_RADIO_INDICATOR_ACTIVE,
    NFS_RADIO_INDICATOR_BASE,
    NFS_RADIO_INDICATOR_IDLE,
    reassessmentDueFromPriority,
} from '../components/FlowsheetStyledFields';
import { FlowsheetAmendDialog, FlowsheetCancelAmendButton } from '../components/FlowsheetAmendDialog';
import { FlowsheetHistorySidebar } from '../components/FlowsheetHistorySidebar';
import { FlowsheetModuleChrome } from '../components/FlowsheetModuleChrome';
import { IvAccessTable } from '../components/IvAccessTable';
import { fieldClinicalSeverity } from '../utils/clinicalSeverity';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';
import { useNursingFlowsheetKeyboard } from '../hooks/useNursingFlowsheetKeyboard';

const NeurologicalSection = lazy(() => import('../sections/NeurologicalSection'));
const RespiratorySection = lazy(() => import('../sections/RespiratorySection'));

function parseIsoDateOnly(ymd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

function formatIsoDateOnly(dt: Date): string {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
}

function PanelFallback() {
    return (
        <div className="flex flex-col gap-2 py-2">
            <Skeleton height="1.75rem" className="!bg-gray-100 dark:!bg-white/10" />
            <Skeleton height="1.75rem" className="!bg-gray-100 dark:!bg-white/10" />
            <Skeleton height="1.75rem" className="!bg-gray-100 dark:!bg-white/10" />
        </div>
    );
}

export interface NursingFlowsheetWorksurfaceProps {
    patient: FacesheetPatient | null;
    encounterId: string;
    loadingPatient?: boolean;
}

export function NursingFlowsheetWorksurface({ patient, encounterId, loadingPatient }: NursingFlowsheetWorksurfaceProps) {
    const { state, dispatch, patchDocument, persistDraftNow, signDocument, openHistory, isChartLocked } = useNursingFlowsheet();
    const d = state.document;
    const err = state.validationErrors;
    const [amendOpen, setAmendOpen] = useState(false);
    const [shiftDialog, setShiftDialog] = useState(false);
    const [encDialog, setEncDialog] = useState(false);
    const [signOpen, setSignOpen] = useState(false);
    const [signConfirmOpen, setSignConfirmOpen] = useState(false);
    const [signerName, setSignerName] = useState(d.shiftInfo.primaryNurseDisplay || '');

    const onFocusSection = useCallback(
        (index: number) => {
            dispatch({ type: 'SET_UI', payload: { activeAccordionIndices: [index] } });
            const el = document.getElementById(`nfs-acc-header-${index}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        [dispatch]
    );

    const toggleHistory = useCallback(() => {
        dispatch({ type: 'SET_UI', payload: { historyDrawerVisible: !state.ui.historyDrawerVisible } });
    }, [dispatch, state.ui.historyDrawerVisible]);

    useNursingFlowsheetKeyboard({
        onSaveNow: persistDraftNow,
        onToggleHistory: toggleHistory,
        onFocusSection,
    });

    const activeIdx = state.ui.activeAccordionIndices;

    const onAccordionChange = useCallback(
        (e: { index: number | number[] }) => {
            const next = Array.isArray(e.index) ? e.index : [e.index];
            dispatch({ type: 'SET_UI', payload: { activeAccordionIndices: next } });
        },
        [dispatch]
    );

    const sev = useCallback((path: string) => fieldClinicalSeverity(path, d), [d]);

    const header = (title: string, idx: number) => (
        <div className="flex w-full items-center gap-2 pr-1" id={`nfs-acc-header-${idx}`}>
            <span className="truncate text-left text-[13px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
                {title}
            </span>
        </div>
    );

    const showEdemaGrade = d.cardiovascular.edemaDistribution === 'Bilateral' || d.cardiovascular.edemaDistribution === 'Unilateral';

    const painScore = d.pain.intensity0to10 ?? 0;
    const painSliderClass =
        painScore >= 7 ? 'nfs-pain-slider-critical' : painScore >= 4 ? 'nfs-pain-slider-warn' : 'nfs-pain-slider-ok';

    const openSignReview = () => {
        setSignOpen(false);
        setSignConfirmOpen(true);
    };

    const cancelSignConfirm = () => {
        setSignConfirmOpen(false);
        setSignOpen(true);
    };

    const confirmSignAndLock = () => {
        const ok = signDocument(signerName.trim() || d.shiftInfo.primaryNurseDisplay);
        if (ok) {
            setSignConfirmOpen(false);
        } else {
            setSignConfirmOpen(false);
            setSignOpen(true);
        }
    };

    return (
        <div
            className="nursing-flowsheet-root flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50/80 text-gray-900 dark:bg-black/20 dark:text-gray-100"
            data-nursing-flowsheet-surface="true"
        >
            <FlowsheetModuleChrome
                patient={patient}
                encounterId={encounterId}
                loading={loadingPatient}
                onOpenShiftSwitch={() => setShiftDialog(true)}
                onOpenEncounterSwitch={() => setEncDialog(true)}
            />

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-16 [scrollbar-width:thin]">
                <div className="mx-auto max-w-[1920px] px-2 py-2 lg:px-3">
                    <Accordion multiple activeIndex={activeIdx} onTabChange={onAccordionChange} className="!border-0 !bg-transparent">
                        <AccordionTab header={header('A · Shift info', 0)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-3 md:gap-y-0 [&>*]:min-w-0 mt-2">
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="shift-date" label="Shift date" required error={err['shiftDate']} omitLabel>
                                        <FlowsheetOutlinedCalendar
                                            fieldId="shift-date"
                                            label="Shift date"
                                            value={parseIsoDateOnly(d.shiftDate)}
                                            onChange={(v) => patchDocument({ shiftDate: v ? formatIsoDateOnly(v) : '' })}
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <FlowsheetLabeledDropdown
                                        fieldId="shift-type"
                                        label="Shift type"
                                        required
                                        error={err['shiftType']}
                                        options={SHIFT_TYPE_OPTIONS}
                                        value={d.shiftType}
                                        onChange={(v) => patchDocument({ shiftType: String(v) })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField
                                        fieldId="assessed-by"
                                        label="Assessed by"
                                        required
                                        error={err['shiftInfo.primaryNurseDisplay']}
                                        omitLabel
                                    >
                                        <FlowsheetOutlinedTextInput
                                            fieldId="assessed-by"
                                            label="Assessed by"
                                            value={d.shiftInfo.primaryNurseDisplay}
                                            onChange={(v) => patchDocument({ shiftInfo: { ...d.shiftInfo, primaryNurseDisplay: v } })}
                                            disabled={isChartLocked}
                                            hasError={Boolean(err['shiftInfo.primaryNurseDisplay'])}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField
                                        fieldId="assessed-at"
                                        label="Assessment date/time"
                                        required
                                        error={err['shiftInfo.assessedAt']}
                                        omitLabel
                                    >
                                        <FlowsheetOutlinedCalendar
                                            fieldId="assessed-at"
                                            label="Assessment date/time"
                                            value={d.shiftInfo.assessedAt}
                                            onChange={(v) => patchDocument({ shiftInfo: { ...d.shiftInfo, assessedAt: v } })}
                                            showTime
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('B · Neurological', 1)}>
                            <Suspense fallback={<PanelFallback />}>
                                <NeurologicalSection />
                            </Suspense>
                        </AccordionTab>

                        <AccordionTab header={header('C · Cardiovascular', 2)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField
                                        fieldId="hr"
                                        label="Heart rate"
                                        abnormal={sev('cardiovascular.heartRate') !== 'normal'}
                                        omitLabel
                                    >
                                        <FlowsheetOutlinedInputNumber
                                            fieldId="hr"
                                            label="Heart rate"
                                            value={d.cardiovascular.heartRate}
                                            onValueChange={(v) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, heartRate: v } })
                                            }
                                            min={30}
                                            max={220}
                                            disabled={isChartLocked}
                                            useGrouping={false}
                                            abnormal={sev('cardiovascular.heartRate') !== 'normal'}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="rhythm"
                                        label="Heart rhythm"
                                        options={HEART_RHYTHM_OPTIONS}
                                        value={d.cardiovascular.heartRhythm}
                                        onChange={(v) => patchDocument({ cardiovascular: { ...d.cardiovascular, heartRhythm: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="cap-refill"
                                        label="Capillary refill"
                                        abnormal={sev('cardiovascular.capillaryRefill') !== 'normal'}
                                        options={CAPILLARY_REFILL_OPTIONS}
                                        value={d.cardiovascular.capillaryRefill}
                                        onChange={(v) =>
                                            patchDocument({ cardiovascular: { ...d.cardiovascular, capillaryRefill: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="pulse-ra"
                                        label="Peripheral pulses (RA)"
                                        options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                        value={d.cardiovascular.peripheralPulseRA}
                                        onChange={(v) =>
                                            patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseRA: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="pulse-la"
                                        label="Peripheral pulses (LA)"
                                        options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                        value={d.cardiovascular.peripheralPulseLA}
                                        onChange={(v) =>
                                            patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseLA: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="pulse-rl"
                                        label="Peripheral pulses (RL)"
                                        options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                        value={d.cardiovascular.peripheralPulseRL}
                                        onChange={(v) =>
                                            patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseRL: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="edema-dist"
                                        label="Edema"
                                        options={EDEMA_DISTRIBUTION_OPTIONS}
                                        value={d.cardiovascular.edemaDistribution}
                                        onChange={(v) => {
                                            const s = String(v);
                                            patchDocument({
                                                cardiovascular: {
                                                    ...d.cardiovascular,
                                                    edemaDistribution: s,
                                                    edemaGrade: s === 'None' ? '' : d.cardiovascular.edemaGrade,
                                                },
                                            });
                                        }}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                {showEdemaGrade ? (
                                    <div className="col-span-12 md:col-span-4">
                                        <FlowsheetLabeledDropdown
                                            fieldId="edema-grade"
                                            label="Edema grade (pitting)"
                                            options={EDEMA_GRADE_OPTIONS}
                                            value={d.cardiovascular.edemaGrade}
                                            onChange={(v) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, edemaGrade: String(v) } })
                                            }
                                            disabled={isChartLocked}
                                        />
                                    </div>
                                ) : (
                                    <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                                )}
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('D · Respiratory', 3)}>
                            <Suspense fallback={<PanelFallback />}>
                                <RespiratorySection />
                            </Suspense>
                        </AccordionTab>

                        <AccordionTab header={header('E · GI / Abdomen', 4)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="bowel-ruq"
                                        label="Bowel sounds (RUQ)"
                                        options={BOWEL_SOUND_OPTIONS}
                                        value={d.gastrointestinal.bowelSoundsRuq}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsRuq: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="bowel-luq"
                                        label="Bowel sounds (LUQ)"
                                        options={BOWEL_SOUND_OPTIONS}
                                        value={d.gastrointestinal.bowelSoundsLuq}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsLuq: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="bowel-rlq"
                                        label="Bowel sounds (RLQ)"
                                        options={BOWEL_SOUND_OPTIONS}
                                        value={d.gastrointestinal.bowelSoundsRlq}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsRlq: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="bowel-llq"
                                        label="Bowel sounds (LLQ)"
                                        options={BOWEL_SOUND_OPTIONS}
                                        value={d.gastrointestinal.bowelSoundsLlq}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsLlq: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="abd-app"
                                        label="Abdomen appearance"
                                        options={ABDOMEN_APPEARANCE_OPTIONS}
                                        value={d.gastrointestinal.abdomenAppearance}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, abdomenAppearance: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="diet-tol"
                                        label="Diet tolerance"
                                        options={DIET_TOLERANCE_OPTIONS}
                                        value={d.gastrointestinal.dietTolerance}
                                        onChange={(v) =>
                                            patchDocument({ gastrointestinal: { ...d.gastrointestinal, dietTolerance: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="lbm" label="Last bowel movement" omitLabel>
                                        <FlowsheetOutlinedCalendar
                                            fieldId="lbm"
                                            label="Last bowel movement"
                                            value={d.gastrointestinal.lastBm}
                                            onChange={(v) =>
                                                patchDocument({
                                                    gastrointestinal: { ...d.gastrointestinal, lastBm: v },
                                                })
                                            }
                                            showTime
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="nausea-vom"
                                            checked={d.gastrointestinal.nauseaOrVomiting}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    gastrointestinal: {
                                                        ...d.gastrointestinal,
                                                        nauseaOrVomiting: e.checked ?? false,
                                                        nauseaVomitingDetail: e.checked ? d.gastrointestinal.nauseaVomitingDetail : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="nausea-vom" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Nausea / vomiting
                                        </label>
                                    </div>
                                    {d.gastrointestinal.nauseaOrVomiting ? (
                                        <ClinicalField fieldId="nv-detail" label="Episodes / last emesis" omitLabel>
                                            <FlowsheetOutlinedTextInput
                                                fieldId="nv-detail"
                                                label="Episodes / last emesis"
                                                value={d.gastrointestinal.nauseaVomitingDetail}
                                                onChange={(v) =>
                                                    patchDocument({
                                                        gastrointestinal: { ...d.gastrointestinal, nauseaVomitingDetail: v },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                placeholder="Count, last emesis time…"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('F · Genitourinary', 5)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="uo-4h" label="Urine output last 4h (mL)" omitLabel>
                                        <FlowsheetOutlinedInputNumber
                                            fieldId="uo-4h"
                                            label="Urine output last 4h (mL)"
                                            value={d.genitourinary.urineOutputLast4hMl}
                                            onValueChange={(v) =>
                                                patchDocument({ genitourinary: { ...d.genitourinary, urineOutputLast4hMl: v } })
                                            }
                                            disabled={isChartLocked}
                                            useGrouping={false}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="urine-color"
                                        label="Urine color"
                                        options={URINE_COLOR_OPTIONS}
                                        value={d.genitourinary.urineColor}
                                        onChange={(v) => patchDocument({ genitourinary: { ...d.genitourinary, urineColor: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4 flex items-end pb-1">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="bladder-dist"
                                            checked={d.genitourinary.bladderDistension}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({ genitourinary: { ...d.genitourinary, bladderDistension: e.checked ?? false } })
                                            }
                                        />
                                        <label htmlFor="bladder-dist" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Bladder distension
                                        </label>
                                    </div>
                                </div>
                                <div className="col-span-12 md:col-span-8 flex flex-col gap-3">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="foley"
                                            checked={d.genitourinary.foleyCatheterPresent}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    genitourinary: {
                                                        ...d.genitourinary,
                                                        foleyCatheterPresent: e.checked ?? false,
                                                        foleyInsertionDate: e.checked ? d.genitourinary.foleyInsertionDate : null,
                                                        foleyIndication: e.checked ? d.genitourinary.foleyIndication : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="foley" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Foley catheter present
                                        </label>
                                    </div>
                                    {d.genitourinary.foleyCatheterPresent ? (
                                        <>
                                            <ClinicalField fieldId="foley-ins" label="Insertion date" error={err['genitourinary.foleyInsertionDate']} omitLabel>
                                                <FlowsheetOutlinedCalendar
                                                    fieldId="foley-ins"
                                                    label="Insertion date"
                                                    value={d.genitourinary.foleyInsertionDate}
                                                    onChange={(v) =>
                                                        patchDocument({
                                                            genitourinary: {
                                                                ...d.genitourinary,
                                                                foleyInsertionDate: v,
                                                            },
                                                        })
                                                    }
                                                    disabled={isChartLocked}
                                                />
                                            </ClinicalField>
                                            <ClinicalField fieldId="foley-ind" label="Indication" omitLabel>
                                                <FlowsheetOutlinedTextInput
                                                    fieldId="foley-ind"
                                                    label="Indication"
                                                    value={d.genitourinary.foleyIndication}
                                                    onChange={(v) =>
                                                        patchDocument({
                                                            genitourinary: { ...d.genitourinary, foleyIndication: v },
                                                        })
                                                    }
                                                    disabled={isChartLocked}
                                                />
                                            </ClinicalField>
                                        </>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('G · Integumentary / skin', 6)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="skin-color"
                                        label="Skin color"
                                        options={SKIN_COLOR_OPTIONS}
                                        value={d.integumentary.skinColor}
                                        onChange={(v) => patchDocument({ integumentary: { ...d.integumentary, skinColor: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="skin-temp"
                                        label="Skin temperature"
                                        options={SKIN_TEMPERATURE_OPTIONS}
                                        value={d.integumentary.skinTemperature}
                                        onChange={(v) =>
                                            patchDocument({ integumentary: { ...d.integumentary, skinTemperature: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="skin-turgor"
                                        label="Skin turgor"
                                        options={SKIN_TURGOR_OPTIONS}
                                        value={d.integumentary.skinTurgor}
                                        onChange={(v) => patchDocument({ integumentary: { ...d.integumentary, skinTurgor: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="wound"
                                            checked={d.integumentary.woundOrIncisionPresent}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    integumentary: {
                                                        ...d.integumentary,
                                                        woundOrIncisionPresent: e.checked ?? false,
                                                        woundOrIncisionDetail: e.checked ? d.integumentary.woundOrIncisionDetail : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="wound" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Wound / incision present
                                        </label>
                                    </div>
                                    {d.integumentary.woundOrIncisionPresent ? (
                                        <ClinicalField fieldId="wound-det" label="Location, type, stage, size, dressing, drainage" omitLabel>
                                            <FlowsheetOutlinedTextInput
                                                fieldId="wound-det"
                                                label="Location, type, stage, size, dressing, drainage"
                                                value={d.integumentary.woundOrIncisionDetail}
                                                onChange={(v) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, woundOrIncisionDetail: v },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="pi"
                                            checked={d.integumentary.pressureInjuryPresent}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    integumentary: {
                                                        ...d.integumentary,
                                                        pressureInjuryPresent: e.checked ?? false,
                                                        pressureInjuryDetail: e.checked ? d.integumentary.pressureInjuryDetail : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="pi" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Pressure injury present (Braden Tab 2)
                                        </label>
                                    </div>
                                    {d.integumentary.pressureInjuryPresent ? (
                                        <ClinicalField fieldId="pi-det" label="Stage 1–4 / Unstageable / DTI" omitLabel>
                                            <FlowsheetOutlinedTextInput
                                                fieldId="pi-det"
                                                label="Stage 1–4 / Unstageable / DTI"
                                                value={d.integumentary.pressureInjuryDetail}
                                                onChange={(v) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, pressureInjuryDetail: v },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="rash"
                                            checked={d.integumentary.rashPresent}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    integumentary: {
                                                        ...d.integumentary,
                                                        rashPresent: e.checked ?? false,
                                                        rashDetail: e.checked ? d.integumentary.rashDetail : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="rash" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Rash present
                                        </label>
                                    </div>
                                    {d.integumentary.rashPresent ? (
                                        <ClinicalField fieldId="rash-det" label="Location + description" omitLabel>
                                            <FlowsheetOutlinedTextInput
                                                fieldId="rash-det"
                                                label="Location + description"
                                                value={d.integumentary.rashDetail}
                                                onChange={(v) =>
                                                    patchDocument({ integumentary: { ...d.integumentary, rashDetail: v } })
                                                }
                                                disabled={isChartLocked}
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="drain"
                                            checked={d.integumentary.surgicalDrainPresent}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    integumentary: {
                                                        ...d.integumentary,
                                                        surgicalDrainPresent: e.checked ?? false,
                                                        surgicalDrainDetail: e.checked ? d.integumentary.surgicalDrainDetail : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="drain" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Surgical drain
                                        </label>
                                    </div>
                                    {d.integumentary.surgicalDrainPresent ? (
                                        <ClinicalField fieldId="drain-det" label="Type, output last shift (mL), color" omitLabel>
                                            <FlowsheetOutlinedTextInput
                                                fieldId="drain-det"
                                                label="Type, output last shift (mL), color"
                                                value={d.integumentary.surgicalDrainDetail}
                                                onChange={(v) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, surgicalDrainDetail: v },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                placeholder="JP / Hemovac / Penrose…"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField
                                        fieldId="braden"
                                        label="Braden score (reference)"
                                        abnormal={sev('integumentary.bradenScore') !== 'normal'}
                                        omitLabel
                                    >
                                        <FlowsheetOutlinedInputNumber
                                            fieldId="braden"
                                            label="Braden score (reference)"
                                            value={d.integumentary.bradenScore}
                                            onValueChange={(v) =>
                                                patchDocument({ integumentary: { ...d.integumentary, bradenScore: v } })
                                            }
                                            min={6}
                                            max={23}
                                            disabled={isChartLocked}
                                            abnormal={sev('integumentary.bradenScore') !== 'normal'}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('H · IV / Vascular access', 7)}>
                            <IvAccessTable />
                        </AccordionTab>

                        <AccordionTab header={header('I · Pain', 8)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-8">
                                    <ClinicalField
                                        fieldId="pain-score"
                                        label="Pain score (0 = none, 10 = worst)"
                                        abnormal={sev('pain.intensity0to10') !== 'normal'}
                                        omitLabel
                                    >
                                        <div
                                            className={`relative isolate w-full min-w-0 overflow-visible rounded-lg border px-3 pb-2.5 pt-[1.125rem] shadow-sm ${painSliderClass}`}
                                        >
                                            <span id="pain-score-flow-lbl" className={NFS_FLOAT_FIELD_LABEL}>
                                                Pain score (0–10)
                                            </span>
                                            <Slider
                                                aria-labelledby="pain-score-flow-lbl"
                                                value={d.pain.intensity0to10 ?? 0}
                                                onChange={(e) => {
                                                    const v = typeof e.value === 'number' ? e.value : Number(e.value);
                                                    patchDocument({ pain: { ...d.pain, intensity0to10: Number.isFinite(v) ? v : null } });
                                                }}
                                                min={0}
                                                max={10}
                                                step={1}
                                                disabled={isChartLocked}
                                                className="w-full"
                                            />
                                            <div className="mt-1 flex justify-between text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                                <span>0</span>
                                                <span className="tabular-nums">{d.pain.intensity0to10 ?? 0}</span>
                                                <span>10</span>
                                            </div>
                                        </div>
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="pain-loc" label="Pain location" omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="pain-loc"
                                            label="Pain location"
                                            value={d.pain.location}
                                            onChange={(v) => patchDocument({ pain: { ...d.pain, location: v } })}
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="pain-qual" label="Pain quality" omitLabel>
                                        <FlowsheetOutlinedMultiSelect
                                            fieldId="pain-qual"
                                            label="Pain quality"
                                            value={d.pain.quality}
                                            options={PAIN_QUALITY_OPTIONS}
                                            onChange={(next) => patchDocument({ pain: { ...d.pain, quality: next } })}
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="aggrav" label="Aggravating factors" omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="aggrav"
                                            label="Aggravating factors"
                                            value={d.pain.aggravatingFactors}
                                            onChange={(v) => patchDocument({ pain: { ...d.pain, aggravatingFactors: v } })}
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="pain-intv" label="Intervention given" error={err['pain.interventionGiven']} omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="pain-intv"
                                            label="Intervention given"
                                            value={d.pain.interventionGiven}
                                            onChange={(v) => patchDocument({ pain: { ...d.pain, interventionGiven: v } })}
                                            disabled={isChartLocked}
                                            hasError={Boolean(err['pain.interventionGiven'])}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="pain-response"
                                        label="Response to Intervention"
                                        options={[
                                            { value: 'Complete Relief', label: 'Complete Relief' },
                                            { value: 'Partial Relief', label: 'Partial Relief' },
                                            { value: 'No Relief', label: 'No Relief' },
                                        ]}
                                        value={d.pain.responseToIntervention}
                                        onChange={(v) =>
                                            patchDocument({
                                                pain: {
                                                    ...d.pain,
                                                    responseToIntervention: String(v) as (typeof d.pain)['responseToIntervention'],
                                                },
                                            })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="radiation"
                                            checked={d.pain.radiation}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    pain: {
                                                        ...d.pain,
                                                        radiation: e.checked ?? false,
                                                        radiationWhere: e.checked ? d.pain.radiationWhere : '',
                                                    },
                                                })
                                            }
                                        />
                                        <label htmlFor="radiation" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Radiation
                                        </label>
                                    </div>
                                    {d.pain.radiation ? (
                                        <FlowsheetOutlinedTextInput
                                            fieldId="pain-rad-where"
                                            label="Radiates to"
                                            value={d.pain.radiationWhere}
                                            onChange={(v) => patchDocument({ pain: { ...d.pain, radiationWhere: v } })}
                                            disabled={isChartLocked}
                                            placeholder="Where?"
                                        />
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                                <div className="col-span-12">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            {(['STAT', 'routine'] as const).map((p) => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    disabled={isChartLocked}
                                                    onClick={() =>
                                                        patchDocument({
                                                            pain: {
                                                                ...d.pain,
                                                                reassessmentPriority: p,
                                                                reassessmentDue: reassessmentDueFromPriority(p),
                                                            },
                                                        })
                                                    }
                                                    className={`flex items-center gap-2 ${NFS_OPTION_BASE_CLASS} ${
                                                        d.pain.reassessmentPriority === p ? NFS_OPTION_ACTIVE_CLASS : NFS_OPTION_IDLE_CLASS
                                                    } ${isChartLocked ? 'pointer-events-none opacity-50' : ''}`}
                                                >
                                                    <span
                                                        className={`${NFS_RADIO_INDICATOR_BASE} ${
                                                            d.pain.reassessmentPriority === p
                                                                ? NFS_RADIO_INDICATOR_ACTIVE
                                                                : NFS_RADIO_INDICATOR_IDLE
                                                        }`}
                                                        aria-hidden
                                                    >
                                                        {d.pain.reassessmentPriority === p ? (
                                                            <span className="h-2 w-2 rounded-full bg-primary" />
                                                        ) : null}
                                                    </span>
                                                    {p === 'STAT' ? 'STAT (+1h)' : 'Routine (+4h)'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="min-w-0 flex-1 basis-[min(100%,340px)]">
                                            <ClinicalField fieldId="pain-reax-due" label="Re-assessment due" omitLabel>
                                                <FlowsheetOutlinedCalendar
                                                    fieldId="pain-reax-due"
                                                    label="Re-assessment Due"
                                                    value={d.pain.reassessmentDue}
                                                    onChange={(v) => patchDocument({ pain: { ...d.pain, reassessmentDue: v } })}
                                                    showTime
                                                    disabled={isChartLocked}
                                                />
                                            </ClinicalField>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('J · Musculoskeletal', 9)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="mob"
                                        label="Mobility status"
                                        options={MOBILITY_STATUS_OPTIONS}
                                        value={d.musculoskeletal.mobilityStatus}
                                        onChange={(v) =>
                                            patchDocument({ musculoskeletal: { ...d.musculoskeletal, mobilityStatus: String(v) } })
                                        }
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="gait"
                                        label="Gait"
                                        options={GAIT_OPTIONS}
                                        value={d.musculoskeletal.gait}
                                        onChange={(v) => patchDocument({ musculoskeletal: { ...d.musculoskeletal, gait: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="morse" label="Morse fall score" omitLabel>
                                        <FlowsheetOutlinedInputNumber
                                            fieldId="morse"
                                            label="Morse fall score"
                                            value={d.musculoskeletal.morseFallScore}
                                            onValueChange={(v) => {
                                                const msk = { ...d.musculoskeletal, morseFallScore: v };
                                                if (v != null && v >= 45) msk.fallPrecautionsActive = true;
                                                patchDocument({ musculoskeletal: msk });
                                            }}
                                            min={0}
                                            max={125}
                                            disabled={isChartLocked}
                                            useGrouping={false}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4 flex items-end pb-1">
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Checkbox
                                            inputId="fall-prec"
                                            checked={d.musculoskeletal.fallPrecautionsActive}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({
                                                    musculoskeletal: { ...d.musculoskeletal, fallPrecautionsActive: e.checked ?? false },
                                                })
                                            }
                                        />
                                        <label htmlFor="fall-prec" className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                            Fall precautions (auto if Morse ≥45)
                                        </label>
                                    </div>
                                </div>
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                                <div className="col-span-12 md:col-span-4 max-md:hidden" aria-hidden />
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('K · Psychosocial', 10)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="mood"
                                        label="Mood / affect"
                                        options={MOOD_AFFECT_OPTIONS}
                                        value={d.psychosocial.moodAffect}
                                        onChange={(v) => patchDocument({ psychosocial: { ...d.psychosocial, moodAffect: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <FlowsheetLabeledDropdown
                                        fieldId="behavior"
                                        label="Behavior"
                                        options={BEHAVIOR_OPTIONS}
                                        value={d.psychosocial.behavior}
                                        onChange={(v) => patchDocument({ psychosocial: { ...d.psychosocial, behavior: String(v) } })}
                                        disabled={isChartLocked}
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="safety-risk" label="Safety risk" omitLabel>
                                        <FlowsheetOutlinedMultiSelect
                                            fieldId="safety-risk"
                                            label="Safety risk"
                                            value={d.psychosocial.safetyRisk}
                                            options={SAFETY_RISK_OPTIONS}
                                            onChange={(next) => patchDocument({ psychosocial: { ...d.psychosocial, safetyRisk: next } })}
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12">
                                    <ClinicalField fieldId="edu" label="Patient education provided" omitLabel>
                                        <FlowsheetOutlinedMultiSelect
                                            fieldId="edu"
                                            label="Patient education provided"
                                            value={d.psychosocial.patientEducationProvided}
                                            options={PATIENT_EDUCATION_OPTIONS}
                                            onChange={(next) =>
                                                patchDocument({ psychosocial: { ...d.psychosocial, patientEducationProvided: next } })
                                            }
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('L · Signature', 11)}>
                            <div className={NFS_SECTION_GRID_CLASS}>
                                <div className="col-span-12 flex flex-wrap items-center gap-3">
                                    <div className="flex min-w-0 max-w-full items-center gap-2">
                                        <Checkbox
                                            inputId="nfs-flowsheet-attest"
                                            className="shrink-0"
                                            checked={d.attestationAccepted}
                                            disabled={isChartLocked}
                                            onChange={(e) => patchDocument({ attestationAccepted: e.checked ?? false })}
                                        />
                                        <label
                                            htmlFor="nfs-flowsheet-attest"
                                            className="mb-0 inline max-w-[min(100%,48rem)] cursor-pointer text-[11px] font-medium leading-snug"
                                        >
                                            I attest this head-to-toe reflects my professional assessment for this patient and shift.
                                        </label>
                                    </div>
                                    {err['attestationAccepted'] ? (
                                        <span className="text-[10px] font-semibold text-red-600">{err['attestationAccepted']}</span>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="signed-by-ro" label="Signed by" omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="signed-by-ro"
                                            label="Signed by"
                                            readOnly
                                            value={state.document.signedAt ? (state.document.signedByName ?? '') : d.shiftInfo.primaryNurseDisplay}
                                            onChange={() => {}}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="creds" label="Credentials" error={err['signerCredentials']} omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="creds"
                                            label="Credentials"
                                            value={d.signerCredentials ?? ''}
                                            onChange={(v) => patchDocument({ signerCredentials: v || null })}
                                            readOnly={Boolean(state.document.signedAt)}
                                            disabled={isChartLocked}
                                            placeholder="RN, LVN, CNA…"
                                            hasError={Boolean(err['signerCredentials'])}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="signed-dt" label="Signed date/time" omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="signed-dt"
                                            label="Signed date/time"
                                            readOnly
                                            value={
                                                state.document.signedAt
                                                    ? new Date(state.document.signedAt).toLocaleString()
                                                    : '— Not signed —'
                                            }
                                            onChange={() => {}}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="sig-status" label="Electronic signature status" omitLabel>
                                        <FlowsheetOutlinedTextInput
                                            fieldId="sig-status"
                                            label="Electronic signature status"
                                            readOnly
                                            value={
                                                state.document.signedAt
                                                    ? `Locked ${new Date(state.document.signedAt).toLocaleString()}`
                                                    : 'Unsigned draft'
                                            }
                                            onChange={() => {}}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-8 flex items-end">
                                    <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                                        Co-sign and break-glass policies are enforced server-side in production. This UI captures intent only.
                                    </p>
                                </div>
                            </div>
                        </AccordionTab>
                    </Accordion>
                </div>
            </div>

            <div className="pointer-events-none fixed bottom-20 right-4 z-30 flex flex-col gap-2">
                <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-gray-200/90 bg-white/95 p-1.5 shadow-xl shadow-gray-900/10 ring-1 ring-gray-900/[0.04] backdrop-blur-md dark:border-white/10 dark:bg-[#141210]/95 dark:shadow-black/40 dark:ring-white/[0.06]">
                    <Button
                        type="button"
                        size="small"
                        icon="pi pi-save"
                        label="Save now"
                        className="!justify-start !text-[11px]"
                        onClick={persistDraftNow}
                        disabled={isChartLocked}
                    />
                    <Button
                        type="button"
                        size="small"
                        icon="pi pi-history"
                        label="History"
                        className="!justify-start !text-[11px]"
                        outlined
                        onClick={openHistory}
                    />
                </div>
            </div>

            <footer className="sticky bottom-0 z-20 border-t border-gray-200/90 bg-white/95 px-2 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-[#141210]/95">
                <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Tag value="Demo PHI — do not use for real patients" severity="warning" className="!text-[9px]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <FlowsheetCancelAmendButton />
                        {state.document.chartStatus === 'signed' ? (
                            <Button type="button" label="Amend" size="small" severity="help" onClick={() => setAmendOpen(true)} />
                        ) : null}
                        <Button type="button" label="Save now" size="small" outlined onClick={persistDraftNow} disabled={isChartLocked} />
                        <Button
                            type="button"
                            label="Sign"
                            size="small"
                            icon="pi pi-pencil"
                            disabled={state.document.chartStatus === 'signed'}
                            onClick={() => {
                                setSignerName(d.shiftInfo.primaryNurseDisplay);
                                setSignConfirmOpen(false);
                                setSignOpen(true);
                            }}
                        />
                    </div>
                </div>
            </footer>

            <FlowsheetHistorySidebar />
            <FlowsheetAmendDialog visible={amendOpen} onHide={() => setAmendOpen(false)} />

            <Dialog
                className="nfs-chart-dialog !rounded-2xl"
                contentClassName="!pt-3 !pb-3"
                header={
                    <div className="flex items-start gap-3 pe-8">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                            <i className="pi pi-clock text-lg" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                            <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Switch scheduled shift</h2>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Demo — scheduling integration</p>
                        </div>
                    </div>
                }
                visible={shiftDialog}
                style={{ width: 'min(96vw, 420px)' }}
                onHide={() => setShiftDialog(false)}
                draggable={false}
                resizable={false}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button type="button" label="Close" size="small" severity="secondary" outlined onClick={() => setShiftDialog(false)} />
                    </div>
                }
            >
                <p className="mb-3 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                    In production this opens your scheduling / staffing feed. Here it is informational only.
                </p>
                <NewDropdown
                    label="Shift instance"
                    fieldSize="md"
                    options={[{ value: 'demo', label: 'Demo shift (placeholder)' }]}
                    value="demo"
                    placeholder="Select..."
                    onChange={() => {}}
                    disabled
                    appendMenuToBody
                />
            </Dialog>

            <Dialog
                className="nfs-chart-dialog !rounded-2xl"
                contentClassName="!pt-3 !pb-3"
                header={
                    <div className="flex items-start gap-3 pe-8">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
                            <i className="pi pi-link text-lg" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                            <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Active encounters</h2>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Chart context</p>
                        </div>
                    </div>
                }
                visible={encDialog}
                style={{ width: 'min(96vw, 480px)' }}
                onHide={() => setEncDialog(false)}
                draggable={false}
                resizable={false}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button type="button" label="Close" size="small" severity="secondary" outlined onClick={() => setEncDialog(false)} />
                    </div>
                }
            >
                <p className="text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                    Current encounter{' '}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-800 dark:bg-white/10 dark:text-gray-100">
                        {encounterId || '—'}
                    </span>
                    . Switching encounters reloads chart context from ADT in production.
                </p>
            </Dialog>

            <Dialog
                className="nfs-chart-dialog !rounded-2xl"
                contentClassName="!pt-3 !pb-3"
                header={
                    <div className="flex items-start gap-3 pe-8">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                            <i className="pi pi-pencil text-lg" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                            <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Sign assessment</h2>
                            <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Electronic signature for this shift</p>
                        </div>
                    </div>
                }
                visible={signOpen}
                style={{ width: 'min(96vw, 400px)' }}
                onHide={() => setSignOpen(false)}
                draggable={false}
                resizable={false}
                footer={
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button type="button" label="Cancel" size="small" severity="secondary" outlined onClick={() => setSignOpen(false)} />
                        <Button type="button" label="Review & sign" size="small" icon="pi pi-arrow-right" iconPos="right" onClick={openSignReview} />
                    </div>
                }
            >
                <p className="mb-3 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
                    By continuing, you confirm this head-to-toe reflects your professional assessment for this patient and shift.
                </p>
                <FlowsheetOutlinedTextInput
                    fieldId="signer"
                    label="Signer display name"
                    value={signerName}
                    onChange={(v) => setSignerName(v)}
                    placeholder="e.g. Jordan Lee, RN"
                />
            </Dialog>

            <Dialog
                className="nfs-chart-dialog !rounded-2xl"
                contentClassName="!pt-3 !pb-3"
                header={
                    <div className="flex items-start gap-3 pe-8">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-800 dark:text-amber-400/15 dark:text-amber-100">
                            <i className="pi pi-lock text-lg" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                            <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">Confirm signature</h2>
                            <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">This action cannot be undone in demo mode</p>
                        </div>
                    </div>
                }
                visible={signConfirmOpen}
                style={{ width: 'min(96vw, 420px)' }}
                onHide={cancelSignConfirm}
                draggable={false}
                resizable={false}
                closable
                footer={
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button type="button" label="Go back" size="small" severity="secondary" outlined onClick={cancelSignConfirm} />
                        <Button
                            type="button"
                            label="Sign & lock chart"
                            size="small"
                            icon="pi pi-check"
                            severity="success"
                            onClick={confirmSignAndLock}
                        />
                    </div>
                }
            >
                <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        <i className="pi pi-info-circle text-sm" aria-hidden />
                    </span>
                    <p className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-200">
                        Signing locks this assessment to the legal record for this shift. You are signing as{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{signerName.trim() || d.shiftInfo.primaryNurseDisplay}</span>
                        {d.signerCredentials ? (
                            <>
                                , <span className="font-semibold">{d.signerCredentials}</span>
                            </>
                        ) : null}
                        .
                    </p>
                </div>
            </Dialog>
        </div>
    );
}
