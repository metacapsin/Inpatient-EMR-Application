// Demo data for appointments, patient record lists, staffing/scheduling and radiology.
// Idempotent: does nothing when the tenant already has service locations. Called by seed.js (fresh seed and re-runs).
import bcrypt from 'bcryptjs';

export async function seedOpsDemo(db, tenantId, { password }) {
    if ((await db.query('SELECT 1 FROM service_locations WHERE tenant_id = $1', [tenantId])).rowCount) return false;
    const one = async (sql, params) => (await db.query(sql, params)).rows[0];
    const t = tenantId;

    const admin = await one(`SELECT email FROM users WHERE tenant_id = $1 AND role = 'admin' ORDER BY created_at LIMIT 1`, [t]);
    const domain = admin.email.split('@')[1];
    const physician = await one(`SELECT id FROM users WHERE tenant_id = $1 AND role = 'physician' ORDER BY created_at LIMIT 1`, [t]);
    const nurse1 = await one(`SELECT id FROM users WHERE tenant_id = $1 AND role = 'nurse' ORDER BY created_at LIMIT 1`, [t]);
    const wards = Object.fromEntries((await db.query('SELECT id, code FROM wards WHERE tenant_id = $1', [t])).rows.map((w) => [w.code, w.id]));
    const patients = (await db.query('SELECT id FROM patients WHERE tenant_id = $1 ORDER BY mrn', [t])).rows.map((p) => p.id);
    const enc = await one(`SELECT id FROM encounters WHERE tenant_id = $1 AND patient_id = $2 AND status <> 'discharged'`, [t, patients[0]]);

    // --- appointments / calendar
    const loc = {};
    for (const [name, address] of [['Main Clinic', '1 Hospital Way'], ['Telehealth', 'Virtual']]) {
        loc[name] = (await one('INSERT INTO service_locations (tenant_id, name, address) VALUES ($1,$2,$3) RETURNING id', [t, name, address])).id;
    }
    const vt = {};
    for (const [name, mins] of [['Consultation', 30], ['Follow-up', 15], ['Initial Visit', 60]]) {
        vt[name] = (await one('INSERT INTO visit_types (tenant_id, visit_reason_name, duration) VALUES ($1,$2,$3) RETURNING id', [t, name, mins])).id;
    }
    const hours = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, { start: '09:00', end: '17:00' }]));
    for (const l of Object.values(loc)) {
        await db.query('INSERT INTO provider_calendar_settings (tenant_id, provider_id, service_location_id, weekly_hours) VALUES ($1,$2,$3,$4)', [t, physician.id, l, JSON.stringify(hours)]);
    }
    const appts = [
        [0, 1, '09:00', 'Consultation', 'Main Clinic', 'Scheduled'],
        [1, 2, '10:30', 'Follow-up', 'Telehealth', 'Confirmed'],
        [2, 3, '14:00', 'Initial Visit', 'Main Clinic', 'Scheduled'],
        [-2, 4, '11:00', 'Follow-up', 'Main Clinic', 'Completed'],
        [3, 5, '15:30', 'Consultation', 'Telehealth', 'Scheduled'],
    ];
    for (const [dayOffset, pi, time, v, l, status] of appts) {
        await db.query(
            `INSERT INTO appointments (tenant_id, patient_id, provider_id, service_location_id, visit_type_id, start_date, start_time, duration, status, visit_reason_msg, created_by)
             VALUES ($1,$2,$3,$4,$5, CURRENT_DATE + $6::int, $7::time, (SELECT duration FROM visit_types WHERE id = $5), $8, $9, $3)`,
            [t, patients[pi], physician.id, loc[l], vt[v], dayOffset, time, status, v],
        );
    }

    // --- patient record lists (patient 0)
    const p0 = patients[0];
    await db.query(`INSERT INTO patient_allergies (tenant_id, patient_id, allergen, allergy_type, reaction, severity, onset_date) VALUES ($1,$2,'Penicillin','Drug','Hives','Moderate','2015-04-01'), ($1,$2,'Latex','Ingredient','Rash','Mild','2019-09-12')`, [t, p0]);
    await db.query(
        `INSERT INTO patient_immunizations (tenant_id, patient_id, vaccine_name, vaccine_type, dose, unit, route, number_in_series, consent_obtained, ordered_date, ordered_time, provider, service_location)
         VALUES ($1,$2,'Influenza (seasonal)','Inactivated','0.5','mL','IM',1,'["Verbal"]', CURRENT_DATE - 30, '09:15 AM','Sarah Chen','Main Clinic'),
                ($1,$2,'Pneumococcal PCV20','Conjugate','0.5','mL','IM',1,'["Written"]', CURRENT_DATE - 400, '10:00 AM','Sarah Chen','Main Clinic')`,
        [t, p0],
    );
    const cat = {};
    for (const n of ['Medical', 'Surgical', 'Family', 'Social', 'Obstetric']) {
        cat[n] = (await one('INSERT INTO history_categories (tenant_id, name) VALUES ($1,$2) ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [t, n])).id;
    }
    await db.query(
        `INSERT INTO patient_history (tenant_id, patient_id, category_id, conditions, diagnosis_date, notes) VALUES
         ($1,$2,$3,'Hypertension','2010-06-15','Controlled on lisinopril'), ($1,$2,$3,'Type 2 diabetes','2014-02-20','Diet + metformin'), ($1,$2,$4,'Cholecystectomy','2003-11-05','Uncomplicated')`,
        [t, p0, cat.Medical, cat.Surgical],
    );
    await db.query(
        `INSERT INTO lab_orders (tenant_id, patient_id, encounter_id, lab_tests, order_status, priority, ordering_provider_name, office_notes)
         VALUES ($1,$2,$3,'[{"name":"CBC"},{"name":"Basic metabolic panel"}]','Resulted','Routine','Sarah Chen','Admission labs'),
                ($1,$2,$3,'[{"name":"Blood cultures x2"}]','In Progress','STAT','Sarah Chen','Rule out bacteremia')`,
        [t, p0, enc.id],
    );
    await db.query(
        `INSERT INTO lab_documents (tenant_id, patient_id, name, lab_name, value, unit, reference_range, lab_date) VALUES
         ($1,$2,'WBC','Hospital Lab','13.2','10^3/uL','4.0-11.0', CURRENT_DATE - 1), ($1,$2,'Hemoglobin','Hospital Lab','11.8','g/dL','12.0-15.5', CURRENT_DATE - 1),
         ($1,$2,'Creatinine','Hospital Lab','0.9','mg/dL','0.6-1.2', CURRENT_DATE - 1)`,
        [t, p0],
    );
    await db.query(
        `INSERT INTO patient_documents (tenant_id, patient_id, name, document_type, notes, mime_type, content) VALUES ($1,$2,'Admission summary.txt','Clinical summary','Seed document','text/plain',$3)`,
        [t, p0, Buffer.from('Admission summary (demo document).\nCommunity-acquired pneumonia, admitted to ICU.\n')],
    );

    // --- staffing & scheduling
    await db.query(`UPDATE wards SET care_model = 'ICU' WHERE id = $1`, [wards.ICU]);
    await db.query(`UPDATE wards SET care_model = 'Step-Down' WHERE id = $1`, [wards['2W']]);
    const hash = await bcrypt.hash(password, 10);
    const nurses = [nurse1.id];
    for (const [local, first, last] of [['nurse.lee', 'Jordan', 'Lee'], ['nurse.float', 'Sam', 'Patel']]) {
        nurses.push((await one(`INSERT INTO users (tenant_id,email,username,password_hash,first_name,last_name,role) VALUES ($1,$2,$3,$4,$5,$6,'nurse') RETURNING id`, [t, `${local}@${domain}`, local, hash, first, last])).id);
    }
    await db.query(
        `INSERT INTO staff_profiles (user_id, tenant_id, clinical_role, credentials, certifications, badges, home_ward_id, is_float_pool) VALUES
         ($1,$4,'RN','RN','["ACLS","BLS"]','["ICU Certified"]',$5,false),
         ($2,$4,'RN','RN','["BLS","TNCC"]','[]',$6,false),
         ($3,$4,'RN','RN','["ACLS","BLS","CCRN"]','["ICU Certified"]',null,true)`,
        [nurses[0], nurses[1], nurses[2], t, wards.ICU, wards['3E']],
    );
    for (const [ward, type, min] of [[wards.ICU, 'st-day', 2], [wards.ICU, 'st-night', 2], [wards['3E'], 'st-day', 2]]) {
        await db.query('INSERT INTO staff_coverage_rules (tenant_id, ward_id, shift_type_id, min_staff) VALUES ($1,$2,$3,$4)', [t, ward, type, min]);
    }
    // UTC day boundaries: day 07-19, night 19-07(+1). nurse0: ICU day, nurse1: ICU night, nurse2 (float): 3E day.
    const shiftSql = `INSERT INTO staff_shifts (tenant_id, staff_id, ward_id, shift_type_id, start_at, end_at, status, notes)
                      VALUES ($1,$2,$3,$4,(date_trunc('day', now() AT TIME ZONE 'UTC') + $5::int * interval '1 day' + $6::interval) AT TIME ZONE 'UTC',
                              (date_trunc('day', now() AT TIME ZONE 'UTC') + $5::int * interval '1 day' + $7::interval) AT TIME ZONE 'UTC', $8, $9)`;
    for (let d = -3; d <= 10; d++) {
        await db.query(shiftSql, [t, nurses[0], wards.ICU, 'st-day', d, '7 hours', '19 hours', 'scheduled', null]);
        await db.query(shiftSql, [t, nurses[1], wards.ICU, 'st-night', d, '19 hours', '31 hours', 'scheduled', null]);
        await db.query(shiftSql, [t, nurses[2], wards['3E'], 'st-day', d, '7 hours', '19 hours', 'scheduled', null]);
    }
    await db.query(shiftSql, [t, null, wards.ICU, 'st-day', 0, '7 hours', '19 hours', 'open', 'Coverage needed']);
    await db.query(shiftSql, [t, null, wards['3E'], 'st-night', 1, '19 hours', '31 hours', 'open', 'Coverage needed']);

    // --- radiology
    await db.query(
        `INSERT INTO radiology_orders (tenant_id, patient_id, encounter_id, modality, body_region, laterality, clinical_indication, icd10_codes, priority, ordered_by, ordered_by_name)
         VALUES ($1,$2,$3,'X-Ray','Chest','N/A','Pneumonia follow-up','["J18.9"]','Routine',$4,'Sarah Chen')`,
        [t, p0, enc.id, physician.id],
    );
    return true;
}
