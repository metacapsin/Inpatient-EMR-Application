export interface BundleRuleSection {
    id: string;
    title: string;
    rules: string[];
}

export const BUNDLE_LOGIC_SECTIONS: BundleRuleSection[] = [
    {
        id: 'sep1',
        title: 'SEP-1 Sepsis Bundle',
        rules: [
            'Blood cultures ordered within 3h',
            'Broad-spectrum antibiotics within 3h',
            'Lactate measured within 3h',
            'IV fluid bolus if lactate ≥4',
            'Vasopressors if MAP <65 after fluids',
        ],
    },
    {
        id: 'vte',
        title: 'VTE Prophylaxis Bundle',
        rules: [
            'Risk assessment within 24h',
            'Pharmacological prophylaxis',
            'Mechanical prophylaxis if contraindicated',
        ],
    },
    {
        id: 'cauti',
        title: 'CAUTI Prevention',
        rules: [
            'Foley indication documented',
            'Daily necessity reassessment',
            'Removal of unnecessary foley',
        ],
    },
    {
        id: 'fall',
        title: 'Fall Prevention',
        rules: [
            'Morse Fall Scale completed',
            'High-risk interventions documented',
            'Fall precautions active',
        ],
    },
];
