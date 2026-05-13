import { lazy, Suspense, useCallback, useState } from 'react';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { MultiSelect } from 'primereact/multiselect';
import { Skeleton } from 'primereact/skeleton';
import { Slider } from 'primereact/slider';
import { Tag } from 'primereact/tag';
import type { FacesheetPatient } from '../../../services/patient.service';
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
            <span className="truncate text-left text-[12px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
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
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="shift-date" label="Shift date" required error={err['shiftDate']}>
                                        <Calendar
                                            id="shift-date"
                                            value={parseIsoDateOnly(d.shiftDate)}
                                            onChange={(e) => {
                                                const v = e.value as Date | null;
                                                patchDocument({ shiftDate: v ? formatIsoDateOnly(v) : '' });
                                            }}
                                            disabled={isChartLocked}
                                            className="w-full max-w-full"
                                            inputClassName="!text-[12px]"
                                            panelClassName="nfs-flowsheet-cal-panel"
                                            panelStyle={{ maxWidth: 'min(22rem, calc(100vw - 1.5rem))', width: 'min(22rem, calc(100vw - 1.5rem))' }}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="shift-type" label="Shift type" required error={err['shiftType']}>
                                        <Dropdown
                                            value={d.shiftType}
                                            options={SHIFT_TYPE_OPTIONS}
                                            onChange={(e) => patchDocument({ shiftType: e.value ?? '' })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-5">
                                    <ClinicalField
                                        fieldId="assessed-by"
                                        label="Assessed by"
                                        required
                                        error={err['shiftInfo.primaryNurseDisplay']}
                                    >
                                        <InputText
                                            id="assessed-by"
                                            value={d.shiftInfo.primaryNurseDisplay}
                                            onChange={(e) =>
                                                patchDocument({ shiftInfo: { ...d.shiftInfo, primaryNurseDisplay: e.target.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                    <ClinicalField
                                        fieldId="assessed-at"
                                        label="Assessment date/time"
                                        required
                                        error={err['shiftInfo.assessedAt']}
                                    >
                                        <Calendar
                                            id="assessed-at"
                                            value={d.shiftInfo.assessedAt}
                                            onChange={(e) =>
                                                patchDocument({ shiftInfo: { ...d.shiftInfo, assessedAt: (e.value as Date) ?? null } })
                                            }
                                            showTime
                                            hourFormat="12"
                                            disabled={isChartLocked}
                                            className="w-full max-w-full"
                                            inputClassName="!text-[12px]"
                                            panelClassName="nfs-flowsheet-cal-panel"
                                            panelStyle={{ maxWidth: 'min(22rem, calc(100vw - 1.5rem))', width: 'min(22rem, calc(100vw - 1.5rem))' }}
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
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-2">
                                    <ClinicalField fieldId="hr" label="Heart rate" abnormal={sev('cardiovascular.heartRate') !== 'normal'}>
                                        <InputNumber
                                            value={d.cardiovascular.heartRate}
                                            onValueChange={(e) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, heartRate: e.value ?? null } })
                                            }
                                            min={30}
                                            max={220}
                                            disabled={isChartLocked}
                                            className="w-full"
                                            inputClassName="!text-[12px]"
                                            useGrouping={false}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="rhythm" label="Heart rhythm">
                                        <Dropdown
                                            value={d.cardiovascular.heartRhythm}
                                            options={HEART_RHYTHM_OPTIONS}
                                            onChange={(e) => patchDocument({ cardiovascular: { ...d.cardiovascular, heartRhythm: e.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <ClinicalField fieldId="pulse-ra" label="Peripheral pulses (RA)">
                                        <Dropdown
                                            value={d.cardiovascular.peripheralPulseRA}
                                            options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseRA: e.value ?? '' } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <ClinicalField fieldId="pulse-la" label="Peripheral pulses (LA)">
                                        <Dropdown
                                            value={d.cardiovascular.peripheralPulseLA}
                                            options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseLA: e.value ?? '' } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <ClinicalField fieldId="pulse-rl" label="Peripheral pulses (RL)">
                                        <Dropdown
                                            value={d.cardiovascular.peripheralPulseRL}
                                            options={PERIPHERAL_PULSE_GRADE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, peripheralPulseRL: e.value ?? '' } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="cap-refill" label="Capillary refill" abnormal={sev('cardiovascular.capillaryRefill') !== 'normal'}>
                                        <Dropdown
                                            value={d.cardiovascular.capillaryRefill}
                                            options={CAPILLARY_REFILL_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ cardiovascular: { ...d.cardiovascular, capillaryRefill: e.value ?? '' } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="edema-dist" label="Edema">
                                        <Dropdown
                                            value={d.cardiovascular.edemaDistribution}
                                            options={EDEMA_DISTRIBUTION_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({
                                                    cardiovascular: {
                                                        ...d.cardiovascular,
                                                        edemaDistribution: e.value ?? '',
                                                        edemaGrade:
                                                            e.value === 'None' ? '' : d.cardiovascular.edemaGrade,
                                                    },
                                                })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                {showEdemaGrade ? (
                                    <div className="col-span-12 md:col-span-4">
                                        <ClinicalField fieldId="edema-grade" label="Edema grade (pitting)">
                                            <Dropdown
                                                value={d.cardiovascular.edemaGrade}
                                                options={EDEMA_GRADE_OPTIONS}
                                                onChange={(e) =>
                                                    patchDocument({ cardiovascular: { ...d.cardiovascular, edemaGrade: e.value ?? '' } })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                                placeholder="—"
                                            />
                                        </ClinicalField>
                                    </div>
                                ) : null}
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('D · Respiratory', 3)}>
                            <Suspense fallback={<PanelFallback />}>
                                <RespiratorySection />
                            </Suspense>
                        </AccordionTab>

                        <AccordionTab header={header('E · GI / Abdomen', 4)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="bowel-ruq" label="Bowel sounds (RUQ)">
                                        <Dropdown
                                            value={d.gastrointestinal.bowelSoundsRuq}
                                            options={BOWEL_SOUND_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsRuq: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="bowel-luq" label="Bowel sounds (LUQ)">
                                        <Dropdown
                                            value={d.gastrointestinal.bowelSoundsLuq}
                                            options={BOWEL_SOUND_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsLuq: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="bowel-rlq" label="Bowel sounds (RLQ)">
                                        <Dropdown
                                            value={d.gastrointestinal.bowelSoundsRlq}
                                            options={BOWEL_SOUND_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsRlq: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="bowel-llq" label="Bowel sounds (LLQ)">
                                        <Dropdown
                                            value={d.gastrointestinal.bowelSoundsLlq}
                                            options={BOWEL_SOUND_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, bowelSoundsLlq: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                    <ClinicalField fieldId="abd-app" label="Abdomen appearance">
                                        <Dropdown
                                            value={d.gastrointestinal.abdomenAppearance}
                                            options={ABDOMEN_APPEARANCE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, abdomenAppearance: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="nausea-vom" className="text-[11px] font-medium">
                                            Nausea / vomiting
                                        </label>
                                    </div>
                                    {d.gastrointestinal.nauseaOrVomiting ? (
                                        <ClinicalField fieldId="nv-detail" label="Episodes / last emesis">
                                            <InputText
                                                value={d.gastrointestinal.nauseaVomitingDetail}
                                                onChange={(e) =>
                                                    patchDocument({
                                                        gastrointestinal: { ...d.gastrointestinal, nauseaVomitingDetail: e.target.value },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                                placeholder="Count, last emesis time…"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="lbm" label="Last bowel movement">
                                        <Calendar
                                            value={d.gastrointestinal.lastBm}
                                            onChange={(e) =>
                                                patchDocument({
                                                    gastrointestinal: { ...d.gastrointestinal, lastBm: (e.value as Date) ?? null },
                                                })
                                            }
                                            showTime
                                            hourFormat="12"
                                            disabled={isChartLocked}
                                            className="w-full max-w-full"
                                            inputClassName="!text-[12px]"
                                            panelClassName="nfs-flowsheet-cal-panel"
                                            panelStyle={{ maxWidth: 'min(22rem, calc(100vw - 1.5rem))', width: 'min(22rem, calc(100vw - 1.5rem))' }}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-8">
                                    <ClinicalField fieldId="diet-tol" label="Diet tolerance">
                                        <Dropdown
                                            value={d.gastrointestinal.dietTolerance}
                                            options={DIET_TOLERANCE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ gastrointestinal: { ...d.gastrointestinal, dietTolerance: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('F · Genitourinary', 5)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-3">
                                    <ClinicalField fieldId="uo-4h" label="Urine output last 4h (mL)">
                                        <InputNumber
                                            value={d.genitourinary.urineOutputLast4hMl}
                                            onValueChange={(e) =>
                                                patchDocument({ genitourinary: { ...d.genitourinary, urineOutputLast4hMl: e.value ?? null } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full"
                                            inputClassName="!text-[12px]"
                                            useGrouping={false}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="urine-color" label="Urine color">
                                        <Dropdown
                                            value={d.genitourinary.urineColor}
                                            options={URINE_COLOR_OPTIONS}
                                            onChange={(e) => patchDocument({ genitourinary: { ...d.genitourinary, urineColor: e.value ?? '' } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-5 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="foley" className="text-[11px] font-medium">
                                            Foley catheter present
                                        </label>
                                    </div>
                                    {d.genitourinary.foleyCatheterPresent ? (
                                        <>
                                            <ClinicalField
                                                fieldId="foley-ins"
                                                label="Insertion date"
                                                error={err['genitourinary.foleyInsertionDate']}
                                            >
                                                <Calendar
                                                    value={d.genitourinary.foleyInsertionDate}
                                                    onChange={(e) =>
                                                        patchDocument({
                                                            genitourinary: {
                                                                ...d.genitourinary,
                                                                foleyInsertionDate: (e.value as Date) ?? null,
                                                            },
                                                        })
                                                    }
                                                    disabled={isChartLocked}
                                                    className="w-full max-w-full"
                                                    inputClassName="!text-[12px]"
                                                    panelClassName="nfs-flowsheet-cal-panel"
                                                    panelStyle={{
                                                        maxWidth: 'min(22rem, calc(100vw - 1.5rem))',
                                                        width: 'min(22rem, calc(100vw - 1.5rem))',
                                                    }}
                                                />
                                            </ClinicalField>
                                            <ClinicalField fieldId="foley-ind" label="Indication">
                                                <InputText
                                                    value={d.genitourinary.foleyIndication}
                                                    onChange={(e) =>
                                                        patchDocument({
                                                            genitourinary: { ...d.genitourinary, foleyIndication: e.target.value },
                                                        })
                                                    }
                                                    disabled={isChartLocked}
                                                    className="w-full !text-[12px]"
                                                />
                                            </ClinicalField>
                                        </>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4 flex items-end pb-1">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            inputId="bladder-dist"
                                            checked={d.genitourinary.bladderDistension}
                                            disabled={isChartLocked}
                                            onChange={(e) =>
                                                patchDocument({ genitourinary: { ...d.genitourinary, bladderDistension: e.checked ?? false } })
                                            }
                                        />
                                        <label htmlFor="bladder-dist" className="text-[11px] font-medium">
                                            Bladder distension
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('G · Integumentary / skin', 6)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="skin-color" label="Skin color">
                                        <Dropdown
                                            value={d.integumentary.skinColor}
                                            options={SKIN_COLOR_OPTIONS}
                                            onChange={(e) => patchDocument({ integumentary: { ...d.integumentary, skinColor: e.value ?? '' } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="skin-temp" label="Skin temperature">
                                        <Dropdown
                                            value={d.integumentary.skinTemperature}
                                            options={SKIN_TEMPERATURE_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ integumentary: { ...d.integumentary, skinTemperature: e.value ?? '' } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="skin-turgor" label="Skin turgor">
                                        <Dropdown
                                            value={d.integumentary.skinTurgor}
                                            options={SKIN_TURGOR_OPTIONS}
                                            onChange={(e) => patchDocument({ integumentary: { ...d.integumentary, skinTurgor: e.value ?? '' } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="wound" className="text-[11px] font-medium">
                                            Wound / incision present
                                        </label>
                                    </div>
                                    {d.integumentary.woundOrIncisionPresent ? (
                                        <ClinicalField fieldId="wound-det" label="Location, type, stage, size, dressing, drainage">
                                            <InputText
                                                value={d.integumentary.woundOrIncisionDetail}
                                                onChange={(e) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, woundOrIncisionDetail: e.target.value },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="pi" className="text-[11px] font-medium">
                                            Pressure injury present (Braden Tab 2)
                                        </label>
                                    </div>
                                    {d.integumentary.pressureInjuryPresent ? (
                                        <ClinicalField fieldId="pi-det" label="Stage 1–4 / Unstageable / DTI">
                                            <InputText
                                                value={d.integumentary.pressureInjuryDetail}
                                                onChange={(e) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, pressureInjuryDetail: e.target.value },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="rash" className="text-[11px] font-medium">
                                            Rash present
                                        </label>
                                    </div>
                                    {d.integumentary.rashPresent ? (
                                        <ClinicalField fieldId="rash-det" label="Location + description">
                                            <InputText
                                                value={d.integumentary.rashDetail}
                                                onChange={(e) =>
                                                    patchDocument({ integumentary: { ...d.integumentary, rashDetail: e.target.value } })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="drain" className="text-[11px] font-medium">
                                            Surgical drain
                                        </label>
                                    </div>
                                    {d.integumentary.surgicalDrainPresent ? (
                                        <ClinicalField fieldId="drain-det" label="Type, output last shift (mL), color">
                                            <InputText
                                                value={d.integumentary.surgicalDrainDetail}
                                                onChange={(e) =>
                                                    patchDocument({
                                                        integumentary: { ...d.integumentary, surgicalDrainDetail: e.target.value },
                                                    })
                                                }
                                                disabled={isChartLocked}
                                                className="w-full !text-[12px]"
                                                placeholder="JP / Hemovac / Penrose…"
                                            />
                                        </ClinicalField>
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="braden" label="Braden score (reference)" abnormal={sev('integumentary.bradenScore') !== 'normal'}>
                                        <InputNumber
                                            value={d.integumentary.bradenScore}
                                            onValueChange={(e) =>
                                                patchDocument({ integumentary: { ...d.integumentary, bradenScore: e.value ?? null } })
                                            }
                                            min={6}
                                            max={23}
                                            disabled={isChartLocked}
                                            className="w-full"
                                            inputClassName="!text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('H · IV / Vascular access', 7)}>
                            <IvAccessTable />
                        </AccordionTab>

                        <AccordionTab header={header('I · Pain', 8)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                                <div className="col-span-12 md:col-span-8">
                                    <ClinicalField
                                        fieldId="pain-score"
                                        label="Pain score (0 = none, 10 = worst)"
                                        abnormal={sev('pain.intensity0to10') !== 'normal'}
                                    >
                                        <div className={`rounded-lg border px-3 py-2 ${painSliderClass}`}>
                                            <Slider
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
                                    <ClinicalField fieldId="pain-loc" label="Pain location">
                                        <InputText
                                            value={d.pain.location}
                                            onChange={(e) => patchDocument({ pain: { ...d.pain, location: e.target.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-8">
                                    <ClinicalField fieldId="pain-qual" label="Pain quality">
                                        <MultiSelect
                                            value={d.pain.quality}
                                            options={PAIN_QUALITY_OPTIONS}
                                            onChange={(e) => patchDocument({ pain: { ...d.pain, quality: e.value ?? [] } })}
                                            display="chip"
                                            className="w-full !text-[12px]"
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="radiation" className="text-[11px] font-medium">
                                            Radiation
                                        </label>
                                    </div>
                                    {d.pain.radiation ? (
                                        <InputText
                                            value={d.pain.radiationWhere}
                                            onChange={(e) => patchDocument({ pain: { ...d.pain, radiationWhere: e.target.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="Where?"
                                        />
                                    ) : null}
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                    <ClinicalField fieldId="aggrav" label="Aggravating factors">
                                        <InputText
                                            value={d.pain.aggravatingFactors}
                                            onChange={(e) => patchDocument({ pain: { ...d.pain, aggravatingFactors: e.target.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                    <ClinicalField fieldId="pain-intv" label="Intervention given" error={err['pain.interventionGiven']}>
                                        <InputText
                                            value={d.pain.interventionGiven}
                                            onChange={(e) => patchDocument({ pain: { ...d.pain, interventionGiven: e.target.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('J · Musculoskeletal', 9)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="mob" label="Mobility status">
                                        <Dropdown
                                            value={d.musculoskeletal.mobilityStatus}
                                            options={MOBILITY_STATUS_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ musculoskeletal: { ...d.musculoskeletal, mobilityStatus: e.value } })
                                            }
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="gait" label="Gait">
                                        <Dropdown
                                            value={d.musculoskeletal.gait}
                                            options={GAIT_OPTIONS}
                                            onChange={(e) => patchDocument({ musculoskeletal: { ...d.musculoskeletal, gait: e.value } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <ClinicalField fieldId="morse" label="Morse fall score">
                                        <InputNumber
                                            value={d.musculoskeletal.morseFallScore}
                                            onValueChange={(e) => {
                                                const v = e.value ?? null;
                                                const msk = { ...d.musculoskeletal, morseFallScore: v };
                                                if (v != null && v >= 45) msk.fallPrecautionsActive = true;
                                                patchDocument({ musculoskeletal: msk });
                                            }}
                                            min={0}
                                            max={125}
                                            disabled={isChartLocked}
                                            className="w-full"
                                            inputClassName="!text-[12px]"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-2 flex items-end pb-1">
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="fall-prec" className="text-[11px] font-medium leading-snug">
                                            Fall precautions (auto if Morse ≥45)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('K · Psychosocial', 10)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="mood" label="Mood / affect">
                                        <Dropdown
                                            value={d.psychosocial.moodAffect}
                                            options={MOOD_AFFECT_OPTIONS}
                                            onChange={(e) => patchDocument({ psychosocial: { ...d.psychosocial, moodAffect: e.value ?? '' } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="behavior" label="Behavior">
                                        <Dropdown
                                            value={d.psychosocial.behavior}
                                            options={BEHAVIOR_OPTIONS}
                                            onChange={(e) => patchDocument({ psychosocial: { ...d.psychosocial, behavior: e.value ?? '' } })}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="—"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="safety-risk" label="Safety risk">
                                        <MultiSelect
                                            value={d.psychosocial.safetyRisk}
                                            options={SAFETY_RISK_OPTIONS}
                                            onChange={(e) => patchDocument({ psychosocial: { ...d.psychosocial, safetyRisk: e.value ?? [] } })}
                                            display="chip"
                                            className="w-full !text-[12px]"
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12">
                                    <ClinicalField fieldId="edu" label="Patient education provided">
                                        <MultiSelect
                                            value={d.psychosocial.patientEducationProvided}
                                            options={PATIENT_EDUCATION_OPTIONS}
                                            onChange={(e) =>
                                                patchDocument({ psychosocial: { ...d.psychosocial, patientEducationProvided: e.value ?? [] } })
                                            }
                                            display="chip"
                                            className="w-full !text-[12px]"
                                            disabled={isChartLocked}
                                        />
                                    </ClinicalField>
                                </div>
                            </div>
                        </AccordionTab>

                        <AccordionTab header={header('L · Signature', 11)}>
                            <div className="grid grid-cols-12 gap-x-2 gap-y-2">
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
                                    <ClinicalField fieldId="signed-by-ro" label="Signed by">
                                        <InputText
                                            readOnly
                                            value={state.document.signedAt ? (state.document.signedByName ?? '') : d.shiftInfo.primaryNurseDisplay}
                                            className="w-full !bg-gray-100 !text-[12px] dark:!bg-white/5"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="creds" label="Credentials" error={err['signerCredentials']}>
                                        <InputText
                                            value={d.signerCredentials ?? ''}
                                            onChange={(e) => patchDocument({ signerCredentials: e.target.value || null })}
                                            readOnly={Boolean(state.document.signedAt)}
                                            disabled={isChartLocked}
                                            className="w-full !text-[12px]"
                                            placeholder="RN, LVN, CNA…"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <ClinicalField fieldId="signed-dt" label="Signed date/time">
                                        <InputText
                                            readOnly
                                            value={
                                                state.document.signedAt
                                                    ? new Date(state.document.signedAt).toLocaleString()
                                                    : '— Not signed —'
                                            }
                                            className="w-full !bg-gray-100 !text-[12px] dark:!bg-white/5"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                    <ClinicalField fieldId="sig-status" label="Electronic signature status">
                                        <InputText
                                            readOnly
                                            value={
                                                state.document.signedAt
                                                    ? `Locked ${new Date(state.document.signedAt).toLocaleString()}`
                                                    : 'Unsigned draft'
                                            }
                                            className="w-full !bg-gray-100 !text-[12px] dark:!bg-white/5"
                                        />
                                    </ClinicalField>
                                </div>
                                <div className="col-span-12 md:col-span-6 flex items-end">
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
                <Dropdown className="w-full !text-[12px]" placeholder="Select shift instance" disabled />
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
                <label htmlFor="signer" className="mb-1.5 block text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                    Signer display name
                </label>
                <InputText
                    id="signer"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full !text-[13px]"
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
