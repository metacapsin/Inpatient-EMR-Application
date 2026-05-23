const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema(
    {
        appealLevel: {
            type: String,
            enum: ['First Level', 'Second Level', 'External Review', 'Peer-to-Peer'],
            default: 'First Level',
        },
        appealType: {
            type: String,
            enum: ['Written', 'Verbal', 'Expedited'],
            default: 'Written',
        },
        supportingClinicalDocuments: { type: [String], default: [] },
        appealLetter: { type: String, default: '' },
        letterS3Upload: { type: String, default: '' },
        submittedDate: { type: String, default: '' },
        submittedBy: { type: String, default: '' },
        payerReferenceNumber: { type: String, default: '' },
        expectedResponseDate: { type: String, default: '' },
        outcome: {
            type: String,
            enum: ['Approved', 'Partially Approved', 'Denied', 'Pending'],
            default: 'Pending',
        },
        outcomeDate: { type: String, default: '' },
        approvedAmount: { type: Number, default: 0 },
        writeOffAmount: { type: Number, default: 0 },
        writeOffApprovedBy: { type: String, default: '' },
    },
    { _id: false }
);

const claimDenialSchema = new mongoose.Schema(
    {
        tenantId: { type: String, required: true, index: true },
        claimNumber: { type: String, required: true },
        patientId: { type: String, default: '' },
        patientName: { type: String, required: true },
        dateOfService: { type: String, required: true },
        payer: { type: String, required: true },
        billedAmount: { type: Number, required: true },
        deniedAmount: { type: Number, required: true },
        denialCode: { type: String, required: true },
        denialReason: { type: String, required: true },
        category: {
            type: String,
            enum: ['Authorization', 'Coding', 'Clinical', 'Timely Filing', 'Duplicate', 'Eligibility'],
            required: true,
        },
        appealDeadline: { type: String, required: true },
        status: {
            type: String,
            enum: ['New', 'Working', 'Appealed', 'Resolved', 'Written Off'],
            default: 'New',
        },
        appeal: { type: appealSchema, default: () => ({}) },
    },
    { timestamps: true }
);

module.exports = mongoose.models.ClaimDenial || mongoose.model('ClaimDenial', claimDenialSchema);
