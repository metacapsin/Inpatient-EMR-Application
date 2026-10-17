import { ParsedMedicationData } from '../types/medication';

const first = (v: any): string => {
  if (v == null) return '';
  if (Array.isArray(v) && v.length > 0) return String(v[0] ?? '').trim();
  return String(v).trim();
};

export const parseMedicationData = (medicationRecord: any): ParsedMedicationData => {
  const sig = medicationRecord.Sig?.[0];
  const drug = sig?.Drug?.[0];
  const dosage = sig?.Dosage?.[0];
  const instruction = dosage?.InstructionList?.[0]?.Instruction?.[0];
  
  // Extract brand name
  const brandName = drug?.BrandName ? first(drug.BrandName) : '';
  
  // Extract generic name
  const genericName = drug?.GenericName ? first(drug.GenericName) : '';
  
  // Extract strength
  const strength = drug?.Strength ? first(drug.Strength) : '';
  
  // Extract route
  const route = drug?.Route ? first(drug.Route) : '';
  
  // Extract brand type
  const type = drug?.BrandType ? first(drug.BrandType) : '';
  
  // Extract drug description
  const description = drug?.DrugDescription ? first(drug.DrugDescription) : '';
  
  // Extract dose instruction
  const doseNumber = dosage?.InstructionList?.[0]?.Number 
    ? first(dosage.InstructionList[0].Number) 
    : '';
  const doseUnit = instruction?.DoseUnit 
    ? first(instruction.DoseUnit) 
    : '';
  const clinicalInstruction = instruction?.ClinicalInstruction 
    ? first(instruction.ClinicalInstruction) 
    : '';
  const doseInstruction = [doseNumber, doseUnit, clinicalInstruction]
    .filter(Boolean)
    .join(' ') || '';
  
  // Extract duration
  const duration = sig?.Duration ? first(sig.Duration) : '';
  
  // Extract quantity
  const quantity = sig?.Quantity ? first(sig.Quantity) : '';
  
  // Extract dates
  const startDate = medicationRecord.StartDate 
    ? (Array.isArray(medicationRecord.StartDate) 
        ? first(medicationRecord.StartDate[0]) 
        : first(medicationRecord.StartDate))
    : '';
  const stopDate = medicationRecord.StopDate 
    ? (Array.isArray(medicationRecord.StopDate) 
        ? first(medicationRecord.StopDate[0]) 
        : first(medicationRecord.StopDate))
    : '';
  
  // Extract frequency
  const frequency = medicationRecord.frequency || '';
  
  // Extract refills
  const refills = sig?.Refills ? first(sig.Refills) : '0';
  
  return {
    brandName,
    genericName,
    strength,
    route,
    type,
    description,
    doseInstruction,
    duration,
    quantity,
    startDate,
    stopDate,
    frequency,
    refills,
  };
};
