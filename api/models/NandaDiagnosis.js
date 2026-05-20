const mongoose = require('mongoose');

const nandaDiagnosisSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, index: true },
        label: { type: String, required: true, index: true },
        definition: { type: String, default: '' },
    },
    { timestamps: true }
);

nandaDiagnosisSchema.index({ label: 'text', code: 'text' });

const NandaDiagnosis =
    mongoose.models.NandaDiagnosis || mongoose.model('NandaDiagnosis', nandaDiagnosisSchema);

/** Seed catalog when collection is empty (dev / first boot). */
const NANDA_SEED = [
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

async function ensureNandaSeed() {
    const count = await NandaDiagnosis.countDocuments();
    if (count > 0) return;
    await NandaDiagnosis.insertMany(NANDA_SEED);
}

module.exports = { NandaDiagnosis, ensureNandaSeed, NANDA_SEED };
