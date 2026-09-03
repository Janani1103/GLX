import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const dailyWagePaymentSchema = new mongoose.Schema({
    voucherNumber: { type: String, unique: true, uppercase: true, trim: true },
    date: { type: Date, required: true },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeCode: { type: String, required: true },
    employeeName: { type: String, required: true },

    payType: { type: String, enum: ['daily', 'hourly'], default: 'daily' },
    rate: { type: Number, default: 0 },
    units: { type: Number, default: 0 }, // days present or worked hours

    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },

    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },

    netPaid: { type: Number, required: true, default: 0 },

    paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque'], default: 'cash' },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Optional: Assign labor cost to a project

    status: { type: String, enum: ['paid', 'cancelled'], default: 'paid' },
    notes: String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

dailyWagePaymentSchema.index({ date: -1, employeeId: 1 });
dailyWagePaymentSchema.index({ projectId: 1 });

dailyWagePaymentSchema.pre('save', async function () {
    if (this.isNew && !this.voucherNumber) {
        const seq = await getNextSequence('daily_wage_payment');
        const dateStr = new Date(this.date).toISOString().split('T')[0].replace(/-/g, '');
        this.voucherNumber = `DWP-${dateStr}-${seq}`;
    }
});

const DailyWagePayment = mongoose.model('DailyWagePayment', dailyWagePaymentSchema);
export default DailyWagePayment;
