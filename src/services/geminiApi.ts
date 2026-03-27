import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedMedicationData } from '../types/medication';
import { MedicationExplanation } from '../types/medication';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyB9Y_C5EtFi1J7c3q2fntGKucGURH-bKn8';
const MODEL_NAME = 'gemini-3-flash-preview'; // Using gemini-3-flash-preview as specified

const genAI = new GoogleGenerativeAI(API_KEY);

const systemPrompt = `You are a medical information assistant that provides patient-friendly medication explanations. Your role is to explain medications in clear, simple language that patients can understand, while being accurate and medically sound.

When explaining medications, you should:
- Use simple, non-technical language
- Be concise but comprehensive
- Focus on what patients need to know
- Include practical information about taking the medication
- Mention important warnings and precautions
- List common and serious side effects
- Provide guidance on when to contact a doctor

Always structure your response as a valid JSON object with the following exact structure:
{
  "medicationName": "string",
  "medicationType": "string",
  "usedFor": ["string array"],
  "howItWorks": "string",
  "howToTake": {
    "dose": "string",
    "route": "string",
    "duration": "string",
    "instructions": ["string array"]
  },
  "importantPrecautions": ["string array"],
  "commonSideEffects": ["string array"],
  "seriousSideEffects": ["string array"],
  "whenToContactDoctor": ["string array"],
  "additionalNotes": "string"
}`;

export const generateMedicationExplanation = async (
  medicationData: ParsedMedicationData,
  prescriptionData?: any
): Promise<MedicationExplanation> => {
  try {
    const userPrompt = buildUserPrompt(medicationData, prescriptionData);
    const response = await callGeminiAPI(systemPrompt, userPrompt);
    return parseResponse(response);
  } catch (error: any) {
    console.error('Error generating medication explanation:', error);
    throw new Error(error.message || 'Failed to generate medication explanation');
  }
};

const buildUserPrompt = (medicationData: ParsedMedicationData, prescriptionData?: any): string => {
  const parts: string[] = [];
  
  parts.push('Please provide a patient-friendly explanation for the following medication:');
  parts.push('');
  
  if (medicationData.brandName) {
    parts.push(`Brand Name: ${medicationData.brandName}`);
  }
  if (medicationData.genericName) {
    parts.push(`Generic Name: ${medicationData.genericName}`);
  }
  if (medicationData.description) {
    parts.push(`Description: ${medicationData.description}`);
  }
  if (medicationData.strength) {
    parts.push(`Strength: ${medicationData.strength}`);
  }
  if (medicationData.route) {
    parts.push(`Route: ${medicationData.route}`);
  }
  if (medicationData.type) {
    parts.push(`Type: ${medicationData.type}`);
  }
  if (medicationData.doseInstruction) {
    parts.push(`Dose: ${medicationData.doseInstruction}`);
  }
  if (medicationData.frequency) {
    parts.push(`Frequency: ${medicationData.frequency}`);
  }
  if (medicationData.duration) {
    parts.push(`Duration: ${medicationData.duration}`);
  }
  if (medicationData.quantity) {
    parts.push(`Quantity: ${medicationData.quantity}`);
  }
  if (medicationData.refills) {
    parts.push(`Refills: ${medicationData.refills}`);
  }
  if (medicationData.startDate) {
    parts.push(`Start Date: ${medicationData.startDate}`);
  }
  if (medicationData.stopDate) {
    parts.push(`Stop Date: ${medicationData.stopDate}`);
  }
  
  parts.push('');
  parts.push('Please provide a comprehensive, patient-friendly explanation in the exact JSON format specified. If any information is not available, use appropriate defaults or indicate "Not specified".');
  
  return parts.join('\n');
};

const callGeminiAPI = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nRemember to respond ONLY with valid JSON, no additional text or markdown formatting.`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return cleanedText;
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
};

const parseResponse = (responseText: string): MedicationExplanation => {
  try {
    const parsed = JSON.parse(responseText);
    
    // Validate and ensure all required fields exist
    return {
      medicationName: parsed.medicationName || 'Unknown Medication',
      medicationType: parsed.medicationType || 'Not specified',
      usedFor: Array.isArray(parsed.usedFor) ? parsed.usedFor : [],
      howItWorks: parsed.howItWorks || 'Information not available',
      howToTake: {
        dose: parsed.howToTake?.dose || 'Not specified',
        route: parsed.howToTake?.route || 'Not specified',
        duration: parsed.howToTake?.duration || 'Not specified',
        instructions: Array.isArray(parsed.howToTake?.instructions) 
          ? parsed.howToTake.instructions 
          : [],
      },
      importantPrecautions: Array.isArray(parsed.importantPrecautions) 
        ? parsed.importantPrecautions 
        : [],
      commonSideEffects: Array.isArray(parsed.commonSideEffects) 
        ? parsed.commonSideEffects 
        : [],
      seriousSideEffects: Array.isArray(parsed.seriousSideEffects) 
        ? parsed.seriousSideEffects 
        : [],
      whenToContactDoctor: Array.isArray(parsed.whenToContactDoctor) 
        ? parsed.whenToContactDoctor 
        : [],
      additionalNotes: parsed.additionalNotes || '',
    };
  } catch (error: any) {
    console.error('Error parsing Gemini response:', error);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
};
