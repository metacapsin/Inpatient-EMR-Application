-- Vitals / labs / imaging: retire the duplicate lab_documents store (BUG-13), a stable-id lab test
-- catalog + per-specimen tracking (SAF-25), code-event notes persist for real (SAF-26), and
-- structured imaging pregnancy/contrast-safety fields.

-- BUG-13: nothing creates new lab_documents rows (confirmed — only a seed script ever did), and the
-- Labs tab showed it side by side with the real structured lab_results pipeline with no real
-- distinction. Retired; lab_results is the only lab store now.
DROP TABLE lab_documents;

-- SAF-25a: a stable-id catalog so order completion can match on something sturdier than a lowercased
-- test-name string. Existing free-text test names that aren't in this catalog keep matching by name
-- exactly as before — this is additive, not a breaking change to the matching behavior.
CREATE TABLE lab_test_catalog (
    code             TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    default_specimen TEXT,
    loinc_code       TEXT
);
INSERT INTO lab_test_catalog (code, name, default_specimen, loinc_code) VALUES
    ('CBC',    'CBC',                       'Blood', '58410-2'),
    ('BMP',    'Basic metabolic panel',      'Blood', '51990-0'),
    ('CMP',    'Comprehensive metabolic panel', 'Blood', '24323-8'),
    ('LIPID',  'Lipid panel',                'Blood', '57698-3'),
    ('TROP',   'Troponin',                   'Blood', '10839-9'),
    ('BNP',    'BNP',                        'Blood', '30934-4'),
    ('LACTATE','Lactate',                    'Blood', '2524-7'),
    ('BCX',    'Blood cultures',             'Blood', '600-7'),
    ('MG',     'Magnesium',                  'Blood', '19123-9'),
    ('NA',     'Sodium',                     'Blood', '2951-2'),
    ('K',      'Potassium',                  'Blood', '2823-3'),
    ('CR',     'Creatinine',                 'Blood', '2160-0'),
    ('GLU',    'Glucose',                    'Blood', '2345-7'),
    ('HGB',    'Hemoglobin',                 'Blood', '718-7'),
    ('INR',    'PT/INR',                     'Blood', '34714-6'),
    ('PTT',    'PTT',                        'Blood', '14979-9'),
    ('UA',     'Urinalysis',                 'Urine', '24357-6'),
    ('TSH',    'TSH',                        'Blood', '3016-3'),
    ('A1C',    'HbA1c',                      'Blood', '4548-4'),
    ('TYPESCR','Blood type and screen',       'Blood', '34532-2');

-- SAF-25b: per-specimen tracking. The old scalar accession_number/specimen_type columns stay (now
-- holding the first specimen's values, for any existing reader that only looks at those) but
-- `specimens` is the real source of truth going forward — one entry per distinct specimen type the
-- order's tests actually need, not one for the whole order.
ALTER TABLE lab_orders ADD COLUMN specimens JSONB NOT NULL DEFAULT '[]'::jsonb;

-- SAF-26: code-event "generate note" now actually persists; no schema change needed for the text
-- itself (it reuses clinical_notes), but it needs its own note type so these aren't mistaken for
-- ordinary physician progress notes.
ALTER TABLE clinical_notes DROP CONSTRAINT clinical_notes_note_type_check;
ALTER TABLE clinical_notes ADD CONSTRAINT clinical_notes_note_type_check
    CHECK (note_type IN ('hp', 'progress', 'discharge_summary', 'consult', 'code_event'));

-- Imaging safety: pregnancy status and contrast-allergy status as real coded fields instead of text
-- flattened into specialInstructions (the UI already collects pregnancy status as a structured
-- dropdown — it just never reached a structured column).
ALTER TABLE radiology_orders ADD COLUMN pregnancy_status TEXT;
ALTER TABLE radiology_orders ADD COLUMN contrast_allergy TEXT CHECK (contrast_allergy IS NULL OR contrast_allergy IN ('none', 'unknown', 'confirmed'));
