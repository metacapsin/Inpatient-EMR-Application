import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import AppButton from '../../../components/ui/AppButton';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedInputNumber,
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { IoFlowsheetCalendar } from './IoFlowsheetCalendar';
import { GU_URINE_IO_EVENT, type GuUrineIoDetail } from '../clinical/guUrineBridge';
import { IO_COLOR_CONSISTENCY_OPTIONS, IO_OUTPUT_CATEGORIES, toSelectOptions } from '../constants/ioOptions';
import type { IoAddOutputPayload } from '../types/ioRecord.types';
import { inferShiftLabel } from '../utils/ioRecordMappers';
import { FlowsheetOutlinedTextarea } from './FlowsheetOutlinedTextarea';

const CARD_CLASS =
    'rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141210]';

type IoOutputEntryFormProps = {
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordedBy: string;
    recordedByName: string;
    shift?: string;
    disabled?: boolean;
    onSubmit: (payload: IoAddOutputPayload) => Promise<void>;
    variant?: 'card' | 'embedded';
    onSaved?: () => void;
};

export function IoOutputEntryForm({
    patientId,
    encounterId,
    tenantId,
    recordedBy,
    recordedByName,
    shift,
    disabled,
    onSubmit,
    variant = 'card',
    onSaved,
}: IoOutputEntryFormProps) {
    const [category, setCategory] = useState('');
    const [volumeMl, setVolumeMl] = useState<number | null>(null);
    const [colorConsistency, setColorConsistency] = useState('');
    const [device, setDevice] = useState('');
    const [recordedAt, setRecordedAt] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [volumeError, setVolumeError] = useState('');
    const [guHint, setGuHint] = useState<string | null>(null);

    useEffect(() => {
        const onGu = (ev: Event) => {
            const detail = (ev as CustomEvent<GuUrineIoDetail>).detail;
            if (!detail || detail.encounterId !== encounterId) return;
            if (detail.urineOutputLast4hMl > 0) {
                setCategory('Urine');
                const suggested = Math.round(detail.urineOutputLast4hMl / 4);
                setVolumeMl(suggested > 0 ? suggested : detail.urineOutputLast4hMl);
                if (detail.urineColor) {
                    const match = IO_COLOR_CONSISTENCY_OPTIONS.find(
                        (c) => c.toLowerCase() === detail.urineColor?.toLowerCase()
                    );
                    if (match) setColorConsistency(match);
                }
                if (detail.foleyPresent) setDevice('Foley catheter');
                setGuHint(`Prefilled from GU flowsheet (${detail.urineOutputLast4hMl} mL / 4h)`);
            }
        };
        window.addEventListener(GU_URINE_IO_EVENT, onGu);
        return () => window.removeEventListener(GU_URINE_IO_EVENT, onGu);
    }, [encounterId]);

    const resetForm = () => {
        setCategory('');
        setVolumeMl(null);
        setColorConsistency('');
        setDevice('');
        setRecordedAt(new Date());
        setNotes('');
        setVolumeError('');
        setGuHint(null);
    };

    const handleSubmit = async () => {
        if (!encounterId.trim()) {
            toast.error('Encounter required to document output');
            return;
        }
        if (!category) {
            toast.error('Select a category');
            return;
        }
        if (volumeMl == null || volumeMl <= 0) {
            setVolumeError('Volume (mL) is required');
            return;
        }
        if (!recordedAt) {
            toast.error('Time is required');
            return;
        }

        const payload: IoAddOutputPayload = {
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: category,
            volumeMl,
            colorConsistency: colorConsistency || undefined,
            device: device.trim() || undefined,
            recordedAt: recordedAt.toISOString(),
            shift: shift?.trim() || inferShiftLabel(recordedAt),
            notes: notes.trim() || undefined,
            recordedBy,
            recordedByName,
        };

        setSaving(true);
        try {
            await onSubmit(payload);
            toast.success('Output recorded');
            resetForm();
            onSaved?.();
        } catch {
            toast.error('Failed to save output');
        } finally {
            setSaving(false);
        }
    };

    const body = (
        <>
            {guHint ? <p className="mb-3 text-[11px] font-medium text-primary">{guHint}</p> : null}
            <div className={NFS_SECTION_GRID_CLASS}>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="io-output-record-type"
                        label="Record type"
                        value="Output"
                        onChange={() => {}}
                        readOnly
                        disabled={disabled}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="io-output-category"
                        label="Category"
                        options={toSelectOptions(IO_OUTPUT_CATEGORIES)}
                        value={category}
                        onChange={(v) => setCategory(String(v))}
                        disabled={disabled}
                        required
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedInputNumber
                        fieldId="io-output-volume"
                        label="Volume (mL)"
                        value={volumeMl}
                        onValueChange={(v) => {
                            setVolumeMl(v);
                            if (v != null && v > 0) setVolumeError('');
                        }}
                        disabled={disabled}
                        min={0}
                        suffix=" mL"
                        abnormal={Boolean(volumeError)}
                    />
                    {volumeError ? (
                        <p className="mt-1 text-[10px] font-medium text-red-700 dark:text-red-300" role="alert">
                            {volumeError}
                        </p>
                    ) : null}
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="io-output-color"
                        label="Color / consistency"
                        options={toSelectOptions(IO_COLOR_CONSISTENCY_OPTIONS)}
                        value={colorConsistency}
                        onChange={(v) => setColorConsistency(String(v))}
                        disabled={disabled}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="io-output-device"
                        label="Device"
                        value={device}
                        onChange={setDevice}
                        disabled={disabled}
                        placeholder="e.g. Foley catheter"
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <IoFlowsheetCalendar
                        fieldId="io-output-time"
                        label="Time"
                        value={recordedAt}
                        onChange={setRecordedAt}
                        disabled={disabled}
                        showTime
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="io-output-recorded-by"
                        label="Recorded by"
                        value={recordedByName}
                        onChange={() => {}}
                        readOnly
                        disabled
                    />
                </div>
                <div className="col-span-12">
                    <FlowsheetOutlinedTextarea
                        fieldId="io-output-notes"
                        label="Notes"
                        value={notes}
                        onChange={setNotes}
                        disabled={disabled}
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <AppButton type="button" onClick={handleSubmit} disabled={disabled || saving}>
                    {saving ? 'Saving…' : 'Add output'}
                </AppButton>
            </div>
        </>
    );

    if (variant === 'embedded') {
        return body;
    }

    return (
        <section className={CARD_CLASS} aria-labelledby="io-output-heading">
            <h4 id="io-output-heading" className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                Output entry
            </h4>
            {body}
        </section>
    );
}
