// Dev-only: bootstraps a platform (Super Admin) account. There is no self-service signup for these
// by design (see the onboarding plan) — this is the only way to create the first one.
//   npm run db:seed:platform
import bcrypt from 'bcryptjs';
import { isProd } from '../config.js';
import { pool } from './pool.js';

const email = process.env.SEED_PLATFORM_ADMIN_EMAIL;
const password = process.env.SEED_PLATFORM_ADMIN_PASSWORD;
if (!email || !password) {
    console.error('Set SEED_PLATFORM_ADMIN_EMAIL and SEED_PLATFORM_ADMIN_PASSWORD in backend/.env before seeding.');
    process.exit(1);
}
if (isProd && !process.env.SEED_ALLOW_PROD) {
    console.error('Refusing to seed a platform admin in production (set SEED_ALLOW_PROD=1 to override).');
    process.exit(1);
}

async function run() {
    const existing = await pool.query('SELECT 1 FROM platform_admins WHERE lower(email) = lower($1)', [email]);
    if (existing.rowCount) {
        console.log(`[seed] platform admin ${email} already exists`);
        return;
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO platform_admins (email, password_hash) VALUES ($1,$2)', [email, hash]);
    console.log(`[seed] platform admin created. Log in at /platform/login as ${email} with SEED_PLATFORM_ADMIN_PASSWORD from backend/.env`);
}

run()
    .then(() => pool.end())
    .catch((e) => {
        console.error('[seed] failed:', e.message);
        process.exit(1);
    });
