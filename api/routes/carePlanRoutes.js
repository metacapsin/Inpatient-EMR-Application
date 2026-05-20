const express = require('express');
const {
    createCarePlan,
    getCarePlanByEncounter,
    updateCarePlan,
    updateGoalStatus,
    searchNanda,
} = require('../services/carePlanService');

const router = express.Router();

function requestUser(req) {
    const u = req.user || {};
    return {
        id: String(u.id || u._id || u.userId || '').trim(),
        name: String(
            u.name ||
                [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                u.email ||
                'Staff'
        ).trim(),
        tenantId: String(u.tenantId || u.tenant?.id || req.headers['x-tenant-id'] || '').trim(),
    };
}

/** GET /api/CarePlan/nanda/search?q= */
router.get('/nanda/search', async (req, res, next) => {
    try {
        const q = req.query.q;
        const data = await searchNanda(q);
        res.json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

/** POST /api/CarePlan/create */
router.post('/create', async (req, res, next) => {
    try {
        const user = requestUser(req);
        const data = await createCarePlan(req.body, user);
        res.status(201).json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

/** PUT /api/CarePlan/:planId/goalStatus */
router.put('/:planId/goalStatus', async (req, res, next) => {
    try {
        const user = requestUser(req);
        const data = await updateGoalStatus(req.params.planId, req.body, user);
        res.json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

router.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
        status: 'error',
        message: err.message || 'Care plan request failed',
    });
});

module.exports = router;
