// Teaching-case CDS interaction rules (source='stub').
// NOT a validated clinical knowledge base — development and automated tests only.
import { pool } from './pool.js';
import { pathToFileURL } from 'node:url';

/** @type {Array<{ruleType:string, rxnormCodeA:string, rxnormCodeB?:string|null, allergyClass?:string|null, severity:string, description:string}>} */
const STUB_RULES = [
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '11289',
        rxnormCodeB: '1191',
        severity: 'major',
        description: 'Warfarin + aspirin: increased bleeding risk (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '11289',
        rxnormCodeB: '5640',
        severity: 'major',
        description: 'Warfarin + NSAID (ibuprofen): increased bleeding risk (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '29046',
        rxnormCodeB: '8591',
        severity: 'moderate',
        description: 'Lisinopril + potassium: hyperkalemia risk (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '36567',
        rxnormCodeB: '703',
        severity: 'major',
        description: 'Simvastatin + amiodarone: myopathy / rhabdomyolysis risk (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '6918',
        rxnormCodeB: '11170',
        severity: 'moderate',
        description: 'Metoprolol + verapamil: additive bradycardia / AV block risk (teaching stub).',
    },
    {
        ruleType: 'drug_allergy_class',
        rxnormCodeA: '723',
        allergyClass: 'penicillins',
        severity: 'contraindicated',
        description: 'Amoxicillin contraindicated with penicillin-class allergy (teaching stub).',
    },
    {
        ruleType: 'drug_allergy_class',
        rxnormCodeA: '10831',
        allergyClass: 'sulfonamides',
        severity: 'contraindicated',
        description: 'TMP-SMX contraindicated with sulfonamide-class allergy (teaching stub).',
    },
    {
        ruleType: 'drug_allergy_class',
        rxnormCodeA: '1191',
        allergyClass: 'salicylates',
        severity: 'major',
        description: 'Aspirin with salicylate-class allergy (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '11289',
        rxnormCodeB: '10831',
        severity: 'moderate',
        description: 'Warfarin + TMP-SMX: INR elevation risk (teaching stub).',
    },
    {
        ruleType: 'drug_drug',
        rxnormCodeA: '19711',
        rxnormCodeB: '703',
        severity: 'moderate',
        description: 'Atorvastatin + amiodarone: myopathy monitoring (teaching stub).',
    },
];

/**
 * Idempotent insert of stub CDS rules. Safe to call on every seed.
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 */
export async function seedCdsRules(db = pool) {
    for (const r of STUB_RULES) {
        const exists = await db.query(
            `SELECT 1 FROM drug_interaction_rules
             WHERE rule_type = $1 AND rxnorm_code_a = $2
               AND COALESCE(rxnorm_code_b, '') = COALESCE($3, '')
               AND COALESCE(allergy_class, '') = COALESCE($4, '')
               AND source = 'stub'
             LIMIT 1`,
            [r.ruleType, r.rxnormCodeA, r.rxnormCodeB ?? null, r.allergyClass ?? null],
        );
        if (exists.rowCount) continue;
        await db.query(
            `INSERT INTO drug_interaction_rules
               (rule_type, rxnorm_code_a, rxnorm_code_b, allergy_class, severity, description, source)
             VALUES ($1,$2,$3,$4,$5,$6,'stub')`,
            [r.ruleType, r.rxnormCodeA, r.rxnormCodeB ?? null, r.allergyClass ?? null, r.severity, r.description],
        );
    }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    seedCdsRules()
        .then(() => {
            console.log('[seedCds] stub teaching rules upserted');
            return pool.end();
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}
