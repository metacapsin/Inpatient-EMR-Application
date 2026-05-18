import { useState } from 'react';
import { toast } from 'react-hot-toast';
import AppButton from '../../../components/ui/AppButton';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedInputNumber,
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { IoFlowsheetCalendar } from './IoFlowsheetCalendar';
import {
    IO_FLUID_FREE_TEXT,
    IO_FLUID_TYPES,
    IO_INTAKE_CATEGORIES,
    toSelectOptions,
} from '../constants/ioOptions';
import type { IoAddIntakePayload } from '../types/ioRecord.types';
import { appendEndTimeToNotes, inferShiftLabel } from '../utils/ioRecordMappers';
import { FlowsheetOutlinedTextarea } from './FlowsheetOutlinedTextarea';

const CARD_CLASS =
    'rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141210]';

type IoIntakeEntryFormProps = {
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordedBy: string;
    recordedByName: string;
    shift?: string;
    disabled?: boolean;
    onSubmit: (payload: IoAddIntakePayload) => Promise<void>;
    /** Renders fields only (no card shell) — for dialogs. */
    variant?: 'card' | 'embedded';
    onSaved?: () => void;
};

export function IoIntakeEntryForm({
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
}: IoIntakeEntryFormProps) {
    const [category, setCategory] = useState('');
    const [fluidType, setFluidType] = useState('');
    const [fluidFreeText, setFluidFreeText] = useState('');
    const [volumeMl, setVolumeMl] = useState<number | null>(null);
    const [ratePerHour, setRatePerHour] = useState<number | null>(null);
    const [bagRemaining, setBagRemaining] = useState<number | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(new Date());
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [volumeError, setVolumeError] = useState('');

    const showRate = category === 'IV Fluid';
    const fluidIsFreeText = fluidType === IO_FLUID_FREE_TEXT;
    const fluidOptions = [...toSelectOptions(IO_FLUID_TYPES), { label: IO_FLUID_FREE_TEXT, value: IO_FLUID_FREE_TEXT }];

    const resetForm = () => {
        setCategory('');
        setFluidType('');
        setFluidFreeText('');
        setVolumeMl(null);
        setRatePerHour(null);
        setBagRemaining(null);
        setStartTime(new Date());
        setEndTime(null);
        setNotes('');
        setVolumeError('');
    };

    const handleSubmit = async () => {
        if (!encounterId.trim()) {
            toast.error('Encounter required to document intake');
            return;
        }
        if (!category) {
            toast.error('Select a category');
            return;
        }
        if (!fluidType) {
            toast.error('Select a fluid type');
            return;
        }
        if (fluidIsFreeText && !fluidFreeText.trim()) {
            toast.error('Enter fluid type');
            return;
        }
        if (volumeMl == null || volumeMl <= 0) {
            setVolumeError('Volume (mL) is required');
            return;
        }
        if (!startTime) {
            toast.error('Start time is required');
            return;
        }

        const resolvedFluid = fluidIsFreeText ? fluidFreeText.trim() : fluidType;
        const payload: IoAddIntakePayload = {
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: category,
            fluidType: resolvedFluid,
            volumeMl,
            ratePerHour: showRate ? ratePerHour : null,
            bagVolumeRemaining: bagRemaining,
            recordedAt: startTime.toISOString(),
            shift: shift?.trim() || inferShiftLabel(startTime),
            notes: appendEndTimeToNotes(notes, endTime),
            recordedBy,
            recordedByName,
        };

        setSaving(true);
        try {
            await onSubmit(payload);
            toast.success('Intake recorded');
            resetForm();
            onSaved?.();
        } catch {
            toast.error('Failed to save intake');
        } finally {
            setSaving(false);
        }
    };

    const body = (
        <>
            <div className={NFS_SECTION_GRID_CLASS}>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="io-intake-record-type"
                        label="Record type"
                        value="Intake"
                        onChange={() => {}}
                        readOnly
                        disabled={disabled}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="io-intake-category"
                        label="Category"
                        options={toSelectOptions(IO_INTAKE_CATEGORIES)}
                        value={category}
                        onChange={(v) => setCategory(String(v))}
                        disabled={disabled}
                        required
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="io-intake-fluid"
                        label="Fluid type"
                        options={fluidOptions}
                        value={fluidType}
                        onChange={(v) => setFluidType(String(v))}
                        disabled={disabled}
                        required
                    />
                </div>
                {fluidIsFreeText ? (
                    <div className="col-span-12 md:col-span-4">
                        <FlowsheetOutlinedTextInput
                            fieldId="io-intake-fluid-free"
                            label="Fluid type (free text)"
                            value={fluidFreeText}
                            onChange={setFluidFreeText}
                            disabled={disabled}
                        />
                    </div>
                ) : null}
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedInputNumber
                        fieldId="io-intake-volume"
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
                {showRate ? (
                    <div className="col-span-12 md:col-span-4">
                        <FlowsheetOutlinedInputNumber
                            fieldId="io-intake-rate"
                            label="Rate (mL/hr)"
                            value={ratePerHour}
                            onValueChange={setRatePerHour}
                            disabled={disabled}
                            min={0}
                            suffix=" mL/hr"
                        />
                    </div>
                ) : null}
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedInputNumber
                        fieldId="io-intake-bag-remaining"
                        label="Bag volume remaining"
                        value={bagRemaining}
                        onValueChange={setBagRemaining}
                        disabled={disabled}
                        min={0}
                        suffix=" mL"
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <IoFlowsheetCalendar
                        fieldId="io-intake-start"
                        label="Start time"
                        value={startTime}
                        onChange={setStartTime}
                        disabled={disabled}
                        showTime
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <IoFlowsheetCalendar
                        fieldId="io-intake-end"
                        label="End time"
                        value={endTime}
                        onChange={setEndTime}
                        disabled={disabled}
                        showTime
                    />
                </div>
                <div className="col-span-12">
                    <FlowsheetOutlinedTextarea
                        fieldId="io-intake-notes"
                        label="Notes"
                        value={notes}
                        onChange={setNotes}
                        disabled={disabled}
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <AppButton type="button" onClick={handleSubmit} disabled={disabled || saving}>
                    {saving ? 'Saving…' : 'Add intake'}
                </AppButton>
            </div>
        </>
    );

    if (variant === 'embedded') {
        return body;
    }

    return (
        <section className={CARD_CLASS} aria-labelledby="io-intake-heading">
            <h4 id="io-intake-heading" className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Intake entry
            </h4>
            {body}
        </section>
    );
}
