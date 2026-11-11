// @ts-check
import { Router } from 'express';
import { z } from 'zod';
import { h, ok, parse } from '../lib/http.js';
import { searchDrugs, drugHitSchema } from '../lib/rxnav.js';

export const drugsRouter = Router();

drugsRouter.get(
    '/api/drugs/search',
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const { q } = parse(z.object({ q: z.string().trim().min(1).max(100) }), req.query);
        const hits = await searchDrugs(q);
        ok(res, z.array(drugHitSchema).parse(hits));
    }),
);
