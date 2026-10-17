import type { NandaSearchResult } from '../types/carePlan.types';

export const NANDA_CATALOG: NandaSearchResult[] = [
    { code: '00146', label: 'Risk for Falls', definition: 'Vulnerable to increased susceptibility to falling.' },
    { code: '00085', label: 'Risk for Impaired Skin Integrity', definition: 'Vulnerable to alteration in epidermis and/or dermis.' },
    { code: '00132', label: 'Acute Pain', definition: 'Unpleasant sensory and emotional experience from actual or potential tissue damage.' },
    { code: '00004', label: 'Risk for Infection', definition: 'Vulnerable to invasion and multiplication of pathogenic organisms.' },
    { code: '00031', label: 'Impaired Gas Exchange', definition: 'Excess or deficit in oxygenation and/or carbon dioxide elimination.' },
    { code: '00047', label: 'Risk for Aspiration', definition: 'Vulnerable to entry of gastrointestinal secretions into tracheobronchial passages.' },
    { code: '00242', label: 'Risk for Decreased Cardiac Output', definition: 'Vulnerable to inadequate blood pumped by the heart.' },
    { code: '00155', label: 'Ineffective Breathing Pattern', definition: 'Inspiration and/or expiration that does not provide adequate ventilation.' },
    { code: '00141', label: 'Deficient Fluid Volume', definition: 'Decreased intravascular, interstitial, and/or intracellular fluid.' },
    { code: '00026', label: 'Imbalanced Nutrition: Less Than Body Requirements', definition: 'Intake of nutrients insufficient to meet metabolic needs.' },
];

export function searchNandaCatalog(q: string): NandaSearchResult[] {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return NANDA_CATALOG.filter(
        (r) => r.code.toLowerCase().includes(term) || r.label.toLowerCase().includes(term)
    ).slice(0, 25);
}
