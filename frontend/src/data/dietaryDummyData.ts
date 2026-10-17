export const DIET_TYPES = [
    'Regular',
    'Cardiac (Low Na <2g)',
    'Diabetic (Consistent Carb)',
    'Renal (Low K/Phos)',
    'Low Fat',
    'Neutropenic',
    'Clear Liquid',
    'Full Liquid',
    'Pureed',
    'Mechanical Soft',
    'NPO',
    'TPN Only',
    'Tube Feeding',
    'Bariatric',
] as const;

export type DietType = (typeof DIET_TYPES)[number];

export const RELIGIOUS_RESTRICTIONS = ['No Pork', 'Kosher', 'Halal', 'Vegetarian', 'Vegan'] as const;

export const ALLERGEN_RESTRICTIONS = ['Gluten-Free', 'Lactose-Free', 'Nut-Free', 'Shellfish-Free'] as const;

export const DIET_PRIORITIES = ['Routine', 'Now'] as const;

export const SUPPLEMENT_FREQUENCIES = ['BID', 'TID', 'QID'] as const;

export interface DietaryPatient {
    name: string;
    mrn: string;
    age: number;
    ward: string;
    allergies: string[];
}

export interface DietOrder {
    id: string;
    dietType: DietType;
    caloricTarget?: number;
    proteinTarget?: number;
    fluidRestriction?: boolean;
    fluidLimit?: number;
    religiousRestrictions: string[];
    allergenRestrictions: string[];
    supplementalNutrition?: boolean;
    supplementProduct?: string;
    supplementFrequency?: string;
    tubeFeedingFormula?: string;
    tubeFeedingRate?: number;
    priority: 'Routine' | 'Now';
    effectiveFrom: string;
    specialInstructions?: string;
    orderedBy: string;
    status: 'Active' | 'Discontinued';
}

export const DIETARY_PATIENT: DietaryPatient = {
    name: 'Rajesh Kumar Sharma',
    mrn: 'MRN-2024-8871',
    age: 58,
    ward: 'Cardiology Ward 3',
    allergies: ['Shellfish', 'Lactose', 'Penicillin'],
};

export function createInitialDietOrders(): DietOrder[] {
    return [
        {
            id: 'DO-2024-0041',
            dietType: 'Cardiac (Low Na <2g)',
            caloricTarget: 1800,
            fluidRestriction: true,
            fluidLimit: 1500,
            religiousRestrictions: [],
            allergenRestrictions: ['Shellfish-Free', 'Lactose-Free'],
            priority: 'Routine',
            effectiveFrom: '2024-11-18T08:00:00.000Z',
            orderedBy: 'Dr. Priya Mehta',
            status: 'Active',
        },
        {
            id: 'DO-2024-0038',
            dietType: 'Clear Liquid',
            religiousRestrictions: [],
            allergenRestrictions: [],
            priority: 'Now',
            effectiveFrom: '2024-11-16T14:30:00.000Z',
            orderedBy: 'Dr. Arjun Singh',
            status: 'Discontinued',
        },
    ];
}
