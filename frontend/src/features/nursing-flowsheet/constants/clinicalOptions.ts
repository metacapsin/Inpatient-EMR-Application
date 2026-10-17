import type { SelectOption } from '../types/nursingFlowsheet.types';

export const SHIFT_TYPE_OPTIONS: SelectOption[] = [
    { label: 'Day (7a–7p)', value: 'Day (7a–7p)' },
    { label: 'Evening (3p–11p)', value: 'Evening (3p–11p)' },
    { label: 'Night (7p–7a)', value: 'Night (7p–7a)' },
];

export const LEVEL_OF_CONSCIOUSNESS_OPTIONS: SelectOption[] = [
    { label: 'Alert', value: 'Alert' },
    { label: 'Responds to Voice', value: 'Responds to Voice' },
    { label: 'Responds to Pain', value: 'Responds to Pain' },
    { label: 'Unresponsive', value: 'Unresponsive' },
];

export const NEURO_ORIENTATION_OPTIONS: SelectOption[] = [
    { label: 'Person', value: 'Person' },
    { label: 'Place', value: 'Place' },
    { label: 'Time', value: 'Time' },
    { label: 'Event', value: 'Event' },
];

export const PUPIL_FINDING_OPTIONS: SelectOption[] = [
    { label: 'PERRL', value: 'PERRL' },
    { label: 'Fixed', value: 'Fixed' },
    { label: 'Sluggish', value: 'Sluggish' },
    { label: 'Dilated', value: 'Dilated' },
    { label: 'Constricted', value: 'Constricted' },
];

export const EXTREMITY_MOVEMENT_OPTIONS: SelectOption[] = [
    { label: 'Equal & Strong', value: 'Equal & Strong' },
    { label: 'Weakness Left', value: 'Weakness Left' },
    { label: 'Weakness Right', value: 'Weakness Right' },
    { label: 'Paralysis', value: 'Paralysis' },
];

export const HEART_RHYTHM_OPTIONS: SelectOption[] = [
    { label: 'Regular', value: 'Regular' },
    { label: 'Irregular', value: 'Irregular' },
    { label: 'A-Fib', value: 'A-Fib' },
    { label: 'A-Flutter', value: 'A-Flutter' },
    { label: 'Paced', value: 'Paced' },
];

export const PERIPHERAL_PULSE_GRADE_OPTIONS: SelectOption[] = [
    { label: '0 = Absent', value: '0 = Absent' },
    { label: '1+ = Weak', value: '1+ = Weak' },
    { label: '2+ = Normal', value: '2+ = Normal' },
    { label: '3+ = Bounding', value: '3+ = Bounding' },
];

export const CAPILLARY_REFILL_OPTIONS: SelectOption[] = [
    { label: '<2 sec', value: '<2 sec' },
    { label: '2–4 sec', value: '2–4 sec' },
    { label: '>4 sec', value: '>4 sec' },
];

export const EDEMA_DISTRIBUTION_OPTIONS: SelectOption[] = [
    { label: 'None', value: 'None' },
    { label: 'Bilateral', value: 'Bilateral' },
    { label: 'Unilateral', value: 'Unilateral' },
];

export const EDEMA_GRADE_OPTIONS: SelectOption[] = [
    { label: '1+ pitting', value: '1+ pitting' },
    { label: '2+ pitting', value: '2+ pitting' },
    { label: '3+ pitting', value: '3+ pitting' },
    { label: '4+ pitting', value: '4+ pitting' },
];

export const O2_DEVICE_OPTIONS: SelectOption[] = [
    { label: 'Room Air', value: 'Room Air' },
    { label: 'Nasal Cannula', value: 'Nasal Cannula' },
    { label: 'Venti Mask', value: 'Venti Mask' },
    { label: 'Non-Rebreather', value: 'Non-Rebreather' },
    { label: 'High-Flow NC', value: 'High-Flow NC' },
    { label: 'BiPAP', value: 'BiPAP' },
    { label: 'CPAP', value: 'CPAP' },
    { label: 'Mechanical Vent', value: 'Mechanical Vent' },
];

export const LUNG_SOUND_CHECKBOX_OPTIONS: SelectOption[] = [
    { label: 'Clear', value: 'Clear' },
    { label: 'Crackles', value: 'Crackles' },
    { label: 'Rhonchi', value: 'Rhonchi' },
    { label: 'Wheezing', value: 'Wheezing' },
    { label: 'Diminished', value: 'Diminished' },
    { label: 'Absent', value: 'Absent' },
];

export const COUGH_OPTIONS: SelectOption[] = [
    { label: 'None', value: 'None' },
    { label: 'Non-productive', value: 'Non-productive' },
    { label: 'Productive', value: 'Productive' },
];

export const SPUTUM_COLOR_OPTIONS: SelectOption[] = [
    { label: 'White', value: 'White' },
    { label: 'Yellow', value: 'Yellow' },
    { label: 'Green', value: 'Green' },
    { label: 'Bloody', value: 'Bloody' },
];

export const BOWEL_SOUND_OPTIONS: SelectOption[] = [
    { label: 'Active', value: 'Active' },
    { label: 'Hypoactive', value: 'Hypoactive' },
    { label: 'Hyperactive', value: 'Hyperactive' },
    { label: 'Absent', value: 'Absent' },
];

export const ABDOMEN_APPEARANCE_OPTIONS: SelectOption[] = [
    { label: 'Soft', value: 'Soft' },
    { label: 'Firm', value: 'Firm' },
    { label: 'Distended', value: 'Distended' },
    { label: 'Tender', value: 'Tender' },
    { label: 'Rigid', value: 'Rigid' },
];

export const DIET_TOLERANCE_OPTIONS: SelectOption[] = [
    { label: 'Tolerating Well', value: 'Tolerating Well' },
    { label: 'Intolerant', value: 'Intolerant' },
    { label: 'NPO', value: 'NPO' },
    { label: 'On Tube Feeding', value: 'On Tube Feeding' },
];

export const URINE_COLOR_OPTIONS: SelectOption[] = [
    { label: 'Clear', value: 'Clear' },
    { label: 'Yellow', value: 'Yellow' },
    { label: 'Dark Yellow', value: 'Dark Yellow' },
    { label: 'Amber', value: 'Amber' },
    { label: 'Bloody', value: 'Bloody' },
    { label: 'Cloudy', value: 'Cloudy' },
];

export const SKIN_COLOR_OPTIONS: SelectOption[] = [
    { label: 'Normal', value: 'Normal' },
    { label: 'Pale', value: 'Pale' },
    { label: 'Jaundiced', value: 'Jaundiced' },
    { label: 'Cyanotic', value: 'Cyanotic' },
    { label: 'Flushed', value: 'Flushed' },
    { label: 'Mottled', value: 'Mottled' },
];

export const SKIN_TEMPERATURE_OPTIONS: SelectOption[] = [
    { label: 'Warm', value: 'Warm' },
    { label: 'Cool', value: 'Cool' },
    { label: 'Diaphoretic', value: 'Diaphoretic' },
    { label: 'Clammy', value: 'Clammy' },
];

export const SKIN_TURGOR_OPTIONS: SelectOption[] = [
    { label: 'Normal', value: 'Normal' },
    { label: 'Poor (tenting)', value: 'Poor (tenting)' },
];

export const IV_ACCESS_TYPE_OPTIONS: SelectOption[] = [
    { label: 'Peripheral IV', value: 'Peripheral IV' },
    { label: 'PICC', value: 'PICC' },
    { label: 'Central Line', value: 'Central Line' },
    { label: 'Port', value: 'Port' },
    { label: 'Arterial Line', value: 'Arterial Line' },
];

export const IV_GAUGE_FRENCH_OPTIONS: SelectOption[] = [
    { label: '14G', value: '14G' },
    { label: '16G', value: '16G' },
    { label: '18G', value: '18G' },
    { label: '20G', value: '20G' },
    { label: '22G', value: '22G' },
    { label: '24G', value: '24G' },
    { label: '3 Fr', value: '3 Fr' },
    { label: '4 Fr', value: '4 Fr' },
    { label: '5 Fr', value: '5 Fr' },
    { label: '6 Fr', value: '6 Fr' },
    { label: '7 Fr', value: '7 Fr' },
];

export const IV_SITE_CONDITION_OPTIONS: SelectOption[] = [
    { label: 'Intact', value: 'Intact' },
    { label: 'Redness', value: 'Redness' },
    { label: 'Swelling', value: 'Swelling' },
    { label: 'Infiltration', value: 'Infiltration' },
    { label: 'Phlebitis', value: 'Phlebitis' },
    { label: 'Occlusion', value: 'Occlusion' },
];

export const PAIN_QUALITY_OPTIONS: SelectOption[] = [
    { label: 'Sharp', value: 'Sharp' },
    { label: 'Dull', value: 'Dull' },
    { label: 'Aching', value: 'Aching' },
    { label: 'Burning', value: 'Burning' },
    { label: 'Stabbing', value: 'Stabbing' },
    { label: 'Pressure', value: 'Pressure' },
    { label: 'Cramping', value: 'Cramping' },
];

export const MOBILITY_STATUS_OPTIONS: SelectOption[] = [
    { label: 'Independent', value: 'Independent' },
    { label: 'Supervision', value: 'Supervision' },
    { label: 'Assist x1', value: 'Assist x1' },
    { label: 'Assist x2', value: 'Assist x2' },
    { label: 'Total Care', value: 'Total Care' },
    { label: 'Bed Rest', value: 'Bed Rest' },
];

export const GAIT_OPTIONS: SelectOption[] = [
    { label: 'Steady', value: 'Steady' },
    { label: 'Unsteady', value: 'Unsteady' },
    { label: 'Unable to Ambulate', value: 'Unable to Ambulate' },
    { label: 'N/A', value: 'N/A' },
];

export const MOOD_AFFECT_OPTIONS: SelectOption[] = [
    { label: 'Calm', value: 'Calm' },
    { label: 'Anxious', value: 'Anxious' },
    { label: 'Agitated', value: 'Agitated' },
    { label: 'Lethargic', value: 'Lethargic' },
    { label: 'Depressed', value: 'Depressed' },
    { label: 'Confused', value: 'Confused' },
    { label: 'Combative', value: 'Combative' },
];

export const BEHAVIOR_OPTIONS: SelectOption[] = [
    { label: 'Cooperative', value: 'Cooperative' },
    { label: 'Uncooperative', value: 'Uncooperative' },
    { label: 'Restless', value: 'Restless' },
];

export const SAFETY_RISK_OPTIONS: SelectOption[] = [
    { label: 'Suicide', value: 'Suicide' },
    { label: 'Elopement', value: 'Elopement' },
    { label: 'Fall', value: 'Fall' },
];

export const PATIENT_EDUCATION_OPTIONS: SelectOption[] = [
    { label: 'Medications', value: 'Medications' },
    { label: 'Diagnosis', value: 'Diagnosis' },
    { label: 'Procedure', value: 'Procedure' },
    { label: 'Discharge instructions', value: 'Discharge instructions' },
    { label: 'Equipment use', value: 'Equipment use' },
];
