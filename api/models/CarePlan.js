const mongoose = require('mongoose');

const carePlanGoalSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        statement: { type: String, required: true },
        targetDate: { type: String, required: true },
        status: {
            type: String,
            enum: ['Not Met', 'Partially Met', 'Met'],
            default: 'Not Met',
        },
        evaluationNote: { type: String, default: '' },
    },
    { _id: false }
);

const carePlanInterventionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        frequency: {
            type: String,
            enum: ['Each Shift', 'Daily', 'BID', 'TID', 'QID', 'PRN', 'Continuous', 'Weekly'],
            required: true,
        },
        responsibleDiscipline: {
            type: String,
            enum: ['RN', 'LVN', 'CNA', 'PT', 'OT', 'RT', 'MD', 'Social Work'],
            required: true,
        },
        status: {
            type: String,
            enum: ['Active', 'Discontinued'],
            default: 'Active',
        },
    },
    { _id: false }
);

const carePlanDiagnosisSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        nandaCode: { type: String, required: true },
        nandaLabel: { type: String, required: true },
        relatedTo: { type: String, default: '' },
        evidencedBy: { type: String, default: '' },
        priority: {
            type: String,
            enum: ['High', 'Medium', 'Low'],
            required: true,
        },
        goals: { type: [carePlanGoalSchema], default: [] },
        interventions: { type: [carePlanInterventionSchema], default: [] },
        addedAt: { type: Date, required: true },
        addedBy: { type: String, required: true },
        status: {
            type: String,
            enum: ['Active', 'Resolved', 'Discontinued'],
            default: 'Active',
        },
    },
    { _id: false }
);

const carePlanSchema = new mongoose.Schema(
    {
        patientId: { type: String, required: true, index: true },
        encounterId: { type: String, required: true, unique: true, index: true },
        tenantId: { type: String, required: true, index: true },
        diagnoses: { type: [carePlanDiagnosisSchema], default: [] },
        interdisciplinaryNotes: { type: String, default: '' },
        lastReviewedBy: { type: String, default: '' },
        lastReviewedByName: { type: String, default: '' },
        lastReviewedAt: { type: Date, default: null },
        version: { type: Number, default: 1 },
    },
    { timestamps: true }
);

carePlanSchema.index({ tenantId: 1, encounterId: 1 });
const CarePlan = mongoose.models.CarePlan || mongoose.model('CarePlan', carePlanSchema);
module.exports = { CarePlan, carePlanSchema };
