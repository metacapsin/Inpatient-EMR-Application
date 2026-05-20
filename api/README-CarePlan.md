# Care Plan API (mount on EMR Express server)

```js
const carePlanRoutes = require('./api/routes/carePlanRoutes');
app.use('/api/CarePlan', carePlanRoutes);
```

Requires MongoDB connection via Mongoose (`CarePlan`, `NandaDiagnosis` models).

Endpoints:

- `GET /api/CarePlan/nanda/search?q=`
- `POST /api/CarePlan/create`
- `GET /api/CarePlan/:encounterId`
- `PUT /api/CarePlan/:planId`
- `PUT /api/CarePlan/:planId/goalStatus`

Frontend mock fallback: set `VITE_CARE_PLAN_MOCK` (default on unless `"false"`).
