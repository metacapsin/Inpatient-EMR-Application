/**
 * Quality measure document — bundle elements evaluated per encounter.
 * Rule engine (qualityMeasureRuleService) runs every 4 hours via cron.
 */
const mongoose = require('mongoose');

const elementSchema = new mongoose.Schema(
    {
        elementName: { type: String, required: true },
        status: {
            type: String,
            enum: ['compliant', 'pending', 'deficient', 'na'],
            default: 'pending',
        },
        dueBy: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        completedBy: { type: String, default: null },
        overdueBy: { type: String, default: null },
        notes: { type: String, default: null },
        assignTo: { type: String, default: null },
    },
    { _id: true },
);

const bundleSchema = new mongoose.Schema(
    {
        bundleKey: {
            type: String,
            enum: ['sep1', 'vte', 'glycemic', 'cauti', 'clabsi', 'fall', 'pressure'],
            required: true,
        },
        elements: [elementSchema],
    },
    { _id: false },
);

const qualityMeasureSchema = new mongoose.Schema(
    {
        encounterId: { type: String, required: true, index: true },
        patientId: { type: String },
        unitId: { type: String, index: true },
        lastEvaluatedAt: { type: Date },
        bundles: [bundleSchema],
    },
    { timestamps: true },
);

module.exports =
    mongoose.models.QualityMeasure ||
    mongoose.model('QualityMeasure', qualityMeasureSchema);
