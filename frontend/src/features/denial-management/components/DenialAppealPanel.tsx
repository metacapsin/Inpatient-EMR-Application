import { useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { InputNumber } from 'primereact/inputnumber';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import type { UploadedFile } from '../../../components/auth/LabsDocumentsForm';
import { FileUploadSection, formatFileSize } from '../../../components/auth/LabsDocumentsForm';
import type { ClaimDenialRecord, DenialAppeal } from '../types/denial.types';
import { APPEAL_LEVELS, APPEAL_OUTCOMES, APPEAL_TYPES, emptyDenialAppeal } from '../types/denial.types';
import { DenialRichTextEditor } from './DenialRichTextEditor';

type Props = {
    open: boolean;
    row: ClaimDenialRecord | null;
    mode: 'view' | 'appeal';
    submittedByName: string;
    busy: boolean;
    onClose: () => void;
    onSaveAppeal: (appeal: DenialAppeal) => Promise<boolean>;
};

function parseDate(iso: string): Date | null {
    if (!iso?.trim()) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date | null): string {
    return d ? d.toISOString().slice(0, 10) : '';
}

export function DenialAppealPanel({ open, row, mode, submittedByName, busy, onClose, onSaveAppeal }: Props) {
    const [appeal, setAppeal] = useState<DenialAppeal>(() => emptyDenialAppeal(submittedByName));
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const readOnly = mode === 'view';

    useEffect(() => {
        if (!row) return;
        const base = { ...emptyDenialAppeal(submittedByName), ...row.appeal };
        if (!base.submittedBy) base.submittedBy = submittedByName;
        setAppeal(base);
        setFiles(
            base.supportingClinicalDocuments.map((name, i) => ({
                id: `mock-${i}`,
                file: new File([], name),
                name,
                size: 0,
            }))
        );
    }, [row, submittedByName]);

    const patch = (p: Partial<DenialAppeal>) => setAppeal((a) => ({ ...a, ...p }));

    const handleSave = async () => {
        const docNames = files.map((f) => f.name);
        const letterS3 =
            appeal.appealLetter.trim() && !appeal.letterS3Upload
                ? `s3://mock-emr-appeals/${row?.denialId ?? 'new'}/letter-${Date.now()}.html`
                : appeal.letterS3Upload;
        const ok = await onSaveAppeal({
            ...appeal,
            supportingClinicalDocuments: docNames,
            letterS3Upload: letterS3,
            submittedBy: appeal.submittedBy || submittedByName,
        });
        if (ok) toast.success('Appeal saved');
    };

    const levelOptions = APPEAL_LEVELS.map((l) => ({ label: l, value: l }));
    const typeOptions = APPEAL_TYPES.map((t) => ({ label: t, value: t }));
    const outcomeOptions = APPEAL_OUTCOMES.map((o) => ({ label: o, value: o }));

    return (
        <Sidebar
            visible={open}
            position="right"
            onHide={onClose}
            className="w-[min(100vw,520px)] !max-w-[100vw] border-l border-gray-200/90 shadow-2xl dark:border-white/10"
            header={
                <div className="flex flex-col gap-0.5 pr-6">
                    <span className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">
                        {mode === 'appeal' ? 'Appeal workflow' : 'Denial detail'}
                    </span>
                    {row ? (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {row.claimNumber} · {row.patientName}
                        </span>
                    ) : null}
                </div>
            }
            pt={{ content: { className: '!m-0 !overflow-y-auto !p-4' } }}
        >
            {row ? (
                <div className={NFS_SECTION_GRID_CLASS}>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetLabeledDropdown
                            fieldId="appeal-level"
                            label="Appeal Level"
                            options={levelOptions}
                            value={appeal.appealLevel}
                            onChange={(v) => patch({ appealLevel: String(v) as DenialAppeal['appealLevel'] })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetLabeledDropdown
                            fieldId="appeal-type"
                            label="Appeal Type"
                            options={typeOptions}
                            value={appeal.appealType}
                            onChange={(v) => patch({ appealType: String(v) as DenialAppeal['appealType'] })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12">
                        <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Supporting Clinical Documents
                        </label>
                        {readOnly ? (
                            <ul className="text-xs text-gray-700 dark:text-gray-300">
                                {appeal.supportingClinicalDocuments.length === 0
                                    ? '—'
                                    : appeal.supportingClinicalDocuments.map((n) => (
                                          <li key={n}>{n}</li>
                                      ))}
                            </ul>
                        ) : (
                            <FileUploadSection
                                title="Upload documents"
                                description="PDF, JPG, or PNG up to 10 MB (mock upload)"
                                files={files}
                                onFilesChange={setFiles}
                                inputId="denial-appeal-docs"
                            />
                        )}
                    </div>
                    <div className="col-span-12">
                        <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Appeal Letter
                        </label>
                        {readOnly ? (
                            <div
                                className="prose prose-sm max-w-none rounded-md border border-gray-200 p-3 text-sm dark:border-white/10 dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: appeal.appealLetter || '<p>—</p>' }}
                            />
                        ) : (
                            <DenialRichTextEditor
                                value={appeal.appealLetter}
                                onChange={(html) => patch({ appealLetter: html })}
                                disabled={busy}
                            />
                        )}
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextInput
                            fieldId="letter-s3"
                            label="Letter S3 Upload"
                            value={appeal.letterS3Upload}
                            onChange={() => {}}
                            disabled
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedCalendar
                            fieldId="submitted-date"
                            label="Submitted Date"
                            value={parseDate(appeal.submittedDate)}
                            onChange={(d) => patch({ submittedDate: toIsoDate(d) })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="submitted-by"
                            label="Submitted By"
                            value={appeal.submittedBy || submittedByName}
                            onChange={() => {}}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextInput
                            fieldId="payer-ref"
                            label="Payer Reference Number"
                            value={appeal.payerReferenceNumber}
                            onChange={(v) => patch({ payerReferenceNumber: v })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedCalendar
                            fieldId="expected-response"
                            label="Expected Response Date"
                            value={parseDate(appeal.expectedResponseDate)}
                            onChange={(d) => patch({ expectedResponseDate: toIsoDate(d) })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetLabeledDropdown
                            fieldId="outcome"
                            label="Outcome"
                            options={outcomeOptions}
                            value={appeal.outcome}
                            onChange={(v) => patch({ outcome: String(v) as DenialAppeal['outcome'] })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedCalendar
                            fieldId="outcome-date"
                            label="Outcome Date"
                            value={parseDate(appeal.outcomeDate)}
                            onChange={(d) => patch({ outcomeDate: toIsoDate(d) })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Approved Amount
                        </label>
                        <InputNumber
                            value={appeal.approvedAmount}
                            onValueChange={(e) => patch({ approvedAmount: e.value ?? 0 })}
                            mode="currency"
                            currency="USD"
                            locale="en-US"
                            className="w-full"
                            inputClassName="w-full"
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Write-Off Amount
                        </label>
                        <InputNumber
                            value={appeal.writeOffAmount}
                            onValueChange={(e) => patch({ writeOffAmount: e.value ?? 0 })}
                            mode="currency"
                            currency="USD"
                            locale="en-US"
                            className="w-full"
                            inputClassName="w-full"
                            disabled={readOnly || busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="writeoff-approved-by"
                            label="Write-Off Approved By"
                            value={appeal.writeOffApprovedBy}
                            onChange={(v) => patch({ writeOffApprovedBy: v })}
                            disabled={readOnly || busy}
                        />
                    </div>
                    {files.length > 0 && readOnly ? (
                        <div className="col-span-12 text-[10px] text-gray-500">
                            {files.map((f) => (
                                <span key={f.id}>
                                    {f.name}
                                    {f.size ? ` (${formatFileSize(f.size)})` : ''}{' '}
                                </span>
                            ))}
                        </div>
                    ) : null}
                    {!readOnly ? (
                        <div className="col-span-12 flex gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={() => void handleSave()} disabled={busy}>
                                Save appeal
                            </Button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Sidebar>
    );
}
