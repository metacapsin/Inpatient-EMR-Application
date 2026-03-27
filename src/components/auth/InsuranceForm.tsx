import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { cn } from "@/lib/utils";
import { Upload, X } from "lucide-react";
import type { FormikProps } from "formik";

const hasInsuranceOptions = [
  { label: "Yes", value: "yes" },
  { label: "No (Self Pay)", value: "no" },
];

interface InsuranceFormProps {
  formik: FormikProps<any>;
  getFieldError: (fieldName: string) => string | undefined;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSelectChange: (fieldName: string, value: string) => void;
}

function FileUploadZone({
  onFileSelect,
  file,
  label,
  accept = "image/*",
}: {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  label: string;
  accept?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onFileSelect(droppedFile);
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm font-medium">{label}</Label>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center min-h-[110px] w-full rounded-lg border-2 border-dashed cursor-pointer transition",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        )}
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center gap-2 text-center p-3">
            <p className="text-sm font-medium truncate max-w-[160px]">
              {file.name}
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onFileSelect(null);
              }}
              className="text-xs text-primary flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <Upload className="w-7 h-7 text-gray-400" />
            <span className="text-sm text-gray-500">
              Drag & drop or click
            </span>
          </div>
        )}
      </label>
    </div>
  );
}

export function InsuranceForm({
  formik,
  getFieldError,
  handleInputChange,
  handleSelectChange,
}: InsuranceFormProps) {
  const [frontCard, setFrontCard] = useState<File | null>(null);
  const [backCard, setBackCard] = useState<File | null>(null);

  return (
    <div className="space-y-6">

      <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">
        Insurance Information
      </h3>

      {/* Has Insurance */}
      <div className="flex flex-col gap-1">
        <Label>Do you have health insurance? *</Label>

        <SearchableSelect
          value={formik.values.hasInsurance || ""}
          onValueChange={(value) => handleSelectChange("hasInsurance", value)}
          options={hasInsuranceOptions}
          placeholder="Select"
          triggerClassName={cn(
            "w-full max-w-xs bg-gray-50",
            getFieldError("hasInsurance") && "border-primary-600"
          )}
        />

        {getFieldError("hasInsurance") && (
          <p className="text-xs text-primary-600">
            {getFieldError("hasInsurance")}
          </p>
        )}
      </div>

      {formik.values.hasInsurance === "yes" && (
        <div className="bg-white border rounded-lg p-6 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Insurance Provider */}
            <div>
              <Label>Insurance Provider *</Label>
              <Input
                name="primaryInsuranceCompany"
                value={formik.values.primaryInsuranceCompany}
                onChange={handleInputChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "bg-gray-50",
                  getFieldError("primaryInsuranceCompany") && "border-primary-600"
                )}
              />
              {getFieldError("primaryInsuranceCompany") && (
                <p className="text-xs text-primary-600">
                  {getFieldError("primaryInsuranceCompany")}
                </p>
              )}
            </div>

            {/* Member ID */}
            <div>
              <Label>Member ID *</Label>
              <Input
                name="primarySubscriberId"
                value={formik.values.primarySubscriberId}
                onChange={handleInputChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "bg-gray-50",
                  getFieldError("primarySubscriberId") && "border-primary-600"
                )}
              />
              {getFieldError("primarySubscriberId") && (
                <p className="text-xs text-primary-600">
                  {getFieldError("primarySubscriberId")}
                </p>
              )}
            </div>

            {/* Group */}
            <div>
              <Label>Group Number</Label>
              <Input
                name="primaryGroupNumber"
                value={formik.values.primaryGroupNumber}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

            {/* Phone */}
            <div>
              <Label>Insurance Phone</Label>
              <Input
                type="tel"
                name="primaryCompanyPhone"
                value={formik.values.primaryCompanyPhone}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

            {/* Effective Date */}
            <div>
              <Label>Effective Date *</Label>
              <Input
                type="date"
                name="primaryEffectiveDate"
                value={formik.values.primaryEffectiveDate}
                onChange={handleInputChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "bg-gray-50",
                  getFieldError("primaryEffectiveDate") && "border-primary-600"
                )}
              />

              {getFieldError("primaryEffectiveDate") && (
                <p className="text-xs text-primary-600">
                  {getFieldError("primaryEffectiveDate")}
                </p>
              )}
            </div>

            {/* Termination */}
            <div>
              <Label>Termination Date</Label>
              <Input
                type="date"
                name="primaryTerminationDate"
                value={formik.values.primaryTerminationDate}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

            {/* Copay */}
            <div>
              <Label>Co-Pay Amount</Label>
              <Input
                type="number"
                name="primaryCoPay"
                value={formik.values.primaryCoPay}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

            {/* Medical Group */}
            <div>
              <Label>Medical Group / IPA</Label>
              <Input
                name="primaryMedicalGroup"
                value={formik.values.primaryMedicalGroup}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

            {/* PCP */}
            <div>
              <Label>Primary Care Physician (PCP)</Label>
              <Input
                name="primaryPcp"
                value={formik.values.primaryPcp}
                onChange={handleInputChange}
                className="bg-gray-50"
              />
            </div>

          </div>

          {/* Upload */}
          <div className="border-t pt-5 space-y-4">

            <h4 className="text-sm font-medium text-gray-700">
              Insurance Card Upload (Optional)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <FileUploadZone
                label="Upload Front of Card"
                file={frontCard}
                onFileSelect={setFrontCard}
              />

              <FileUploadZone
                label="Upload Back of Card"
                file={backCard}
                onFileSelect={setBackCard}
              />

            </div>
          </div>
        </div>
      )}

      {formik.values.hasInsurance === "no" && (
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <p className="text-gray-600">
            No insurance information required. Click Next to continue.
          </p>
        </div>
      )}
    </div>
  );
}