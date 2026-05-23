const mongoose = require('mongoose');

const cdiQueryOptionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
    },
    { _id: false }
);

const cdiQuerySchema = new mongoose.Schema(
    {
        tenantId: { type: String, required: true, index: true },
        encounterId: { type: String, required: true, index: true },
        patientId: { type: String, required: true, index: true },
        patientName: { type: String, required: true },
        attendingPhysician: { type: String, required: true },
        attendingPhysicianId: { type: String, default: '' },
        los: { type: Number, required: true },
        currentDrg: { type: String, required: true },
        currentDrgWeight: { type: Number, required: true },
        potentialDrg: { type: String, default: '' },
        revenueOpportunity: { type: Number, default: 0 },
        queriesSent: { type: Number, default: 0 },
        queryStatus: {
            type: String,
            enum: ['Open', 'Answered', 'Closed'],
            default: 'Open',
        },
        assignCdiSpecialist: { type: String, default: '' },
        queryType: {
            type: String,
            enum: [
                'Unclear Documentation',
                'CC/MCC Capture',
                'Principal Diagnosis Clarification',
                'Procedure Clarification',
                'POA (Present on Admission) Status',
                'Other',
            ],
            default: 'Unclear Documentation',
        },
        clinicalScenario: { type: String, default: '' },
        questionToPhysician: { type: String, default: '' },
        optionsProvided: { type: [cdiQueryOptionSchema], default: [] },
        sentTo: { type: String, default: '' },
        sentToPhysicianId: { type: String, default: '' },
        dueDate: { type: String, default: '' },
        sentBy: { type: String, default: '' },
        sentAt: { type: String, default: '' },
        physicianResponse: { type: String, default: '' },
        selectedOptionId: { type: String, default: '' },
        responseLocked: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.models.CDIQuery || mongoose.model('CDIQuery', cdiQuerySchema);
