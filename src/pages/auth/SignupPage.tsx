import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { User, BookOpen, Calendar, CheckCircle2, ChevronRight, ChevronLeft, Shield, FileText } from 'lucide-react';
import { setToken, setUser, setRole, setPatientData, logout } from '@/store/authSlice';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'sonner';
import api, { patientAPI, commonAPI, settingsAPI } from '@/services/api';
import { HealthIntakeForm } from '@/components/auth/HealthIntakeForm';
import { InsuranceForm } from '@/components/auth/InsuranceForm';
import { LabsDocumentsForm, formatFileSize, type UploadedFile } from '@/components/auth/LabsDocumentsForm';
import { BookAppointmentStep, type AppointmentData } from '@/components/auth/BookAppointmentStep';
interface FormData {
  // 1. Personal Information
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  email: string;
  workEmail: string;

  // 2. Home Address
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;

  // 3. Mailing Address
  mailingSameAsHome: boolean;
  mailingAddress1: string;
  mailingAddress2: string;
  mailingCity: string;
  mailingState: string;
  mailingZipCode: string;

  // 4. Contact Information
  homePhone: string;
  mobilePhone: string;
  workPhone: string;
  otherPhone: string;

  // 5. Additional Demographics
  advanceDirective: string;
  language: string;
  ethnicity: string;
  race: string;
  privacyPracticesDate: string;
  countryOfBirth: string;
  hasInsurance: string; // "yes" | "no"
  hasSecondaryInsurance: string; // "yes" | "no"

  // 6. Primary Insurance
  primaryInsuranceType: string;
  primaryInsuranceCompany: string;
  primarySubscriberId: string;
  primaryInsurancePlan: string;
  primaryGroupNumber: string;
  primaryCompanyPhone: string;
  primaryEffectiveDate: string;
  primaryTerminationDate: string;
  primaryStatus: string;
  primaryGuarantor: string;
  primaryGuarantorName: string;
  primaryGuarantorDOB: string;
  primaryCoPay: string;
  primaryMedicalGroup: string;
  primaryPcp: string;

  // 7. Secondary Insurance
  secondaryInsuranceType: string;
  secondaryInsuranceCompany: string;
  secondarySubscriberId: string;
  secondaryInsurancePlan: string;
  secondaryGroupNumber: string;
  secondaryCompanyPhone: string;
  secondaryEffectiveDate: string;
  secondaryTerminationDate: string;
  secondaryStatus: string;
  secondaryGuarantor: string;
  secondaryGuarantorName: string;
  secondaryGuarantorDOB: string;
  secondaryCoPay: string;
  secondaryMedicalGroup: string;
  secondaryPcp: string;

  // 8. Emergency Contact
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  emergencyAddress: string;
  emergencyCity: string;
  emergencyState: string;
  emergencyZip: string;

  // Review & Submit consent
  acknowledgeNoticeOfPrivacyPractices: boolean;

  // Appointment (Step 5 - Book Appointment)
  appointment: AppointmentData;

  // Health Intake
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
    pastMedicalHistory: {
      conditions: string[];
      other: string;
    };
    ros: {
      constitutional: string[];
      cardiovascular: string[];
      respiratory: string[];
      gastrointestinal: string[];
      neurological: string[];
      musculoskeletal: string[];
    };
    surgicalHistory: {
      procedures: string;
    };
  };
}
 const advancedHealthCareDirectiveList: any = [
    {
      label: 'Not Applicable (under 18)',
      value: 'Not Applicable (under 18)',
    },
    {
      label: 'No Advance Directive',
      value: 'No Advance Directive',
    },
    {
      label: 'Not Completed',
      value: 'Not Completed',
    },
    {
      label: 'In Progress',
      value: 'In Progress',
    },
    {
      label: 'Completed - Copy Available',
      value: 'Completed Copy Available',
    },
    {
      label: 'Completed - Copy Not Available',
      value: 'Completed Copy Not Available',
    },
    {
      label: 'Declined to Provide',
      value: 'Declined to Provide',
    },
  ];
  const MaritalList = [
    { label: 'Single', value: 'Single' },
    { label: 'Married', value: 'Married' },
    { label: 'Legally Separated', value: 'Legally Separated' },
    { label: 'Domestic Partner', value: 'Domestic Partner' },
    { label: 'Widowed', value: 'Widowed' },
    { label: 'Divorced', value: 'Divorced' },
    { label: 'Other', value: 'Other' },
  ];

  const relationshipToPatientList = [
    { label: 'Self', value: 'Self' },
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Child', value: 'Child' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Sibling', value: 'Sibling' },
    { label: 'Other', value: 'Other' },
  ];

  const prefixes = [
    { label: 'Mrs.', value: 'Mrs.' },
    { label: 'Mr.', value: 'Mr.' },
    { label: 'Ms.', value: 'Ms.' },
    { label: 'Miss', value: 'Miss' },
    { label: 'Prof.', value: 'Prof.' },
    { label: 'Dr.', value: 'Dr.' },
    { label: 'Gen.', value: 'Gen.' },
    { label: 'Rep.', value: 'Rep.' },
    { label: 'Sen.', value: 'Sen.' },
  ];

  const suffixes = [
    { label: 'Jr.', value: 'Jr.' },
    { label: 'Sr.', value: 'Sr.' },
    { label: 'II', value: 'II' },
    { label: 'III', value: 'III' },
    { label: 'IV', value: 'IV' },
    { label: 'V', value: 'V' },
    { label: 'PhD', value: 'PhD' },
    { label: 'MD', value: 'MD' },
    { label: 'DDS', value: 'DDS' },
    { label: 'Esq.', value: 'Esq.' },
    { label: 'CPA', value: 'CPA' },
  ];

  const yesNoOptions = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ];

  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
  ];

  const countryOfBirthOptions = [
    { label: 'USA', value: 'usa' },
    { label: 'Other', value: 'other' },
  ];

  const guarantorOptions = [
    { label: 'Self', value: 'self' },
    { label: 'Spouse', value: 'spouse' },
  ];

  const insuranceTypesList = [
    { label: 'HMO (Health Maintenance Organization)', value: 'HMO (Health Maintenance Organization)' },
    { label: 'PPO (Preferred Provider Organization)', value: 'PPO (Preferred Provider Organization)' },
    { label: 'EPO (Exclusive Provider Organization)', value: 'EPO (Exclusive Provider Organization)' },
    { label: 'POS (Point of Service Plan)', value: 'POS (Point of Service Plan)' },
    { label: 'HDHP (High Deductible Health Plan)', value: 'HDHP (High Deductible Health Plan)' },
    { label: 'Commercial', value: 'Commercial' },
    { label: 'Medicare', value: 'Medicare' },
    { label: 'Medicare Advantage (Part C)', value: 'Medicare Advantage (Part C)' },
    { label: 'Medicaid / Medi-Cal', value: 'Medicaid / Medi-Cal' },
    { label: 'Tricare', value: 'Tricare' },
    { label: 'CHIP (Children’s Health Insurance Program)', value: 'CHIP (Children’s Health Insurance Program)' },
    { label: 'Workers’ Compensation', value: 'Workers’ Compensation' },
    { label: 'Self-Funded / Self-Insured Plan', value: 'Self-Funded / Self-Insured Plan' },
    { label: 'Catastrophic Health Insurance', value: 'Catastrophic Health Insurance' },
    { label: 'Indemnity / Fee-for-Service', value: 'Indemnity / Fee-for-Service' },
    { label: 'Supplemental Insurance', value: 'Supplemental Insurance' },
  ];

  const insurancePlansList = [
    { label: 'Individual', value: 'INDIVIDUAL' },
    { label: 'Group', value: 'GROUP' },
    { label: 'Family', value: 'FAMILY' },
  ];

  const insuranceStatusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
  ];
// Yup Validation Schema with Regex Patterns
const validationSchema = Yup.object().shape({
  // Personal Information
  firstName: Yup.string()
    .required('First name is required')
    .min(3, 'First name must be at least 3 characters')
    .max(35, 'First name must not exceed 35 characters')
    .matches(/^(?! )[A-Za-z&/().–,'']+( [A-Za-z&/().–,'']+)*$/, 'First name contains invalid characters'),
  
  middleName: Yup.string()
    .test('min-length', 'Middle name must be at least 1 character', function(value) {
      if (!value || value.trim().length === 0) return true; // Optional field
      return value.trim().length >= 1;
    })
    .max(35, 'Middle name must not exceed 35 characters')
    .matches(/^(?! )[A-Za-z&/().–,'']+( [A-Za-z&/().–,'']+)*$|^$/, 'Middle name contains invalid characters'),
  
  lastName: Yup.string()
    .required('Last name is required')
    .min(3, 'Last name must be at least 3 characters')
    .max(35, 'Last name must not exceed 35 characters')
    .matches(/^(?! )[A-Za-z&/().–,'']+( [A-Za-z&/().–,'']+)*$/, 'Last name contains invalid characters'),
  
  dob: Yup.string()
    .required('Date of birth is required')
    .test('valid-date', 'Date of birth cannot be in the future', function(value) {
      if (!value) return false;
      const date = new Date(value);
      return date <= new Date();
    }),
  
  gender: Yup.string().required('Gender is required'),
  maritalStatus: Yup.string().required('Marital status is required'),
  
  email: Yup.string()
    .required('Email is required')
    .matches(/^(?!\s)([a-z0-9]+([._%+-]?[a-z0-9]+)*)@[a-z0-9.-]+\.[a-z]{2,}$/i, 'Invalid email format'),
  
  workEmail: Yup.string()
    .matches(/^(?!\s)([a-z0-9]+([._%+-]?[a-z0-9]+)*)@[a-z0-9.-]+\.[a-z]{2,}$/i, 'Invalid work email format'),

  // Home Address
  address1: Yup.string()
    .required('Address is required')
    .min(1, 'Address must be at least 1 character')
    .max(250, 'Address must not exceed 250 characters'),
  
  address2: Yup.string()
    .test('min-length', 'Address 2 must be at least 1 character', function(value) {
      if (!value || value.trim().length === 0) return true; // Optional field
      return value.trim().length >= 1;
    })
    .max(250, 'Address 2 must not exceed 250 characters'),
  
  city: Yup.string()
    .required('City is required')
    .min(3, 'City must be at least 3 characters')
    .max(50, 'City must not exceed 50 characters')
    .matches(/^(?! )[A-Za-z.'-]+(?: [A-Za-z.'-]+)*(?<! )$/, 'City contains invalid characters'),
  
  state: Yup.string().required('State is required'),
  
  zipCode: Yup.string()
    .required('Zip code is required')
    .matches(/^[0-9]+$/, 'Zip code must contain only digits')
    .min(5, 'Zip code must be exactly 5 digits')
    .max(5, 'Zip code must be exactly 5 digits'),

  // Mailing Address (conditional validation)
  mailingAddress1: Yup.string()
    .when('mailingSameAsHome', {
      is: false,
      then: (schema) => schema
        .test('min-length', 'Address must be at least 1 character', function(value) {
          if (!value || value.trim().length === 0) return true; // Optional but validate if provided
          return value.trim().length >= 1;
        })
        .max(250, 'Address must not exceed 250 characters'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  mailingAddress2: Yup.string()
    .when('mailingSameAsHome', {
      is: false,
      then: (schema) => schema
        .test('min-length', 'Address 2 must be at least 1 character', function(value) {
          if (!value || value.trim().length === 0) return true;
          return value.trim().length >= 1;
        })
        .max(250, 'Address 2 must not exceed 250 characters'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  mailingCity: Yup.string()
    .when('mailingSameAsHome', {
      is: false,
      then: (schema) => schema
        .min(3, 'City must be at least 3 characters')
        .max(50, 'City must not exceed 50 characters')
        .matches(/^(?! )[A-Za-z.'-]+(?: [A-Za-z.'-]+)*(?<! )$|^$/, 'City contains invalid characters'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  mailingState: Yup.string(),
  
  mailingZipCode: Yup.string()
    .when('mailingSameAsHome', {
      is: false,
      then: (schema) => schema
        .matches(/^[0-9]*$/, 'Zip code must contain only digits')
        .test('zip-length', 'Zip code must be exactly 5 digits', function(value) {
          if (!value || value.trim().length === 0) return true;
          return value.length === 5;
        }),
      otherwise: (schema) => schema.notRequired(),
    }),

  // Contact Information
  homePhone: Yup.string()
    .required('Home phone is required')
    .matches(/^[0-9 ()–-]+$/, 'Phone number contains invalid characters')
    .test('phone-length', 'Phone number must be exactly 14 characters', function(value) {
      if (!value) return false;
      return value.replace(/[^0-9]/g, '').length >= 10; // At least 10 digits
    }),
  
  mobilePhone: Yup.string()
    .matches(/^[0-9 ()–-]*$|^$/, 'Mobile phone contains invalid characters')
    .test('phone-length', 'Mobile phone must be at least 10 digits', function(value) {
      if (!value || value.trim().length === 0) return true;
      return value.replace(/[^0-9]/g, '').length >= 10;
    }),
  
  workPhone: Yup.string()
    .matches(/^[0-9 ()–-]*$|^$/, 'Work phone contains invalid characters')
    .test('phone-length', 'Work phone must be at least 10 digits', function(value) {
      if (!value || value.trim().length === 0) return true;
      return value.replace(/[^0-9]/g, '').length >= 10;
    }),
  
  otherPhone: Yup.string()
    .matches(/^[0-9 ()–-]*$|^$/, 'Other phone contains invalid characters')
    .test('phone-length', 'Other phone must be at least 10 digits', function(value) {
      if (!value || value.trim().length === 0) return true;
      return value.replace(/[^0-9]/g, '').length >= 10;
    }),

  // Emergency Contact
  emergencyName: Yup.string()
    .required('Emergency contact name is required')
    .min(3, 'Emergency contact name must be at least 3 characters')
    .max(35, 'Emergency contact name must not exceed 35 characters')
    .matches(/^(?! )[A-Za-z&/().–,'']+( [A-Za-z&/().–,'']+)*$/, 'Emergency contact name contains invalid characters'),
  
  emergencyRelation: Yup.string().required('Emergency contact relationship is required'),
  
  emergencyPhone: Yup.string()
    .matches(/^[0-9 ()–-]*$|^$/, 'Emergency phone contains invalid characters')
    .test('phone-length', 'Emergency phone must be at least 10 digits', function(value) {
      if (!value || value.trim().length === 0) return true;
      return value.replace(/[^0-9]/g, '').length >= 10;
    }),
  
  emergencyAddress: Yup.string()
    .max(250, 'Emergency address must not exceed 250 characters'),
  
  emergencyCity: Yup.string()
    .min(3, 'Emergency city must be at least 3 characters')
    .max(50, 'Emergency city must not exceed 50 characters')
    .matches(/^(?! )[A-Za-z.'-]+(?: [A-Za-z.'-]+)*(?<! )$|^$/, 'Emergency city contains invalid characters'),
  
  emergencyZip: Yup.string()
    .matches(/^[0-9]*$|^$/, 'Emergency zip code must contain only digits')
    .test('zip-length', 'Emergency zip code must be exactly 5 digits', function(value) {
      if (!value || value.trim().length === 0) return true;
      return value.length === 5;
    }),

  // Health Intake
  healthIntake: Yup.object().shape({
    chiefComplaint: Yup.object().shape({
      reasonForVisit: Yup.string().required('Reason for visit is required'),
      severity: Yup.string().required('Severity is required'),
    }),
  }),

  // Insurance step - hasInsurance (required when on Insurance step)
  hasInsurance: Yup.string()
    .oneOf(['yes', 'no'], 'Please select an option')
    .required('Do you have health insurance? is required'),

  // Primary Insurance - only Insurance Provider and Member ID required when hasInsurance=yes
  primaryInsuranceCompany: Yup.string().when('hasInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Insurance Provider is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  primarySubscriberId: Yup.string().when('hasInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Member ID is required'),
    otherwise: (schema) => schema.notRequired(),
  }),

  primaryInsuranceType: Yup.string(),
  primaryInsurancePlan: Yup.string(),
  primaryGroupNumber: Yup.string(),
  
  primaryCompanyPhone: Yup.string()
    .when('hasInsurance', {
      is: 'yes',
      then: (schema) => schema
        .matches(/^[0-9 ()–-]*$|^$/, 'Phone contains invalid characters')
        .test('phone-length', 'Phone must be at least 10 digits', function(value) {
          if (!value || value.trim().length === 0) return true;
          return value.replace(/[^0-9]/g, '').length >= 10;
        }),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  primaryCoPay: Yup.string()
    .matches(/^(\d+(\.\d{1,2})?)?$|^$/, 'Co-pay must be a valid number'),
  primaryMedicalGroup: Yup.string(),
  primaryPcp: Yup.string(),
  primaryEffectiveDate: Yup.string(),
  primaryStatus: Yup.string(),

  primaryGuarantorName: Yup.string()
    .when('hasInsurance', {
      is: 'yes',
      then: (schema) => schema.max(100, 'Policy holder name must not exceed 100 characters'),
      otherwise: (schema) => schema.notRequired(),
    }),

  primaryGuarantorDOB: Yup.string(),

  // Secondary Insurance (conditional validation)
  secondaryInsuranceType: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary insurance type is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  secondaryInsuranceCompany: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary insurance company is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  secondarySubscriberId: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary subscriber ID is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  secondaryInsurancePlan: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary insurance plan is required'),
    otherwise: (schema) => schema.notRequired(),
  }),

  secondaryGroupNumber: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary group number is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  secondaryCompanyPhone: Yup.string()
    .when('hasSecondaryInsurance', {
      is: 'yes',
      then: (schema) => schema
        .required('Secondary company phone is required')
        .matches(/^[0-9 ()–-]+$/, 'Company phone contains invalid characters')
        .test('phone-length', 'Company phone must be at least 10 digits', function(value) {
          if (!value || value.trim().length === 0) return false;
          return value.replace(/[^0-9]/g, '').length >= 10;
        }),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  secondaryCoPay: Yup.string()
    .when('hasSecondaryInsurance', {
      is: 'yes',
      then: (schema) => schema
        .matches(/^(\d+(\.\d{1,2})?)?$/, 'Co-pay must be a valid number with up to 2 decimal places'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  secondaryMedicalGroup: Yup.string()
    .when('hasSecondaryInsurance', {
      is: 'yes',
      then: (schema) => schema
        .matches(/^(?! )[a-zA-Z0-9\-&. ]{2,100}(?<! )$|^$/, 'Medical group contains invalid characters')
        .min(2, 'Medical group must be at least 2 characters')
        .max(100, 'Medical group must not exceed 100 characters'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  secondaryPcp: Yup.string()
    .when('hasSecondaryInsurance', {
      is: 'yes',
      then: (schema) => schema
        .min(2, 'PCP name must be at least 2 characters')
        .max(100, 'PCP name must not exceed 100 characters'),
      otherwise: (schema) => schema.notRequired(),
    }),
  
  secondaryEffectiveDate: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary effective date is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  
  secondaryStatus: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary insurance status is required'),
    otherwise: (schema) => schema.notRequired(),
  }),

  secondaryGuarantorName: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema
      .required('Secondary guarantor name is required')
      .min(2, 'Guarantor name must be at least 2 characters')
      .max(100, 'Guarantor name must not exceed 100 characters'),
    otherwise: (schema) => schema.notRequired(),
  }),

  secondaryGuarantorDOB: Yup.string().when('hasSecondaryInsurance', {
    is: 'yes',
    then: (schema) => schema.required('Secondary guarantor date of birth is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
});
  
const steps = [
  { id: 1, title: 'Personal Information', icon: User, description: 'Personal & Contact Details' },
  { id: 2, title: 'Health Intake', icon: BookOpen, description: 'Health History & Chief Complaint' },
  { id: 3, title: 'Insurance Information', icon: Shield, description: 'Insurance Details' },
  { id: 4, title: 'Labs & Documents', icon: FileText, description: 'Medical Records (Optional)' },
  { id: 5, title: 'Book Appointment', icon: Calendar, description: 'Schedule Your First Visit' },
  { id: 6, title: 'Review & Submit', icon: CheckCircle2, description: 'Verify & Submit' }
];

// Field keys per step - used to only block Next Step on current step's validation errors (ignore hidden steps)
const STEP_1_FIELD_KEYS = new Set([
  'firstName', 'middleName', 'lastName', 'dob', 'gender', 'maritalStatus', 'email', 'workEmail',
  'address1', 'address2', 'city', 'state', 'zipCode',
  'mailingAddress1', 'mailingAddress2', 'mailingCity', 'mailingState', 'mailingZipCode',
  'homePhone', 'mobilePhone', 'workPhone', 'otherPhone',
  'emergencyName', 'emergencyRelation', 'emergencyPhone', 'emergencyAddress', 'emergencyCity', 'emergencyState', 'emergencyZip'
]);
const STEP_3_FIELD_KEYS = new Set([
  'hasInsurance', 'hasSecondaryInsurance',
  'primaryInsuranceType', 'primaryInsuranceCompany', 'primarySubscriberId', 'primaryInsurancePlan', 'primaryGroupNumber',
  'primaryCompanyPhone', 'primaryEffectiveDate', 'primaryTerminationDate', 'primaryStatus', 'primaryGuarantor',
  'primaryGuarantorName', 'primaryGuarantorDOB', 'primaryCoPay', 'primaryMedicalGroup', 'primaryPcp',
  'secondaryInsuranceType', 'secondaryInsuranceCompany', 'secondarySubscriberId', 'secondaryInsurancePlan',
  'secondaryGroupNumber', 'secondaryCompanyPhone', 'secondaryEffectiveDate', 'secondaryTerminationDate', 'secondaryStatus',
  'secondaryGuarantor', 'secondaryGuarantorName', 'secondaryGuarantorDOB', 'secondaryCoPay', 'secondaryMedicalGroup', 'secondaryPcp'
]);

/** Returns only validation errors for the given step so hidden/other-step fields don't block navigation. */
function getErrorsForStep(errors: Record<string, unknown>, step: number): Record<string, unknown> {
  if (!errors || typeof errors !== 'object') return {};
  if (step === 1) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(errors)) {
      if (STEP_1_FIELD_KEYS.has(key)) out[key] = errors[key];
    }
    return out;
  }
  if (step === 2) {
    const hi = (errors as any).healthIntake;
    if (!hi || typeof hi !== 'object') return {};
    return { healthIntake: hi };
  }
  if (step === 3) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(errors)) {
      if (STEP_3_FIELD_KEYS.has(key)) out[key] = errors[key];
    }
    return out;
  }
  return {};
}

/** True if the errors object has any nested error messages (for step 2 healthIntake). */
function hasNestedErrors(obj: unknown): boolean {
  if (obj == null) return false;
  if (typeof obj === 'string') return true;
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      if (hasNestedErrors(v)) return true;
    }
  }
  return false;
}

// Helper function to format state names
const formatStateName = (stateCode: string): string => {
  if (!stateCode) return '-';
  const stateMap: { [key: string]: string } = {
    'ny': 'New York',
    'ca': 'California',
    'tx': 'Texas',
  };
  return stateMap[stateCode.toLowerCase()] || stateCode.toUpperCase();
};

// Helper function to format date from YYYY-MM-DD to MM/DD/YYYY
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (e) {
    return dateString; // Return original if parsing fails
  }
};

// Helper function to format phone number (remove formatting, keep only digits)
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// Helper function to construct full name
const getFullName = (firstName: string, middleName: string, lastName: string): string => {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.join(' ');
};

// Helper function to map form values to API payload
const transformFormDataToPayload = (values: FormData): any => {
  // Map gender to sex (M/F format)
  const genderMap: { [key: string]: string } = {
    'male': 'M',
    'female': 'F'
  };

  // Get current date for lastVisitDate (using today's date)
  const today = new Date();
  const lastVisitDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;

  // Map insurance type values to match the expected format
  const insuranceTypeMap: { [key: string]: string } = {
    'hmo': 'HMO (Health Maintenance Organization)',
    'ppo': 'PPO (Preferred Provider Organization)',
    'epo': 'EPO (Exclusive Provider Organization)',
    'pos': 'POS (Point of Service Plan)',
    'hdhp': 'HDHP (High Deductible Health Plan)',
    'commercial': 'Commercial',
    'medicare': 'Medicare'
  };

  // Map marital status to match expected format
  const maritalStatusMap: { [key: string]: string } = {
    'single': 'Single',
    'married': 'Married',
    'divorced': 'Divorced',
    'widowed': 'Widowed',
    'separated': 'Separated'
  };

  // Map advance directive to match expected format
  const advanceDirectiveMap: { [key: string]: string } = {
    'yes': 'Yes',
    'no': 'No Advance Directive'
  };

  const payload: any = {
    patientInfo: {
      firstName: values.firstName || '',
      middleName: values.middleName || '',
      lastName: values.lastName || '',
      prefix: values.prefix || '',
      suffix: values.suffix || '',
      dob: formatDate(values.dob),
      sex: genderMap[values.gender?.toLowerCase()] || values.gender?.toUpperCase() || '',
      maritalStatus: maritalStatusMap[values.maritalStatus?.toLowerCase()] || values.maritalStatus || '',
      emailAddress: values.email || '',
      homePhone: formatPhoneNumber(values.homePhone),
      mobilePhone: formatPhoneNumber(values.mobilePhone),
      workEmail: values.workEmail || '',
      workPhone: formatPhoneNumber(values.workPhone),
      preferredLanguage: values.language || '',
      race: values.race || '',
      ethnicity: values.ethnicity || '',
      countryOfBirth: values.countryOfBirth || '',
  
      visitInfo: {
        lastVisitDate
      },
  
      address: {
        address1: values.address1 || '',
        address2: values.address2 || '',
        city: values.city || '',
        state: values.state?.toUpperCase() || '',
        zip: values.zipCode || '',
      },
  
      mailingAddress: {
        address1: values.mailingSameAsHome ? values.address1 : (values.mailingAddress1 || ''),
        address2: values.mailingSameAsHome ? values.address2 : (values.mailingAddress2 || ''),
        city: values.mailingSameAsHome ? values.city : (values.mailingCity || ''),
        state: values.mailingSameAsHome
          ? values.state?.toUpperCase()
          : (values.mailingState?.toUpperCase() || ''),
        zip: values.mailingSameAsHome ? values.zipCode : (values.mailingZipCode || ''),
      },
  
      insurance: {
        insuranceType: values.hasInsurance === 'yes'
          ? (insuranceTypeMap[values.primaryInsuranceType?.toLowerCase()] || values.primaryInsuranceType || null)
          : null,
        insuranceCompany: values.hasInsurance === 'yes' ? values.primaryInsuranceCompany || null : null,
        phoneNumber: values.hasInsurance === 'yes' ? values.primaryCompanyPhone || null : null,
        subscriberId: values.hasInsurance === 'yes' ? values.primarySubscriberId || null : null,
        insurancePlan: values.hasInsurance === 'yes' ? values.primaryInsurancePlan || null : null,
        groupNumber: values.hasInsurance === 'yes' ? values.primaryGroupNumber || null : null,
        coPayAmount: values.hasInsurance === 'yes'
          ? (values.primaryCoPay ? parseFloat(values.primaryCoPay) : null)
          : null,
        medicalGroup: values.hasInsurance === 'yes' ? values.primaryMedicalGroup || null : null,
        pcp: values.hasInsurance === 'yes' ? values.primaryPcp || null : null,
        coverageStartDate: values.hasInsurance === 'yes' ? formatDate(values.primaryEffectiveDate) : null,
        terminationDate: values.hasInsurance === 'yes'
          ? (values.primaryTerminationDate ? formatDate(values.primaryTerminationDate) : null)
          : null,
        insuranceStatus: values.hasInsurance === 'yes' ? values.primaryStatus || null : null,
        guarantor: values.hasInsurance === 'yes' ? values.primaryGuarantor || null : null,
        guarantorName: values.hasInsurance === 'yes' ? values.primaryGuarantorName || null : null,
        guarantorAddress: null,
        guarantorDOB: values.hasInsurance === 'yes'
          ? (values.primaryGuarantorDOB ? formatDate(values.primaryGuarantorDOB) : null)
          : null,
        guarantorSubscriberId: null
      },
  
      secondaryInsurance: {
        insuranceType: values.hasSecondaryInsurance === 'yes'
          ? (insuranceTypeMap[values.secondaryInsuranceType?.toLowerCase()] || values.secondaryInsuranceType || null)
          : null,
        insuranceCompany: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryInsuranceCompany || null
          : null,
        phoneNumber: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryCompanyPhone || null
          : null,
        subscriberId: values.hasSecondaryInsurance === 'yes'
          ? values.secondarySubscriberId || null
          : null,
        insurancePlan: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryInsurancePlan || null
          : null,
        groupNumber: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryGroupNumber || null
          : null,
        coPayAmount: values.hasSecondaryInsurance === 'yes'
          ? (values.secondaryCoPay ? parseFloat(values.secondaryCoPay) : null)
          : null,
        medicalGroup: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryMedicalGroup || null
          : null,
        pcp: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryPcp || null
          : null,
        coverageStartDate: values.hasSecondaryInsurance === 'yes'
          ? formatDate(values.secondaryEffectiveDate)
          : null,
        terminationDate: values.hasSecondaryInsurance === 'yes'
          ? (values.secondaryTerminationDate ? formatDate(values.secondaryTerminationDate) : null)
          : null,
        insuranceStatus: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryStatus || null
          : null,
        guarantor: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryGuarantor || null
          : null,
        guarantorName: values.hasSecondaryInsurance === 'yes'
          ? values.secondaryGuarantorName || null
          : null,
        guarantorAddress: null,
        guarantorDOB: values.hasSecondaryInsurance === 'yes'
          ? (values.secondaryGuarantorDOB ? formatDate(values.secondaryGuarantorDOB) : null)
          : null,
        guarantorSubscriberId: null
      },
  
      emergencyContact: {
        contactName: values.emergencyName || '',
        contactPhone: values.emergencyPhone || '',
        relationshipToPatient: values.emergencyRelation || '',
        street: values.emergencyAddress || '',
        emergencyCity: values.emergencyCity || '',
        emergencyState: values.emergencyState?.toUpperCase() || '',
        emergencyZipCode: values.emergencyZip || ''
      },
  
      flags: {
        hasInsurance: values.hasInsurance || 'no',
        hasSecondaryInsurance: values.hasSecondaryInsurance || 'no',
        pregnant: '',
        breastfeeding: '',
        advancedHealthCareDirective:
          advanceDirectiveMap[values.advanceDirective?.toLowerCase()] ||
          values.advanceDirective ||
          '',
        noticeofPrivatePracticeSigned: true,
      }
    },
  
    appointment: values.appointment
      ? {
          providerId: values.appointment.providerId || values.appointment.provider?._id || '',
          providerName: values.appointment.provider?.name || '',
          visitTypeId: values.appointment.visitTypeId || values.appointment.visitType?._id || '',
          visitType: values.appointment.visitType?.visitReasonName || '',
          visitReason: values.appointment.visitReason || '',
          otherReason: values.appointment.otherReason || '',
          serviceLocationId:
            values.appointment.serviceLocationId ||
            values.appointment.serviceLocation?._id ||
            '',
          serviceLocationName: values.appointment.serviceLocation?.name || '',
          visitMode: values.appointment.visitMode || 'Office Visit',
          appointmentDate: values.appointment.appointmentDate || '',
          timeSlot: values.appointment.timeSlot || '',
          notes: values.appointment.notes || '',
        }
      : null,
  
    healthIntake: values.healthIntake
  };

  return payload;
};

const SignupPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // API data states
  const [statesData, setStatesData] = useState([]);
  const [raceData, setRaceData] = useState([]);
  const [ethnicityData, setEthnicityData] = useState([]);
  const [languageData, setLanguageData] = useState([]);

  // Labs & Documents (frontend state only - not sent to patientSelfRegistration)
  const [labReports, setLabReports] = useState<UploadedFile[]>([]);
  const [medicalDocuments, setMedicalDocuments] = useState<UploadedFile[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Appointment step validation errors (inline display)
  const [appointmentErrors, setAppointmentErrors] = useState<Record<string, string>>({});

  const initialValues: FormData = {
    // 1. Personal
    prefix: '',
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    email: '',
    workEmail: '',

    // 2. Home Address
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',

    // 3. Mailing Address
    mailingSameAsHome: false,
    mailingAddress1: '',
    mailingAddress2: '',
    mailingCity: '',
    mailingState: '',
    mailingZipCode: '',

    // 4. Contact
    homePhone: '',
    mobilePhone: '',
    workPhone: '',
    otherPhone: '',

    // 5. Demographics
    advanceDirective: '',
    language: '',
    ethnicity: '',
    race: '',
    privacyPracticesDate: '',
    countryOfBirth: '',
    hasInsurance: 'no',
    hasSecondaryInsurance: 'no',

    // 6. Primary Insurance
    primaryInsuranceType: '',
    primaryInsuranceCompany: '',
    primarySubscriberId: '',
    primaryInsurancePlan: '',
    primaryGroupNumber: '',
    primaryCompanyPhone: '',
    primaryEffectiveDate: '',
    primaryTerminationDate: '',
    primaryStatus: '',
    primaryGuarantor: '',
    primaryGuarantorName: '',
    primaryGuarantorDOB: '',
    primaryCoPay: '',
    primaryMedicalGroup: '',
    primaryPcp: '',

    // 7. Secondary Insurance
    secondaryInsuranceType: '',
    secondaryInsuranceCompany: '',
    secondarySubscriberId: '',
    secondaryInsurancePlan: '',
    secondaryGroupNumber: '',
    secondaryCompanyPhone: '',
    secondaryEffectiveDate: '',
    secondaryTerminationDate: '',
    secondaryStatus: '',
    secondaryGuarantor: '',
    secondaryGuarantorName: '',
    secondaryGuarantorDOB: '',
    secondaryCoPay: '',
    secondaryMedicalGroup: '',
    secondaryPcp: '',

    // 8. Emergency Contact
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    emergencyAddress: '',
    emergencyCity: '',
    emergencyState: '',
    emergencyZip: '',

    // Review & Submit consent
    acknowledgeNoticeOfPrivacyPractices: false,

    // Appointment (Step 5)
    appointment: {
      provider: null,
      providerId: '',
      visitType: null,
      visitTypeId: '',
      visitReason: '',
      otherReason: '',
      serviceLocation: null,
      serviceLocationId: '',
      visitMode: 'Office Visit',
      appointmentDate: '',
      timeSlot: '',
      notes: '',
    },

    // Health Intake
    healthIntake: {
      chiefComplaint: {
        reasonForVisit: '',
        duration: '',
        severity: '',
        associatedSymptoms: '',
      },
      hpi: {
        onset: '',
        course: '',
        location: '',
        quality: '',
        radiation: '',
        aggravatingFactors: '',
        relievingFactors: '',
        previousEpisodes: '',
        previousEpisodesDescription: '',
        priorTreatment: '',
      },
      pastMedicalHistory: {
        conditions: [],
        other: '',
      },
      ros: {
        constitutional: [],
        cardiovascular: [],
        respiratory: [],
        gastrointestinal: [],
        neurological: [],
        musculoskeletal: [],
      },
      surgicalHistory: {
        procedures: '',
      },
    },
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setFieldError }) => {
      if (!values.acknowledgeNoticeOfPrivacyPractices) {
        setFieldError('acknowledgeNoticeOfPrivacyPractices', 'You must acknowledge the Notice of Privacy Practices before submitting.');
        return;
      }
      try {
        // Clear any existing auth state so signup API is sent without Authorization and user is not auto-logged in after redirect
        // sessionStorage.clear();
        // dispatch(logout());
        // localStorage.removeItem('patientLoginResponse');
        // localStorage.removeItem('patientEmail');

        // Transform form data to API payload format
        const payload = transformFormDataToPayload(values);
        
        console.log('Submitting patient registration:', payload);
        
        // Show loading toast
        toast.loading('Registering patient...', { id: 'register' });
        
        // Make API call (patientApi has no auth interceptor; storage is cleared so no token is sent)
        const response = await patientAPI.registerPatient(payload);
        
        console.log('Patient registration successful:', response.data);
        sessionStorage.clear();
dispatch(logout());
        // Success message before redirect
        toast.success('Application submitted successfully. Your login credentials have been sent to your email. Please check your email and log in.', {
          id: 'register',
          duration: 5000,
        });

        navigate('/');
      } catch (error: any) {
        console.error('Submission error:', error);
        
        // Handle error with toast notification
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Registration failed. Please check your information and try again.';
        toast.error(errorMessage, { id: 'register', duration: 5000 });
      }
    },
  });
  const handleSignInClick = () => {
    sessionStorage.clear();
    dispatch(logout());
    localStorage.removeItem('patientLoginResponse');
    localStorage.removeItem('patientEmail');
    navigate("/");
  };

  // Auto-login on page load to enable appointment APIs during registration (provider credentials)
  useEffect(() => {
    const autoLogin = async () => {
      try {
        const res = await api.post("/login", {
          username: "adnanhussain01613@gmail.com",
          password: "Adnan!@#$1234"
        });

        if (res?.data?.token) {
          dispatch(setToken(res.data.token));
          sessionStorage.setItem("token", res.data.token);
        }
      } catch (error) {
        console.error("Auto login failed:", error);
      }
    };

    autoLogin();
  }, [dispatch]);

  // Fetch API data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch states data
        const statesResponse = await commonAPI.getStates('US');
        if (statesResponse.data?.data) {
          const formattedStates = statesResponse.data.data.map((state: any) => ({
            label: state.name,
            value: state.name.toLowerCase().replace(/\s+/g, '')
          }));
          setStatesData(formattedStates);
        }

        // Fetch race data
        const raceResponse = await settingsAPI.getRaceCodes();
        if (raceResponse.data?.data) {
          const formattedRaces = raceResponse.data.data.map((race: any) => ({
            label: race.description,
            value: race.description.toLowerCase().replace(/\s+/g, '')
          }));
          setRaceData(formattedRaces);
        }

        // Fetch ethnicity data
        const ethnicityResponse = await settingsAPI.getEthnicityCodes();
        if (ethnicityResponse.data?.data) {
          const formattedEthnicities = ethnicityResponse.data.data.map((ethnicity: any) => ({
            label: ethnicity.name,
            value: ethnicity.name.toLowerCase().replace(/\s+/g, '')
          }));
          setEthnicityData(formattedEthnicities);
        }

        // Fetch language data
        const languageResponse = await settingsAPI.getPreferredLanguageCodes();
        if (languageResponse.data?.data) {
          const formattedLanguages = languageResponse.data.data.map((language: any) => ({
            label: language.name,
            value: language.name.toLowerCase().replace(/\s+/g, '')
          }));
          setLanguageData(formattedLanguages);
        }
      } catch (error) {
        console.error('Error fetching API data:', error);
        toast.error('Failed to load form options. Please refresh the page.');
      }
    };

    fetchData();
  }, []);

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (currentStep === 1) {
      // Mark all step 1 fields as touched to show errors
      const step1Fields: (keyof FormData)[] = [
        'firstName', 'lastName', 'dob', 'gender', 'maritalStatus',
        'address1', 'city', 'state', 'zipCode',
        'homePhone', 'emergencyName', 'emergencyRelation',
        'middleName', 'email', 'workEmail', 'address2'
      ];
      
      // Mark fields as touched
      const touchedFields: { [key: string]: boolean } = {};
      step1Fields.forEach(field => {
        touchedFields[field] = true;
      });

      formik.setTouched({ ...formik.touched, ...touchedFields });
      
      // Validate the form; only block on current step's errors (ignore other steps)
      const errors = await formik.validateForm();
      const stepErrors = getErrorsForStep(errors as Record<string, unknown>, 1);
      if (Object.keys(stepErrors).length > 0) {
        const firstErrorField = Object.keys(stepErrors)[0];
        const errorElement = document.querySelector(`[name="${firstErrorField}"]`) || 
                           document.getElementById(firstErrorField);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Focus on the element if it's an input
          if (errorElement instanceof HTMLElement && (errorElement.tagName === 'INPUT' || errorElement.tagName === 'SELECT')) {
            errorElement.focus();
          }
        }
        return;
      }
    }

    if (currentStep === 2) {
      formik.setTouched({
        ...formik.touched,
        healthIntake: {
          ...(formik.touched?.healthIntake as any || {}),
          chiefComplaint: {
            reasonForVisit: true,
            severity: true,
          },
        },
      });
      const errors = await formik.validateForm();
      const stepErrors = getErrorsForStep(errors as Record<string, unknown>, 2);
      if (hasNestedErrors(stepErrors)) {
        const el = document.querySelector('[name="healthIntake.chiefComplaint.reasonForVisit"]') ||
          document.getElementById('reasonForVisit');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    if (currentStep === 3) {
      const insuranceFields: (keyof FormData)[] = ['hasInsurance'];
      if (formik.values.hasInsurance === 'yes') {
        insuranceFields.push('primaryInsuranceCompany', 'primarySubscriberId');
      }
      const touchedFields: { [key: string]: boolean } = {};
      insuranceFields.forEach(field => { touchedFields[field] = true; });
      formik.setTouched({ ...formik.touched, ...touchedFields });
      const errors = await formik.validateForm();
      const stepErrors = getErrorsForStep(errors as Record<string, unknown>, 3);
      if (Object.keys(stepErrors).length > 0) {
        const firstErrorField = Object.keys(stepErrors)[0];
        const errorElement = document.querySelector(`[name="${firstErrorField}"]`) ||
          document.getElementById(firstErrorField);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (errorElement instanceof HTMLElement && (errorElement.tagName === 'INPUT' || errorElement.tagName === 'SELECT')) {
            errorElement.focus();
          }
        }
        return;
      }
    }

    if (currentStep === 5) {
      // Validate Appointment step - provider, visitType, appointmentDate, timeSlot required
      const app = formik.values.appointment || {};
      const appErrors: Record<string, string> = {};
      if (!app.provider && !app.providerId) appErrors.provider = 'Provider is required';
      if (!app.visitType && !app.visitTypeId) appErrors.visitType = 'Visit type is required';
      if ((app.provider || app.providerId) && !app.serviceLocation && !app.serviceLocationId) {
        appErrors.serviceLocation = 'Service location is required';
      }
      if (!app.appointmentDate) appErrors.appointmentDate = 'Appointment date is required';
      if (!app.timeSlot) appErrors.timeSlot = 'Time slot is required';
      if (app.visitReason === 'Other' && !app.otherReason?.trim()) {
        appErrors.otherReason = 'Please specify the reason';
      }
      setAppointmentErrors(appErrors);
      if (Object.keys(appErrors).length > 0) {
        toast.error('Please complete all required appointment fields');
        const firstErr = document.querySelector('[data-appointment-step]');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setAppointmentErrors({});
    } else {
      setAppointmentErrors({});
    }

    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const getFieldError = (fieldName: string): string | undefined => {
    const key = fieldName as keyof FormData;
    if (formik.touched[key] && formik.errors[key]) {
      return formik.errors[key] as string;
    }
    return undefined;
  };

  // Helper function to handle Input field changes with immediate validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const fieldName = e.target.name as keyof FormData;
    formik.handleChange(e);
    // Mark field as touched and validate immediately
    formik.setFieldTouched(fieldName, true, false);
    // Validate the field after state update
    setTimeout(() => {
      formik.validateField(fieldName);
    }, 0);
  };

  // Helper function to handle Select field changes with validation
  const handleSelectChange = (fieldName: string, value: string) => {
    formik.setFieldValue(fieldName, value);
    formik.setFieldTouched(fieldName, true);
    // Validate the field immediately after change
    setTimeout(() => {
      formik.validateField(fieldName);
    }, 0);
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
  
      {/* MOBILE */}
      <div className="block md:hidden">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">
            {steps[currentStep - 1].title}
          </h2>
  
          <span className="text-xs text-gray-500">
            Step {currentStep} of {steps.length}
          </span>
        </div>
  
        <div className="w-full h-1.5 bg-gray-200 rounded-full">
          <div
            className="h-1.5 bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
  
      {/* DESKTOP */}
      {/* DESKTOP */}
<div className="hidden md:block mt-10">
  <div className="relative flex justify-between items-center">

    {/* Background line (ONLY between steps) */}
    <div
      className="absolute top-5 h-[3px] bg-gray-200 rounded"
      style={{
        left: `calc(50% / ${steps.length})`,
        right: `calc(50% / ${steps.length})`,
      }}
    ></div>

    {/* Active progress line */}
    <div
      className="absolute top-5 h-[3px] bg-primary rounded transition-all duration-500 ease-in-out"
      style={{
        left: `calc(50% / ${steps.length})`,
        width: `calc(((100% - (100% / ${steps.length})) * ${
          (currentStep - 1) / (steps.length - 1)
        }))`,
      }}
    ></div>

    {steps.map((step) => {
      const isCompleted = currentStep > step.id;
      const isActive = currentStep === step.id;

      return (
        <div
          key={step.id}
          className="relative z-10 flex flex-col items-center flex-1"
        >
       <div
  className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300
  ${
    isCompleted
      ? "bg-primary text-white border-primary"
      : isActive
      ? "border-primary bg-white text-primary ring-4 ring-primary/20"
      : "border-gray-300 text-gray-400 bg-white"
  }`}
>
{isCompleted ? "✓" : step.id}
</div>

          {/* Step title */}
          <span
            className={`mt-2 text-xs text-center transition-all
            ${
              isActive
                ? "text-primary font-semibold"
                : isCompleted
                ? "text-gray-700"
                : "text-gray-400"
            }`}
          >
            {step.title}
          </span>
        </div>
      );
    })}
  </div>
</div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
      
      {/* Centered Multi-step Form */}
      <div className="w-full h-full flex flex-col items-center p-2 sm:p-4 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 lg:p-8 xl:p-10 my-auto flex flex-col">
          
          {/* Header */}
          <div className="mb-6 text-center px-2 sm:px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Patient Registration</h2>
            <p className="text-gray-500 text-sm md:text-base">Please fill in your details to create an account</p>
          </div>

          {renderStepIndicator()}

          <form onSubmit={formik.handleSubmit} className="flex flex-col w-full px-2 sm:px-4 lg:px-6">
            <div className="space-y-6">
              
              {/* STEP 1: PATIENT INFORMATION */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                  <Accordion type="multiple" defaultValue={["personal", "home-address", "contact", "emergency"]} className="w-full">
                    
                    {/* 1. Personal Information */}
                    <AccordionItem value="personal" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          Personal Information
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="prefix" className="text-sm font-medium mb-1">Prefix</Label>
                          <SearchableSelect
                            value={formik.values.prefix}
                            onValueChange={(v) => formik.setFieldValue('prefix', v)}
                            options={prefixes}
                            placeholder="Select"
                            triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('prefix') && "border-primary-600")}
                          />
                          {getFieldError('prefix') && <p className="text-xs text-primary-600 mt-1">{getFieldError('prefix')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="firstName" className="text-sm font-medium mb-1">First Name <span className="text-primary-600">*</span></Label>
                          <Input 
                            id="firstName" 
                            name="firstName"
                            value={formik.values.firstName} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('firstName') && "border-primary-600")}
                          />
                          {getFieldError('firstName') && <p className="text-xs text-primary-600 mt-1">{getFieldError('firstName')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="middleName" className="text-sm font-medium mb-1">Middle Name</Label>
                          <Input 
                            id="middleName" 
                            name="middleName"
                            value={formik.values.middleName} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('middleName') && "border-primary-600")}
                          />
                          {getFieldError('middleName') && <p className="text-xs text-primary-600 mt-1">{getFieldError('middleName')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="lastName" className="text-sm font-medium mb-1">Last Name <span className="text-primary-600">*</span></Label>
                          <Input 
                            id="lastName" 
                            name="lastName"
                            value={formik.values.lastName} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('lastName') && "border-primary-600")}
                          />
                          {getFieldError('lastName') && <p className="text-xs text-primary-600 mt-1">{getFieldError('lastName')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="suffix" className="text-sm font-medium mb-1">Suffix</Label>
                          <SearchableSelect
                            value={formik.values.suffix}
                            onValueChange={(v) => formik.setFieldValue('suffix', v)}
                            options={suffixes}
                            placeholder="Select"
                            triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('suffix') && "border-primary-600")}
                          />
                          {getFieldError('suffix') && <p className="text-xs text-primary-600 mt-1">{getFieldError('suffix')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="dob" className="text-sm font-medium mb-1">Date of Birth <span className="text-primary-600">*</span></Label>
                          <Input 
                            id="dob" 
                            name="dob"
                            type="date" 
                            value={formik.values.dob} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('dob') && "border-primary-600")}
                          />
                          {getFieldError('dob') && <p className="text-xs text-primary-600 mt-1">{getFieldError('dob')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="gender" className="text-sm font-medium mb-1">Gender <span className="text-primary-600">*</span></Label>
                          <SearchableSelect
                            value={formik.values.gender}
                            onValueChange={(v) => {
                              formik.setFieldValue('gender', v);
                              formik.setFieldTouched('gender', true);
                            }}
                            options={genderOptions}
                            placeholder="Select"
                            triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('gender') && "border-primary-600")}
                          />
                          {getFieldError('gender') && <p className="text-xs text-primary-600 mt-1">{getFieldError('gender')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1">
                          <Label htmlFor="maritalStatus" className="text-sm font-medium mb-1">Marital Status <span className="text-primary-600">*</span></Label>
                          <SearchableSelect
                            value={formik.values.maritalStatus}
                            onValueChange={(v) => handleSelectChange('maritalStatus', v)}
                            options={MaritalList}
                            placeholder="Select"
                            triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('maritalStatus') && "border-primary-600")}
                          />
                          {getFieldError('maritalStatus') && <p className="text-xs text-primary-600 mt-1">{getFieldError('maritalStatus')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1 lg:col-span-2">
                          <Label htmlFor="email" className="text-sm font-medium mb-1">Email <span className="text-primary-600">*</span></Label>
                          <Input 
                            id="email" 
                            name="email"
                            type="email" 
                            value={formik.values.email} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('email') && "border-primary-600")}
                          />
                          {getFieldError('email') && <p className="text-xs text-primary-600 mt-1">{getFieldError('email')}</p>}
                       </div>
                       <div className="flex flex-col space-y-1 lg:col-span-2">
                          <Label htmlFor="workEmail" className="text-sm font-medium mb-1">Work Email</Label>
                          <Input 
                            id="workEmail" 
                            name="workEmail"
                            type="email" 
                            value={formik.values.workEmail} 
                            onChange={handleInputChange}
                            onBlur={formik.handleBlur}
                            className={cn("bg-gray-50 h-10 w-full", getFieldError('workEmail') && "border-primary-600")}
                          />
                          {getFieldError('workEmail') && <p className="text-xs text-primary-600 mt-1">{getFieldError('workEmail')}</p>}
                       </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 2. Home Address Information */}
                    <AccordionItem value="home-address" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-primary" />
                          Home Address Information
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                        <div className="flex flex-col space-y-1 lg:col-span-2">
                           <Label htmlFor="address1" className="text-sm font-medium mb-1">Address 1 <span className="text-primary-600">*</span></Label>
                           <Input 
                             id="address1" 
                             name="address1"
                             value={formik.values.address1} 
                             onChange={handleInputChange}
                             onBlur={formik.handleBlur}
                             className={cn("bg-gray-50 h-10 w-full", getFieldError('address1') && "border-primary-600")}
                           />
                           {getFieldError('address1') && <p className="text-xs text-primary-600 mt-1">{getFieldError('address1')}</p>}
                        </div>
                        <div className="flex flex-col space-y-1 lg:col-span-2">
                           <Label htmlFor="address2" className="text-sm font-medium mb-1">Address 2</Label>
                           <Input 
                             id="address2" 
                             name="address2"
                             value={formik.values.address2} 
                             onChange={handleInputChange}
                             onBlur={formik.handleBlur}
                             className={cn("bg-gray-50 h-10 w-full", getFieldError('address2') && "border-primary-600")}
                           />
                           {getFieldError('address2') && <p className="text-xs text-primary-600 mt-1">{getFieldError('address2')}</p>}
                        </div>
                         <div className="flex flex-col space-y-1 lg:col-span-1">
                           <Label htmlFor="city" className="text-sm font-medium mb-1">City <span className="text-primary-600">*</span></Label>
                           <Input 
                             id="city" 
                             name="city"
                             value={formik.values.city} 
                             onChange={handleInputChange}
                             onBlur={formik.handleBlur}
                             className={cn("bg-gray-50 h-10 w-full", getFieldError('city') && "border-primary-600")}
                           />
                           {getFieldError('city') && <p className="text-xs text-primary-600 mt-1">{getFieldError('city')}</p>}
                        </div>
                        <div className="flex flex-col space-y-1 lg:col-span-2">
                           <Label htmlFor="state" className="text-sm font-medium mb-1">State/Province <span className="text-primary-600">*</span></Label>
                           <SearchableSelect
                            value={formik.values.state}
                            onValueChange={(v) => handleSelectChange('state', v)}
                            options={statesData}
                            placeholder="--Select State--"
                            triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('state') && "border-primary-600")}
                          />
                          {getFieldError('state') && <p className="text-xs text-primary-600 mt-1">{getFieldError('state')}</p>}
                        </div>
                        <div className="flex flex-col space-y-1 lg:col-span-1">
                           <Label htmlFor="zipCode" className="text-sm font-medium mb-1">Zip Code <span className="text-primary-600">*</span></Label>
                           <Input 
                             id="zipCode" 
                             name="zipCode"
                             value={formik.values.zipCode} 
                             onChange={handleInputChange}
                             onBlur={formik.handleBlur}
                             className={cn("bg-gray-50 h-10 w-full", getFieldError('zipCode') && "border-primary-600")}
                           />
                           {getFieldError('zipCode') && <p className="text-xs text-primary-600 mt-1">{getFieldError('zipCode')}</p>}
                        </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 3. Mailing Address Information */}
                    <AccordionItem value="mailing-address" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-primary" />
                          Mailing Address Information
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 p-3 bg-primary-50 rounded-lg border border-primary-200">
                            <input 
                              type="checkbox" 
                              id="mailingSameAsHome" 
                              checked={formik.values.mailingSameAsHome} 
                              onChange={(e) => formik.setFieldValue('mailingSameAsHome', e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="mailingSameAsHome" className="text-sm font-medium text-gray-700">Is Mailing Address Same As Home Address?</Label>
                          </div>
                          {!formik.values.mailingSameAsHome && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                            <div className="flex flex-col space-y-1 lg:col-span-2">
                               <Label htmlFor="mailingAddress1" className="text-sm font-medium mb-1">Address 1</Label>
                               <Input 
                                 id="mailingAddress1" 
                                 name="mailingAddress1"
                                 value={formik.values.mailingAddress1} 
                                 onChange={handleInputChange}
                                 onBlur={formik.handleBlur}
                                 className={cn("bg-gray-50 h-10 w-full", getFieldError('mailingAddress1') && "border-primary-600")}
                               />
                               {getFieldError('mailingAddress1') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mailingAddress1')}</p>}
                            </div>
                            <div className="flex flex-col space-y-1 lg:col-span-2">
                               <Label htmlFor="mailingAddress2" className="text-sm font-medium mb-1">Address 2</Label>
                               <Input 
                                 id="mailingAddress2" 
                                 name="mailingAddress2"
                                 value={formik.values.mailingAddress2} 
                                 onChange={handleInputChange}
                                 onBlur={formik.handleBlur}
                                 className={cn("bg-gray-50 h-10 w-full", getFieldError('mailingAddress2') && "border-primary-600")}
                               />
                               {getFieldError('mailingAddress2') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mailingAddress2')}</p>}
                            </div>
                             <div className="flex flex-col space-y-1 lg:col-span-1">
                               <Label htmlFor="mailingCity" className="text-sm font-medium mb-1">City</Label>
                               <Input 
                                 id="mailingCity" 
                                 name="mailingCity"
                                 value={formik.values.mailingCity} 
                                 onChange={handleInputChange}
                                 onBlur={formik.handleBlur}
                                 className={cn("bg-gray-50 h-10 w-full", getFieldError('mailingCity') && "border-primary-600")}
                               />
                               {getFieldError('mailingCity') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mailingCity')}</p>}
                            </div>
                            <div className="flex flex-col space-y-1 lg:col-span-2">
                               <Label htmlFor="mailingState" className="text-sm font-medium mb-1">State/Province</Label>
                               <SearchableSelect
                                value={formik.values.mailingState}
                                onValueChange={(v) => formik.setFieldValue('mailingState', v)}
                                options={statesData}
                                placeholder="--Select State--"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('mailingState') && "border-primary-600")}
                              />
                              {getFieldError('mailingState') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mailingState')}</p>}
                            </div>
                            <div className="flex flex-col space-y-1 lg:col-span-1">
                               <Label htmlFor="mailingZipCode" className="text-sm font-medium mb-1">Zip Code</Label>
                               <Input 
                                 id="mailingZipCode" 
                                 name="mailingZipCode"
                                 value={formik.values.mailingZipCode} 
                                 onChange={handleInputChange}
                                 onBlur={formik.handleBlur}
                                 className={cn("bg-gray-50 h-10 w-full", getFieldError('mailingZipCode') && "border-primary-600")}
                               />
                               {getFieldError('mailingZipCode') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mailingZipCode')}</p>}
                            </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 4. Contact Information */}
                    <AccordionItem value="contact" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          Contact Information
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="homePhone" className="text-sm font-medium mb-1">Home Phone <span className="text-primary-600">*</span></Label>
                            <Input 
                              id="homePhone" 
                              name="homePhone"
                              value={formik.values.homePhone} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('homePhone') && "border-primary-600")}
                            />
                            {getFieldError('homePhone') && <p className="text-xs text-primary-600 mt-1">{getFieldError('homePhone')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="mobilePhone" className="text-sm font-medium mb-1">Mobile Phone</Label>
                            <Input 
                              id="mobilePhone" 
                              name="mobilePhone"
                              value={formik.values.mobilePhone} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('mobilePhone') && "border-primary-600")}
                            />
                            {getFieldError('mobilePhone') && <p className="text-xs text-primary-600 mt-1">{getFieldError('mobilePhone')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="workPhone" className="text-sm font-medium mb-1">Work Phone</Label>
                            <Input 
                              id="workPhone" 
                              name="workPhone"
                              value={formik.values.workPhone} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('workPhone') && "border-primary-600")}
                            />
                            {getFieldError('workPhone') && <p className="text-xs text-primary-600 mt-1">{getFieldError('workPhone')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="otherPhone" className="text-sm font-medium mb-1">Other Phone</Label>
                            <Input 
                              id="otherPhone" 
                              name="otherPhone"
                              value={formik.values.otherPhone} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('otherPhone') && "border-primary-600")}
                            />
                            {getFieldError('otherPhone') && <p className="text-xs text-primary-600 mt-1">{getFieldError('otherPhone')}</p>}
                         </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 5. Additional Demographics */}
                    <AccordionItem value="demographics" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          Additional Demographics
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                         <div className="flex flex-col">
                            <Label htmlFor="advanceDirective" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Advance Healthcare Directive Status</Label>
                            <div className="flex flex-col">
                              <SearchableSelect
                                value={formik.values.advanceDirective}
                                onValueChange={(v) => formik.setFieldValue('advanceDirective', v)}
                                options={advancedHealthCareDirectiveList}
                                placeholder="Select"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('advanceDirective') && "border-primary-600")}
                              />
                              {getFieldError('advanceDirective') && <p className="text-xs text-primary-600 mt-1">{getFieldError('advanceDirective')}</p>}
                            </div>
                         </div>
                         <div className="flex flex-col">
                            <Label htmlFor="language" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Preferred Language</Label>
                            <div className="flex flex-col">
                              <SearchableSelect
                                value={formik.values.language}
                                onValueChange={(v) => formik.setFieldValue('language', v)}
                                options={languageData}
                                placeholder="Select"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('language') && "border-primary-600")}
                              />
                              {getFieldError('language') && <p className="text-xs text-primary-600 mt-1">{getFieldError('language')}</p>}
                            </div>
                         </div>
                         <div className="flex flex-col">
                            <Label htmlFor="ethnicity" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Ethnicity</Label>
                            <div className="flex flex-col">
                              <SearchableSelect
                                value={formik.values.ethnicity}
                                onValueChange={(v) => formik.setFieldValue('ethnicity', v)}
                                options={ethnicityData}
                                placeholder="Select"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('ethnicity') && "border-primary-600")}
                              />
                              {getFieldError('ethnicity') && <p className="text-xs text-primary-600 mt-1">{getFieldError('ethnicity')}</p>}
                            </div>
                         </div>
                         <div className="flex flex-col">
                            <Label htmlFor="race" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Race</Label>
                            <div className="flex flex-col">
                              <SearchableSelect
                                value={formik.values.race}
                                onValueChange={(v) => formik.setFieldValue('race', v)}
                                options={raceData}
                                placeholder="Select"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('race') && "border-primary-600")}
                              />
                              {getFieldError('race') && <p className="text-xs text-primary-600 mt-1">{getFieldError('race')}</p>}
                            </div>
                         </div>
                         <div className="flex flex-col">
                            <Label htmlFor="privacyPracticesDate" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Notice of Privacy Practices</Label>
                            <div className="flex flex-col">
                              <Input 
                                id="privacyPracticesDate" 
                                name="privacyPracticesDate"
                                type="date" 
                                value={formik.values.privacyPracticesDate} 
                                onChange={handleInputChange}
                                onBlur={formik.handleBlur}
                                className={cn("bg-gray-50 h-10 w-full", getFieldError('privacyPracticesDate') && "border-primary-600")}
                              />
                              {getFieldError('privacyPracticesDate') && <p className="text-xs text-primary-600 mt-1">{getFieldError('privacyPracticesDate')}</p>}
                            </div>
                         </div>
                         <div className="flex flex-col">
                            <Label htmlFor="countryOfBirth" className="text-sm font-medium mb-1.5 leading-snug h-10 flex items-center">Country of Birth</Label>
                            <div className="flex flex-col">
                              <SearchableSelect
                                value={formik.values.countryOfBirth}
                                onValueChange={(v) => formik.setFieldValue('countryOfBirth', v)}
                                options={countryOfBirthOptions}
                                placeholder="Select"
                                triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('countryOfBirth') && "border-primary-600")}
                              />
                              {getFieldError('countryOfBirth') && <p className="text-xs text-primary-600 mt-1">{getFieldError('countryOfBirth')}</p>}
                            </div>
                         </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 7. Emergency Contact */}
                    <AccordionItem value="emergency" className="border border-gray-200 rounded-lg mb-4 px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          Emergency Contact
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyName" className="text-sm font-medium mb-1">Name <span className="text-primary-600">*</span></Label>
                            <Input 
                              id="emergencyName" 
                              name="emergencyName"
                              value={formik.values.emergencyName} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('emergencyName') && "border-primary-600")}
                            />
                            {getFieldError('emergencyName') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyName')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyPhone" className="text-sm font-medium mb-1">Contact Phone</Label>
                            <Input 
                              id="emergencyPhone" 
                              name="emergencyPhone"
                              value={formik.values.emergencyPhone} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('emergencyPhone') && "border-primary-600")}
                            />
                            {getFieldError('emergencyPhone') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyPhone')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyRelation" className="text-sm font-medium mb-1">Relationship With Patient <span className="text-primary-600">*</span></Label>
                            <SearchableSelect
                              value={formik.values.emergencyRelation}
                              onValueChange={(v) => handleSelectChange('emergencyRelation', v)}
                              options={relationshipToPatientList}
                              placeholder="Select"
                              triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('emergencyRelation') && "border-primary-600")}
                            />
                            {getFieldError('emergencyRelation') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyRelation')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1 lg:col-span-1">
                            <Label htmlFor="emergencyAddress" className="text-sm font-medium mb-1">Address</Label>
                            <Input 
                              id="emergencyAddress" 
                              name="emergencyAddress"
                              value={formik.values.emergencyAddress} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('emergencyAddress') && "border-primary-600")}
                            />
                            {getFieldError('emergencyAddress') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyAddress')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyCity" className="text-sm font-medium mb-1">City</Label>
                            <Input 
                              id="emergencyCity" 
                              name="emergencyCity"
                              value={formik.values.emergencyCity} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('emergencyCity') && "border-primary-600")}
                            />
                            {getFieldError('emergencyCity') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyCity')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyState" className="text-sm font-medium mb-1">State/Province</Label>
                            <SearchableSelect
                              value={formik.values.emergencyState}
                              onValueChange={(v) => formik.setFieldValue('emergencyState', v)}
                              options={statesData}
                              placeholder="--Select State--"
                              triggerClassName={cn("w-full bg-gray-50 h-10", getFieldError('emergencyState') && "border-primary-600")}
                            />
                            {getFieldError('emergencyState') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyState')}</p>}
                         </div>
                         <div className="flex flex-col space-y-1">
                            <Label htmlFor="emergencyZip" className="text-sm font-medium mb-1">Zip Code</Label>
                            <Input 
                              id="emergencyZip" 
                              name="emergencyZip"
                              value={formik.values.emergencyZip} 
                              onChange={handleInputChange}
                              onBlur={formik.handleBlur}
                              className={cn("bg-gray-50 h-10 w-full", getFieldError('emergencyZip') && "border-primary-600")}
                            />
                            {getFieldError('emergencyZip') && <p className="text-xs text-primary-600 mt-1">{getFieldError('emergencyZip')}</p>}
                         </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                  </Accordion>
                </div>
              )}

              {/* STEP 2: HEALTH INTAKE */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                  <HealthIntakeForm formik={formik as any} />
                </div>
              )}

              {/* STEP 3: INSURANCE INFORMATION */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                  <InsuranceForm
                    formik={formik}
                    getFieldError={getFieldError}
                    handleInputChange={handleInputChange}
                    handleSelectChange={handleSelectChange}
                  />
                </div>
              )}

              {/* STEP 4: LABS & DOCUMENTS */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                  <LabsDocumentsForm
                    labReports={labReports}
                    medicalDocuments={medicalDocuments}
                    additionalNotes={additionalNotes}
                    onLabReportsChange={setLabReports}
                    onMedicalDocumentsChange={setMedicalDocuments}
                    onAdditionalNotesChange={setAdditionalNotes}
                  />
                </div>
              )}

              {/* STEP 5: BOOK APPOINTMENT */}
              {currentStep === 5 && (
                <div data-appointment-step className="space-y-4">
                  <BookAppointmentStep
                    value={formik.values.appointment}
                    onChange={(val) => formik.setFieldValue('appointment', val)}
                    errors={appointmentErrors}
                  />
                </div>
              )}

              {/* STEP 6: SUMMARY / REVIEW */}
              {currentStep === 6 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
                  
                  {/* Personal Information */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <User className="w-5 h-5 text-primary" />
                       Personal Information
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prefix</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.prefix ? `${formik.values.prefix}.` : '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">First Name</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.firstName || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Middle Name</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.middleName || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Name</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.lastName || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suffix</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.suffix ? `${formik.values.suffix}.` : '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.dob || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.gender || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Marital Status</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.maritalStatus || '-'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                          <p className="text-sm font-semibold text-gray-900 break-words">{formik.values.email || '-'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Work Email</p>
                          <p className="text-sm font-semibold text-gray-900 break-words">{formik.values.workEmail || '-'}</p>
                        </div>
                     </div>
                  </div>

                  {/* Home Address */}
                   <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <BookOpen className="w-5 h-5 text-primary" />
                       Home Address
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 1</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.address1 || '-'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 2</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.address2 || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">City</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.city || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">State</p>
                          <p className="text-sm font-semibold text-gray-900">{formatStateName(formik.values.state)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zip Code</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.zipCode || '-'}</p>
                        </div>
                     </div>
                  </div>

                  {/* Mailing Address */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <BookOpen className="w-5 h-5 text-primary" />
                       Mailing Address
                     </h3>
                     {formik.values.mailingSameAsHome ? (
                       <div className="space-y-3">
                         <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                           <p className="text-sm font-medium text-primary-800 flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4" />
                             Same as Home Address
                           </p>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-4 border-l-2 border-primary-200">
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 1</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.address1 || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 2</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.address2 || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">City</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.city || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">State</p>
                              <p className="text-sm font-semibold text-gray-900">{formatStateName(formik.values.state)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zip Code</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.zipCode || '-'}</p>
                            </div>
                         </div>
                       </div>
                     ) : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1 sm:col-span-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 1</p>
                            <p className="text-sm font-semibold text-gray-900">{formik.values.mailingAddress1 || '-'}</p>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address 2</p>
                            <p className="text-sm font-semibold text-gray-900">{formik.values.mailingAddress2 || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">City</p>
                            <p className="text-sm font-semibold text-gray-900">{formik.values.mailingCity || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">State</p>
                            <p className="text-sm font-semibold text-gray-900">{formatStateName(formik.values.mailingState)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zip Code</p>
                            <p className="text-sm font-semibold text-gray-900">{formik.values.mailingZipCode || '-'}</p>
                          </div>
                       </div>
                     )}
                  </div>

                  {/* Contact Info */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <Calendar className="w-5 h-5 text-primary" />
                       Contact Information
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Home Phone</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.homePhone || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mobile Phone</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.mobilePhone || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Work Phone</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.workPhone || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Other Phone</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.otherPhone || '-'}</p>
                        </div>
                     </div>
                  </div>

                   {/* Demographics */}
                   <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <User className="w-5 h-5 text-primary" />
                       Additional Demographics
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Advance Directive</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.advanceDirective || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Language</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.language || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ethnicity</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.ethnicity || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Race</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.race || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Privacy Practices</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.privacyPracticesDate || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Country of Birth</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.countryOfBirth || '-'}</p>
                        </div>
                     </div>
                  </div>

                  {/* Primary Insurance */}
                  {formik.values.hasInsurance === 'yes' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">

                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      Primary Insurance
                    </h3>
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                      {/* Company */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Company
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryInsuranceCompany || '-'}
                        </p>
                      </div>
                  
                      {/* Member ID */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Member ID
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primarySubscriberId || '-'}
                        </p>
                      </div>
                  
                      {/* Group Number */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Group Number
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryGroupNumber || '-'}
                        </p>
                      </div>
                  
                      {/* Phone */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Company Phone
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryCompanyPhone || '-'}
                        </p>
                      </div>
                  
                      {/* Effective Date */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Effective Date
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryEffectiveDate || '-'}
                        </p>
                      </div>
                  
                      {/* Termination Date */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Termination Date
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryTerminationDate || '-'}
                        </p>
                      </div>
                  
                      {/* CoPay */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Co-Pay Amount
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryCoPay ? `$${formik.values.primaryCoPay}` : '-'}
                        </p>
                      </div>
                  
                      {/* Medical Group */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Medical Group / IPA
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryMedicalGroup || '-'}
                        </p>
                      </div>
                  
                      {/* PCP */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Primary Care Physician (PCP)
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryPcp || '-'}
                        </p>
                      </div>
                  
                      {/* ---------- GUARANTOR FIELDS (COMMENTED) ---------- */}
                  
                      {/*
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Guarantor
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryGuarantor || '-'}
                        </p>
                      </div>
                  
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Guarantor Name
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryGuarantorName || '-'}
                        </p>
                      </div>
                  
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Guarantor DOB
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.primaryGuarantorDOB || '-'}
                        </p>
                      </div>
                      */}
                  
                    </div>
                  
                  </div>
                  )}

                  {/* Secondary Insurance */}
                  {formik.values.hasSecondaryInsurance === 'yes' && (
                     <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                         <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                           <CheckCircle2 className="w-5 h-5 text-primary" />
                           Secondary Insurance
                         </h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</p>
                              <p className="text-sm font-semibold text-gray-900 uppercase">{formik.values.secondaryInsuranceType || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryInsuranceCompany || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subscriber ID</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondarySubscriberId || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</p>
                              <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.secondaryInsurancePlan || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Group Number</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryGroupNumber || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company Phone</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryCompanyPhone || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Effective Date</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryEffectiveDate || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Termination Date</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryTerminationDate || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
                              <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.secondaryStatus || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Guarantor</p>
                              <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.secondaryGuarantor || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Guarantor Name</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryGuarantorName || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Guarantor DOB</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryGuarantorDOB ? formatDate(formik.values.secondaryGuarantorDOB) : '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Co-Pay Amount</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryCoPay ? `$${formik.values.secondaryCoPay}` : '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medical Group / IPA</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryMedicalGroup || '-'}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Care Physician (PCP)</p>
                              <p className="text-sm font-semibold text-gray-900">{formik.values.secondaryPcp || '-'}</p>
                            </div>
                         </div>
                     </div>
                  )}

                   {/* Emergency Contact */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                     <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                       <User className="w-5 h-5 text-primary" />
                       Emergency Contact
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.emergencyName || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relation</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formik.values.emergencyRelation || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.emergencyPhone || '-'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.emergencyAddress || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">City</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.emergencyCity || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">State</p>
                          <p className="text-sm font-semibold text-gray-900">{formatStateName(formik.values.emergencyState)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zip Code</p>
                          <p className="text-sm font-semibold text-gray-900">{formik.values.emergencyZip || '-'}</p>
                        </div>
                     </div>
                  </div>

                  {/* Health Intake Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Health Intake Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1 lg:col-span-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chief Complaint</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                          {formik.values.healthIntake?.chiefComplaint?.reasonForVisit || '-'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.healthIntake?.chiefComplaint?.duration || '-'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Severity</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.healthIntake?.chiefComplaint?.severity || '-'}
                        </p>
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medical Conditions</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formik.values.healthIntake?.pastMedicalHistory?.conditions?.length
                            ? formik.values.healthIntake.pastMedicalHistory.conditions.join(', ')
                            : '-'}
                        </p>
                      </div>
                      <div className="space-y-1 lg:col-span-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Surgical History</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                          {formik.values.healthIntake?.surgicalHistory?.procedures || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Labs & Documents Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Labs & Documents
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lab Reports</p>
                        {labReports.length > 0 ? (
                          <ul className="space-y-1">
                            {labReports.map((f) => (
                              <li key={f.id} className="text-sm font-medium text-gray-900">
                                {f.name} ({formatFileSize(f.size)})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No documents uploaded</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Medical Documents</p>
                        {medicalDocuments.length > 0 ? (
                          <ul className="space-y-1">
                            {medicalDocuments.map((f) => (
                              <li key={f.id} className="text-sm font-medium text-gray-900">
                                {f.name} ({formatFileSize(f.size)})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No documents uploaded</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Additional Notes</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                          {additionalNotes || 'No notes provided'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Appointment Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.provider?.name || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Visit Type</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.visitType?.visitReasonName || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Visit Reason</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.visitReason || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Location</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.serviceLocation?.name || formik.values.appointment?.serviceLocation?.displayName || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Visit Mode</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.visitMode || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Appointment Date</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.appointmentDate || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time Slot</p>
                        <p className="text-sm font-semibold text-gray-900">{formik.values.appointment?.timeSlot || '-'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">{formik.values.appointment?.notes || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Consent & Acknowledgement */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Consent & Acknowledgement
                    </h3>
                   <div className="flex items-center gap-3 ml-1">

  <input
    type="checkbox"
    id="acknowledgeNoticeOfPrivacyPractices"
    checked={formik.values.acknowledgeNoticeOfPrivacyPractices}
    onChange={(e) =>
      formik.setFieldValue(
        "acknowledgeNoticeOfPrivacyPractices",
        e.target.checked
      )
    }
    className="h-4 w-4 accent-primary cursor-pointer -mt-2"
  />

  <label
    htmlFor="acknowledgeNoticeOfPrivacyPractices"
    className="text-sm text-gray-800 cursor-pointer"
  >
    I acknowledge the Notice of Privacy Practices.
  </label>

</div>
                  </div>

                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-6 mt-4 border-t border-gray-100 flex justify-between items-center px-4 sm:px-0">
              {currentStep > 1 ? (
                <Button 
                  type="button" 
                  onClick={handleBack} 
                  variant="outline"
                  className="gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <div className="flex flex-col">
                   <span className="text-sm text-gray-500">Already a member?</span>
                   <button
  type="button"
  onClick={handleSignInClick}
  className="text-sm font-semibold text-primary hover:underline text-left"
>
  Sign in
</button>                </div>
              )}

              {currentStep < 6 ? (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  className="bg-gradient-to-r from-[#4A5568] to-primary hover:opacity-90 gap-2 text-white cursor-pointer"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={formik.isSubmitting || !formik.values.acknowledgeNoticeOfPrivacyPractices}
                  className="bg-gradient-to-r from-[#4A5568] to-primary hover:opacity-90 gap-2 text-white min-w-[120px] cursor-pointer disabled:cursor-not-allowed"
                >
                   {formik.isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      Submit Application <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
