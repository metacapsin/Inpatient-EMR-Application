// Development seed data. Credentials come from backend/.env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) and are never hardcoded.
//   npm run db:seed            -> seeds once (no-op if already seeded)
//   npm run db:seed -- --reset -> wipes ALL data, then seeds
import bcrypt from 'bcryptjs';
import { isProd } from '../config.js';
import { pool, withTx } from './pool.js';
import { seedOpsDemo } from './seedOps.js';

const NANDA = [
    ['00146', 'Risk for Falls', 'Vulnerable to increased susceptibility to falling.'],
    ['00085', 'Risk for Impaired Skin Integrity', 'Vulnerable to alteration in epidermis and/or dermis.'],
    ['00132', 'Acute Pain', 'Unpleasant sensory and emotional experience from actual or potential tissue damage.'],
    ['00004', 'Risk for Infection', 'Vulnerable to invasion and multiplication of pathogenic organisms.'],
    ['00031', 'Impaired Gas Exchange', 'Excess or deficit in oxygenation and/or carbon dioxide elimination.'],
    ['00047', 'Risk for Aspiration', 'Vulnerable to entry of gastrointestinal secretions into tracheobronchial passages.'],
    ['00242', 'Risk for Decreased Cardiac Output', 'Vulnerable to inadequate blood pumped by the heart.'],
    ['00155', 'Ineffective Breathing Pattern', 'Inspiration and/or expiration that does not provide adequate ventilation.'],
    ['00141', 'Deficient Fluid Volume', 'Decreased intravascular, interstitial, and/or intracellular fluid.'],
    ['00026', 'Imbalanced Nutrition: Less Than Body Requirements', 'Intake of nutrients insufficient to meet metabolic needs.'],
];

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env before seeding.');
    process.exit(1);
}
if (isProd && !process.env.SEED_ALLOW_PROD) {
    console.error('Refusing to seed demo data in production (set SEED_ALLOW_PROD=1 to override).');
    process.exit(1);
}
const reset = process.argv.includes('--reset');

async function run() {
    if (reset) {
        await pool.query('TRUNCATE tenants, nanda_diagnoses RESTART IDENTITY CASCADE');
        console.log('[seed] existing data wiped');
    }
    if ((await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])).rowCount) {
        // Modules added after the first seed (appointments, records, staffing, radiology) get their demo data on re-runs.
        const tenantId = (await pool.query('SELECT tenant_id FROM users WHERE lower(email) = lower($1)', [email])).rows[0].tenant_id;
        const added = await withTx((db) => seedOpsDemo(db, tenantId, { password }));
        console.log(added ? '[seed] already seeded; added demo data for scheduling/records/staffing/radiology' : '[seed] already seeded (use -- --reset to start over)');
        return;
    }
    const hash = await bcrypt.hash(password, 10);
    const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000).toISOString();

    await withTx(async (db) => {
        for (const [code, label, definition] of NANDA) {
            await db.query('INSERT INTO nanda_diagnoses (code,label,definition) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [code, label, definition]);
        }
        const t = (await db.query(`INSERT INTO tenants (name) VALUES ('Demo General Hospital') RETURNING id`)).rows[0].id;

        const domain = email.split('@')[1] || 'emr.local';
        const users = [
            [email, 'admin', 'Alex', 'Admin'],
            [`physician@${domain}`, 'physician', 'Sarah', 'Chen'],
            [`nurse@${domain}`, 'nurse', 'Priya', 'Nair'],
            [`pharmacist@${domain}`, 'pharmacist', 'Omar', 'Haddad'],
            [`billing@${domain}`, 'billing', 'Jordan', 'Blake'],
        ];
        for (const [e, role, f, l] of users) {
            await db.query('INSERT INTO users (tenant_id,email,username,password_hash,first_name,last_name,role) VALUES ($1,$2,$3,$4,$5,$6,$7)', [t, e, e.split('@')[0], hash, f, l, role]);
        }

        // Facility: ward -> rooms -> beds
        const layout = [
            ['ICU', 'ICU', [['ICU-101', 'ICU', ['Bed-1', 'Bed-2']], ['ICU-102', 'ICU', ['Bed-1']]]],
            ['Medical-Surgical 3 East', '3E', [['301', 'General', ['301-A', '301-B']], ['302', 'General', ['302-A']]]],
            ['Telemetry 2 West', '2W', [['210', 'Telemetry', ['210-A', '210-B']]]],
        ];
        const bedIds = {};
        for (const [wname, code, rooms] of layout) {
            const w = (await db.query('INSERT INTO wards (tenant_id,name,code) VALUES ($1,$2,$3) RETURNING id', [t, wname, code])).rows[0].id;
            for (const [rn, rtype, beds] of rooms) {
                const r = (await db.query('INSERT INTO rooms (tenant_id,ward_id,room_number,room_type) VALUES ($1,$2,$3,$4) RETURNING id', [t, w, rn, rtype])).rows[0].id;
                for (const b of beds) {
                    bedIds[`${rn}/${b}`] = (await db.query('INSERT INTO beds (tenant_id,room_id,label) VALUES ($1,$2,$3) RETURNING id', [t, r, b])).rows[0].id;
                }
            }
        }

        const patients = [
            ['Margaret', 'Holloway', '1948-03-14', 'F', '555-0101'],
            ['Daniel', 'Okafor', '1975-11-02', 'M', '555-0102'],
            ['Chen', 'Wei', '1990-07-23', 'M', '555-0103'],
            ['Isabella', 'Rossi', '2012-01-30', 'F', '555-0104'],
            ['Robert', 'Singh', '1958-09-09', 'M', '555-0105'],
            ['Aisha', 'Khan', '1983-05-18', 'F', '555-0106'],
        ];
        const pid = [];
        for (const [i, [f, l, dob, sex, phone]] of patients.entries()) {
            const r = await db.query(
                `INSERT INTO patients (tenant_id,mrn,first_name,last_name,dob,sex,mobile_phone,email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                [t, `MRN${String(i + 1).padStart(6, '0')}`, f, l, dob, sex, phone, `${f}.${l}@example.test`.toLowerCase()],
            );
            pid.push(r.rows[0].id);
        }

        // Two current inpatients
        const admit = async (patient, bedKey, dx) => {
            const e = (await db.query(
                `INSERT INTO encounters (tenant_id,patient_id,bed_id,admission_type,diagnosis,admitted_at) VALUES ($1,$2,$3,'emergency',$4, now() - interval '2 days') RETURNING id`,
                [t, patient, bedIds[bedKey], dx],
            )).rows[0].id;
            await db.query(`UPDATE beds SET status='occupied' WHERE id=$1`, [bedIds[bedKey]]);
            return e;
        };
        const enc1 = await admit(pid[0], 'ICU-101/Bed-1', 'Community-acquired pneumonia');
        await admit(pid[1], '301/301-A', 'Post-operative monitoring');

        // Medications / MAR / PRN / prescription for patient 0
        const meds = [['Lisinopril', '10 mg', 'PO', 'Daily', 2], ['Metformin', '500 mg', 'PO', 'BID', 4]];
        for (const [name, dose, route, freq, h] of meds) {
            const m = (await db.query(`INSERT INTO medications (tenant_id,patient_id,name,dose,route,frequency,next_scheduled_time) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [t, pid[0], name, dose, route, freq, hoursFromNow(h)])).rows[0].id;
            await db.query(`INSERT INTO mar_entries (tenant_id,patient_id,medication_id,medication_name,scheduled_time,status) VALUES ($1,$2,$3,$4,$5,'due')`, [t, pid[0], m, name, hoursFromNow(h)]);
        }
        await db.query(`INSERT INTO prescriptions (tenant_id,patient_id,medicines,prescriber_name) VALUES ($1,$2,$3,'Dr. Sarah Chen')`, [
            t, pid[0], JSON.stringify([{ medicineId: 'med-amox-500', name: 'Amoxicillin', strength: '500 mg', quantityOrdered: 21, unitPrice: 0.45 }]),
        ]);

        await db.query(`INSERT INTO visitors (tenant_id,patient_id,first_name,check_in_at,status,restrictions) VALUES ($1,$2,'Eleanor',now() - interval '1 hour','checked-in','Max 2 visitors')`, [t, pid[0]]);
        await db.query(`INSERT INTO family_contacts (tenant_id,patient_id,first_name,last_name,mobile_phone,relationship,is_emergency_contact) VALUES ($1,$2,'Thomas','Holloway','555-0199','Son',true)`, [t, pid[0]]);

        for (const [type, p, s, unit] of [['blood_pressure', 128, 82, 'mmHg'], ['heart_rate', 76, null, 'bpm'], ['temperature', 99.1, null, 'F'], ['oxygen_saturation', 95, null, '%']]) {
            await db.query(`INSERT INTO health_metrics (tenant_id,patient_id,metric_type,value_primary,value_secondary,unit,recorded_at) VALUES ($1,$2,$3,$4,$5,$6, now() - interval '1 hour')`, [t, pid[0], type, p, s, unit]);
        }

        await db.query(`INSERT INTO io_records (tenant_id,patient_id,encounter_id,record_type,intake_category,fluid_type,volume_ml,recorded_at,recorded_by_name) VALUES ($1,$2,$3,'Intake','IV','Normal Saline',500, now() - interval '2 hours','Seed')`, [t, pid[0], enc1]);
        await db.query(`INSERT INTO io_records (tenant_id,patient_id,encounter_id,record_type,output_category,volume_ml,recorded_at,recorded_by_name) VALUES ($1,$2,$3,'Output','Urine',300, now() - interval '30 minutes','Seed')`, [t, pid[0], enc1]);
        await seedOpsDemo(db, t, { password });
    });
    console.log(`[seed] done. Log in as ${email} with the SEED_ADMIN_PASSWORD from backend/.env (other demo users use the same password).`);
}

run()
    .then(() => pool.end())
    .catch((e) => {
        console.error('[seed] failed:', e.message);
        process.exit(1);
    });

