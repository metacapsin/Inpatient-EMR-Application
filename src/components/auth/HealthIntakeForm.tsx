import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Stethoscope, Heart, ClipboardList, Scissors } from 'lucide-react';
import type { FormikProps } from 'formik';

const severityOptions = Array.from({ length: 10 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

const rosConstitutionalOptions = [
  { label: 'Fever', value: 'Fever' },
  { label: 'Chills', value: 'Chills' },
  { label: 'Fatigue', value: 'Fatigue' },
  { label: 'Weight loss', value: 'Weight loss' },
  { label: 'Weight gain', value: 'Weight gain' },
  { label: 'Night sweats', value: 'Night sweats' },
  { label: 'Weakness', value: 'Weakness' },
];
const rosCardiovascularOptions = [
  { label: 'Chest pain', value: 'Chest pain' },
  { label: 'Palpitations', value: 'Palpitations' },
  { label: 'Edema', value: 'Edema' },
  { label: 'Shortness of breath', value: 'Shortness of breath' },
  { label: 'Dizziness', value: 'Dizziness' },
];
const rosRespiratoryOptions = [
  { label: 'Cough', value: 'Cough' },
  { label: 'Wheezing', value: 'Wheezing' },
  { label: 'Dyspnea', value: 'Dyspnea' },
  { label: 'Sputum', value: 'Sputum' },
  { label: 'Hemoptysis', value: 'Hemoptysis' },
];
const rosGastrointestinalOptions = [
  { label: 'Nausea', value: 'Nausea' },
  { label: 'Vomiting', value: 'Vomiting' },
  { label: 'Diarrhea', value: 'Diarrhea' },
  { label: 'Constipation', value: 'Constipation' },
  { label: 'Abdominal pain', value: 'Abdominal pain' },
  { label: 'Dysphagia', value: 'Dysphagia' },
];
const rosNeurologicalOptions = [
  { label: 'Headache', value: 'Headache' },
  { label: 'Dizziness', value: 'Dizziness' },
  { label: 'Numbness', value: 'Numbness' },
  { label: 'Tingling', value: 'Tingling' },
  { label: 'Seizures', value: 'Seizures' },
  { label: 'Vision changes', value: 'Vision changes' },
];
const rosMusculoskeletalOptions = [
  { label: 'Joint pain', value: 'Joint pain' },
  { label: 'Muscle weakness', value: 'Muscle weakness' },
  { label: 'Back pain', value: 'Back pain' },
  { label: 'Stiffness', value: 'Stiffness' },
  { label: 'Swelling', value: 'Swelling' },
];

const pastMedicalConditionsOptions = [
  { label: 'Hypertension', value: 'Hypertension' },
  { label: 'Diabetes', value: 'Diabetes' },
  { label: 'Asthma', value: 'Asthma' },
  { label: 'COPD', value: 'COPD' },
  { label: 'Heart disease', value: 'Heart disease' },
  { label: 'Thyroid disorder', value: 'Thyroid disorder' },
  { label: 'Anxiety/Depression', value: 'Anxiety/Depression' },
  { label: 'Arthritis', value: 'Arthritis' },
  { label: 'Cancer', value: 'Cancer' },
  { label: 'Kidney disease', value: 'Kidney disease' },
  { label: 'Liver disease', value: 'Liver disease' },
  { label: 'Other', value: 'Other' },
];

interface MultiSelectDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  triggerClassName?: string;
  hasError?: boolean;
  /** When true, renders dropdown in a portal to body to avoid clipping by overflow containers. */
  appendToBody?: boolean;
}

function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select',
  triggerClassName,
  hasError,
  appendToBody = false,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({
        left: rect.left,
        top: rect.top,
        width: rect.width,
      });
    }
  };

  useLayoutEffect(() => {
    if (open && appendToBody) {
      updatePosition();
    }
  }, [open, appendToBody]);

  useEffect(() => {
    if (!open || !appendToBody) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, appendToBody]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (appendToBody && portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [appendToBody]);

  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const displayText = value.length
    ? value
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(', ')
    : '';

  const dropdownContent = (
    <div
      ref={portalRef}
      className={cn(
        'z-[9999] max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg',
        appendToBody ? 'fixed' : 'absolute bottom-full left-0 mb-1'
      )}
      style={appendToBody ? { left: position.left, top: position.top - 4, width: position.width, transform: 'translateY(-100%)' } : undefined}
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-900">{opt.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50',
          hasError && 'border-primary-600',
          triggerClassName
        )}
      >
        <span className={cn(!displayText && 'text-muted-foreground')}>
          {displayText || placeholder}
        </span>
        <svg
          className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        (appendToBody
          ? createPortal(dropdownContent, document.body)
          : dropdownContent)}
    </div>
  );
}

type HealthIntakeFormikValues = {
  healthIntake: {
    chiefComplaint: {
      reasonForVisit: string;
      duration: string;
      severity: string;
      associatedSymptoms: string;
    };
    hpi: {
      onset: string;
      course: string;
      location: string;
      quality: string;
      radiation: string;
      aggravatingFactors: string;
      relievingFactors: string;
      previousEpisodes: string;
      previousEpisodesDescription: string;
      priorTreatment: string;
    };
    pastMedicalHistory: { conditions: string[]; other: string };
    ros: {
      constitutional: string[];
      cardiovascular: string[];
      respiratory: string[];
      gastrointestinal: string[];
      neurological: string[];
      musculoskeletal: string[];
    };
    surgicalHistory: { procedures: string };
  };
};

interface HealthIntakeFormProps {
  formik: FormikProps<HealthIntakeFormikValues>;
}

export function HealthIntakeForm({ formik }: HealthIntakeFormProps) {
  const hi = formik.values.healthIntake;
  const errors = formik.errors?.healthIntake as HealthIntakeFormikValues['healthIntake'] | undefined;
  const touched = formik.touched?.healthIntake as HealthIntakeFormikValues['healthIntake'] | undefined;

  const getError = (path: string): string | undefined => {
    const parts = path.split('.');
    let obj: any = errors;
    for (const p of parts) {
      obj = obj?.[p];
      if (typeof obj === 'string') return obj;
    }
    return undefined;
  };

  const getTouched = (path: string): boolean => {
    const parts = path.split('.');
    let obj: any = touched;
    for (const p of parts) {
      obj = obj?.[p];
      if (obj === true) return true;
    }
    return false;
  };

  return (
    <Accordion
      type="multiple"
      defaultValue={['chief-complaint', 'hpi', 'ros', 'past-medical', 'surgical']}
      className="w-full"
    >
      {/* 1. Chief Complaint */}
      <AccordionItem
        value="chief-complaint"
        className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm"
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Chief Complaint
          </h3>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1 lg:col-span-4">
              <Label htmlFor="reasonForVisit" className="text-sm font-medium mb-1">
                Reason For Visit <span className="text-primary-600">*</span>
              </Label>
              <Textarea
                id="reasonForVisit"
                name="healthIntake.chiefComplaint.reasonForVisit"
                value={hi.chiefComplaint.reasonForVisit}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  'bg-gray-50 min-h-[80px] w-full',
                  getTouched('chiefComplaint.reasonForVisit') && getError('chiefComplaint.reasonForVisit') && 'border-primary-600'
                )}
                placeholder="Describe your reason for visit"
              />
              {getTouched('chiefComplaint.reasonForVisit') && getError('chiefComplaint.reasonForVisit') && (
                <p className="text-xs text-primary-600 mt-1">{getError('chiefComplaint.reasonForVisit')}</p>
              )}
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="duration" className="text-sm font-medium mb-1">
                Duration
              </Label>
              <Input
                id="duration"
                name="healthIntake.chiefComplaint.duration"
                value={hi.chiefComplaint.duration}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
                placeholder="e.g. 2 weeks"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="severity" className="text-sm font-medium mb-1">
                Severity <span className="text-primary-600">*</span>
              </Label>
              <SearchableSelect
                value={hi.chiefComplaint.severity}
                onValueChange={(v) => formik.setFieldValue('healthIntake.chiefComplaint.severity', v)}
                options={severityOptions}
                placeholder="Select 1-10"
                side="top"
                triggerClassName={cn(
                  'w-full bg-gray-50 h-10',
                  getTouched('chiefComplaint.severity') && getError('chiefComplaint.severity') && 'border-primary-600'
                )}
              />
              {getTouched('chiefComplaint.severity') && getError('chiefComplaint.severity') && (
                <p className="text-xs text-primary-600 mt-1">{getError('chiefComplaint.severity')}</p>
              )}
            </div>
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label htmlFor="associatedSymptoms" className="text-sm font-medium mb-1">
                Associated Symptoms
              </Label>
              <Input
                id="associatedSymptoms"
                name="healthIntake.chiefComplaint.associatedSymptoms"
                value={hi.chiefComplaint.associatedSymptoms}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
                placeholder="Any associated symptoms"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 2. History of Present Illness */}
      <AccordionItem
        value="hpi"
        className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm"
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            History of Present Illness
          </h3>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="onset" className="text-sm font-medium mb-1">Onset</Label>
              <Input
                id="onset"
                name="healthIntake.hpi.onset"
                value={hi.hpi.onset}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="course" className="text-sm font-medium mb-1">Course</Label>
              <Input
                id="course"
                name="healthIntake.hpi.course"
                value={hi.hpi.course}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="location" className="text-sm font-medium mb-1">Location</Label>
              <Input
                id="location"
                name="healthIntake.hpi.location"
                value={hi.hpi.location}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="quality" className="text-sm font-medium mb-1">Quality</Label>
              <Input
                id="quality"
                name="healthIntake.hpi.quality"
                value={hi.hpi.quality}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="radiation" className="text-sm font-medium mb-1">Radiation</Label>
              <Input
                id="radiation"
                name="healthIntake.hpi.radiation"
                value={hi.hpi.radiation}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="aggravatingFactors" className="text-sm font-medium mb-1">Aggravating Factors</Label>
              <Input
                id="aggravatingFactors"
                name="healthIntake.hpi.aggravatingFactors"
                value={hi.hpi.aggravatingFactors}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="relievingFactors" className="text-sm font-medium mb-1">Relieving Factors</Label>
              <Input
                id="relievingFactors"
                name="healthIntake.hpi.relievingFactors"
                value={hi.hpi.relievingFactors}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="previousEpisodes" className="text-sm font-medium mb-1">Previous Episodes</Label>
              <Input
                id="previousEpisodes"
                name="healthIntake.hpi.previousEpisodes"
                value={hi.hpi.previousEpisodes}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label htmlFor="previousEpisodesDescription" className="text-sm font-medium mb-1">Previous Episodes Description</Label>
              <Input
                id="previousEpisodesDescription"
                name="healthIntake.hpi.previousEpisodesDescription"
                value={hi.hpi.previousEpisodesDescription}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label htmlFor="priorTreatment" className="text-sm font-medium mb-1">Prior Treatment</Label>
              <Input
                id="priorTreatment"
                name="healthIntake.hpi.priorTreatment"
                value={hi.hpi.priorTreatment}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 3. Review of Systems */}
      <AccordionItem
        value="ros"
        className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm"
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Review of Systems
          </h3>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Constitutional</Label>
              <MultiSelectDropdown
                value={hi.ros.constitutional}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.constitutional', v)}
                options={rosConstitutionalOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Cardiovascular</Label>
              <MultiSelectDropdown
                value={hi.ros.cardiovascular}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.cardiovascular', v)}
                options={rosCardiovascularOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Respiratory</Label>
              <MultiSelectDropdown
                value={hi.ros.respiratory}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.respiratory', v)}
                options={rosRespiratoryOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Gastrointestinal</Label>
              <MultiSelectDropdown
                value={hi.ros.gastrointestinal}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.gastrointestinal', v)}
                options={rosGastrointestinalOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Neurological</Label>
              <MultiSelectDropdown
                value={hi.ros.neurological}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.neurological', v)}
                options={rosNeurologicalOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-sm font-medium mb-1">Musculoskeletal</Label>
              <MultiSelectDropdown
                value={hi.ros.musculoskeletal}
                onChange={(v) => formik.setFieldValue('healthIntake.ros.musculoskeletal', v)}
                options={rosMusculoskeletalOptions}
                placeholder="Select"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 4. Past Medical History */}
      <AccordionItem
        value="past-medical"
        className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm"
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Past Medical History
          </h3>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label className="text-sm font-medium mb-1">Medical Conditions</Label>
              <MultiSelectDropdown
                value={hi.pastMedicalHistory.conditions}
                onChange={(v) => formik.setFieldValue('healthIntake.pastMedicalHistory.conditions', v)}
                options={pastMedicalConditionsOptions}
                placeholder="Select conditions"
                triggerClassName="w-full bg-gray-50 h-10"
                appendToBody
              />
            </div>
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label htmlFor="otherConditions" className="text-sm font-medium mb-1">Other Conditions</Label>
              <Input
                id="otherConditions"
                name="healthIntake.pastMedicalHistory.other"
                value={hi.pastMedicalHistory.other}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 h-10 w-full"
                placeholder="Other conditions not listed"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 5. Surgical History */}
      <AccordionItem
        value="surgical"
        className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm"
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Surgical History
          </h3>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-1 lg:col-span-4">
              <Label htmlFor="procedures" className="text-sm font-medium mb-1">Procedures</Label>
              <Textarea
                id="procedures"
                name="healthIntake.surgicalHistory.procedures"
                value={hi.surgicalHistory.procedures}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="bg-gray-50 min-h-[80px] w-full"
                placeholder="List any past surgical procedures"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
