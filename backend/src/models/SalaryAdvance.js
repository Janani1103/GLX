import mongoose from 'mongoose';

const salaryAdvanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true, default: Date.now },
    advanceType: { type: String, enum: ['amount', 'percentage'], default: 'amount' },
    requestedPercentage: { type: Number, default: 0, min: 0, max: 100 },
    calculatedAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvalNotes: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectedReason: String,
    isDeducted: { type: Boolean, default: false },
    deductedPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const SalaryAdvance = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
export default SalaryAdvance;
