/**
 * Inpatient quality bundle rule engine.
 * Cron: evaluate all active encounters every 4 hours.
 */

const SEP1_RULES = [
    'Blood cultures ordered within 3h',
    'Broad-spectrum antibiotics within 3h',
    'Lactate measured within 3h',
    'IV fluid bolus if lactate ≥4',
    'Vasopressors if MAP <65 after fluids',
];

const VTE_RULES = [
    'Risk assessment within 24h',
    'Pharmacological prophylaxis',
    'Mechanical prophylaxis if contraindicated',
];

const CAUTI_RULES = [
    'Foley indication documented',
    'Daily necessity reassessment',
    'Removal of unnecessary foley',
];

const FALL_RULES = [
    'Morse Fall Scale completed',
    'High-risk interventions documented',
    'Fall precautions active',
];

const BUNDLE_RULES = {
    sep1: SEP1_RULES,
    vte: VTE_RULES,
    cauti: CAUTI_RULES,
    fall: FALL_RULES,
};

/**
 * @param {import('../models/QualityMeasure').QualityMeasure} measure
 * @returns {Promise<import('../models/QualityMeasure').QualityMeasure>}
 */
async function evaluateEncounterMeasure(measure) {
    measure.lastEvaluatedAt = new Date();
    for (const bundle of measure.bundles || []) {
        const ruleNames = BUNDLE_RULES[bundle.bundleKey];
        if (!ruleNames) continue;
        for (const element of bundle.elements || []) {
            if (!ruleNames.includes(element.elementName)) continue;
            // Placeholder: clinical source integration sets status/due/completed fields.
        }
    }
    await measure.save();
    return measure;
}

module.exports = {
    BUNDLE_RULES,
    evaluateEncounterMeasure,
};
