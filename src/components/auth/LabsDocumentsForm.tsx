import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" has an invalid file type. Allowed: PDF, JPG, PNG.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds 10 MB. Please upload a smaller file.`;
  }
  return null;
}

interface FileUploadSectionProps {
  title: string;
  description: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  inputId: string;
}

function FileUploadSection({
  title,
  description,
  files,
  onFilesChange,
  inputId,
}: FileUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const valid: UploadedFile[] = [];
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
        } else {
          valid.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            name: file.name,
            size: file.size,
          });
        }
      }
      if (valid.length > 0) {
        onFilesChange([...files, ...valid]);
      }
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles?.length) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles?.length) {
        addFiles(selectedFiles);
      }
      e.target.value = '';
    },
    [addFiles]
  );

  return (
    <div className="flex flex-col space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center min-h-[100px] w-full rounded-lg border-2 border-dashed transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        )}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-1 py-4">
          <Upload className="w-8 h-8 text-gray-400" />
          <span className="text-sm text-gray-500">
            {isDragging ? 'Drop files here' : 'Drag and drop or click to upload'}
          </span>
          <span className="text-xs text-gray-400">PDF, JPG, PNG (max 10 MB each)</span>
        </div>
      </label>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{formatFileSize(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-700 flex-shrink-0"
              >
                <X className="w-4 h-4" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface LabsDocumentsFormProps {
  labReports: UploadedFile[];
  medicalDocuments: UploadedFile[];
  additionalNotes: string;
  onLabReportsChange: (files: UploadedFile[]) => void;
  onMedicalDocumentsChange: (files: UploadedFile[]) => void;
  onAdditionalNotesChange: (notes: string) => void;
}

export function LabsDocumentsForm({
  labReports,
  medicalDocuments,
  additionalNotes,
  onLabReportsChange,
  onMedicalDocumentsChange,
  onAdditionalNotesChange,
}: LabsDocumentsFormProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3">
        Labs & Documents
      </h3>
      <p className="text-sm text-gray-500">
        This step is optional. You may upload previous medical records to help your doctor understand
        your health history.
      </p>

      {/* SECTION 1 — Upload Lab Reports */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <FileUploadSection
          title="Upload Lab Reports"
          description="Blood tests, MRI scans, X-rays, CT scans, ultrasound reports"
          files={labReports}
          onFilesChange={onLabReportsChange}
          inputId="lab-reports-upload"
        />
      </div>

      {/* SECTION 2 — Upload Medical Documents */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <FileUploadSection
          title="Upload Medical Documents"
          description="Prescriptions, referral letters, discharge summaries, medical history"
          files={medicalDocuments}
          onFilesChange={onMedicalDocumentsChange}
          inputId="medical-documents-upload"
        />
      </div>

      {/* SECTION 3 — Additional Notes */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col space-y-1">
          <Label htmlFor="additionalNotes" className="text-sm font-semibold text-gray-800">
            Additional Notes
          </Label>
          <p className="text-xs text-gray-500">
            Optional notes for your doctor about your medical records or visit
          </p>
          <Textarea
            id="additionalNotes"
            value={additionalNotes}
            onChange={(e) => onAdditionalNotesChange(e.target.value)}
            placeholder="Add any notes you'd like your doctor to see..."
            rows={4}
            className="bg-gray-50 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
