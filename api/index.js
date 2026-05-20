/**
 * Mount on EMR Express app:
 *   const carePlanRoutes = require('./api/routes/carePlanRoutes');
 *   app.use('/api/CarePlan', carePlanRoutes);
 */
module.exports = {
    carePlanRoutes: require('./routes/carePlanRoutes'),
};
