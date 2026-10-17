export interface MedicationExplanation {
  medicationName: string;
  medicationType: string;
  usedFor: string[];
  howItWorks: string;
  howToTake: {
    dose: string;
    route: string;
    duration: string;
    instructions: string[];
  };
  importantPrecautions: string[];
  commonSideEffects: string[];
  seriousSideEffects: string[];
  whenToContactDoctor: string[];
  additionalNotes: string;
}

export interface ParsedMedicationData {
  brandName: string;
  genericName: string;
  strength: string;
  route: string;
  type: string;
  description: string;
  doseInstruction: string;
  duration: string;
  quantity: string;
  startDate: string;
  stopDate: string;
  frequency: string;
  refills: string;
}
