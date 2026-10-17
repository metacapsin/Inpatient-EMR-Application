import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isProd } from './config.js';
import { pool } from './db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter, publicAuthRouter } from './routes/auth.js';
import { facilityRouter } from './routes/facility.js';
import { patientsRouter } from './routes/patients.js';
import { adtRouter } from './routes/adt.js';
import { patientDataRouter } from './routes/patientData.js';
import { inpatientDocsRouter } from './routes/inpatientDocs.js';
import { consentRouter } from './routes/consent.js';
import { medicationRouter } from './routes/medication.js';
import { revenueRouter } from './routes/revenue.js';
import { dashboardRouter } from './routes/dashboard.js';
import { appointmentsRouter } from './routes/appointments.js';
import { recordsRouter } from './routes/records.js';
import { staffingRouter } from './routes/staffing.js';
import { clinicalOpsRouter } from './routes/clinicalOps.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    if (isProd) app.set('trust proxy', 1);

    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(
        cors({
            origin(origin, cb) {
                // Non-browser clients (curl, server-to-server) send no Origin header.
                if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
                cb(null, false);
            },
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Client-Route'],
            maxAge: 600,
        }),
    );
    // Signatures arrive as base64 data URLs, so allow a larger body than the 100kb default.
    app.use(express.json({ limit: '2mb' }));
    app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

    // --- health (public, no PHI)
    app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
    app.get('/health/db', async (_req, res) => {
        try {
            const r = await pool.query('SELECT version() AS version, now() AS now');
            res.json({ status: 'ok', database: 'connected', serverTime: r.rows[0].now });
        } catch (e) {
            console.error('[health/db]', e.message);
            res.status(503).json({ status: 'error', database: 'unreachable' });
        }
    });

    // --- API
    app.use(publicAuthRouter);
    app.use(authRouter); // authenticates itself
    app.use(requireAuth);
    for (const r of [facilityRouter, patientsRouter, adtRouter, patientDataRouter, inpatientDocsRouter, consentRouter, medicationRouter, revenueRouter, dashboardRouter, appointmentsRouter, recordsRouter, staffingRouter, clinicalOpsRouter]) {
        app.use(r);
    }

    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
