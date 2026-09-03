import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const paymentAllocationSchema = new mongoose.Schema({
    documentType: {
        type: String, // invoice | bill | quotation | estimate | grn | transport_hire
        required: false,
    },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: false },
    documentNumber: String,
    amount: { type: Number, required: false, min: 0 },
}, { _id: true });

const paymentSchema = new mongoose.Schema({
    paymentNumber: { type: String, unique: true, trim: true, uppercase: true },

    direction: {
        type: String, // received (Cash IN) | paid (Cash OUT)
        required: false,
        default: 'received',
    },

    // Voucher details
    voucherType: {
        type: String,
        enum: ['customer_advance_refund', 'supplier_payment', 'transport_hire', 'operational_expense', 'labor_advance', 'salary_advance'],
        required: false,
    },
    voucherCategory: { type: String, trim: true },

    // Transport / Hire Expense attributes
    hireNoteNumber: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    transportDriver: { type: String, trim: true },

    // Customer (if received / advance refund) OR supplier (if paid) OR employee (if labor advance)
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    partyName: String,

    paymentDate: { type: Date, default: Date.now },

    currency: { type: String, default: 'LKR' },
    amount: { type: Number, required: false, min: 0.01 },

    method: {
        type: String,
        default: 'cash', // cash | cheque | bank_transfer | online
    },

    // Method-specific
    chequeNumber: String,
    chequeDate: Date,
    chequeStatus: { type: String },

    bankName: String,
    transactionReference: String,

    // What the payment/voucher is applied to
    allocations: [paymentAllocationSchema],
    unallocatedAmount: { type: Number, default: 0 }, // advance payment or unused voucher balance

    status: {
        type: String,
        default: 'confirmed',
    },

    notes: String,
    signatureNote: String,
    receiptImageUrl: String,

    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });

// indexes
paymentSchema.index({ customerId: 1, paymentDate: -1 });
paymentSchema.index({ supplierId: 1, paymentDate: -1 });
paymentSchema.index({ direction: 1, status: 1 });
paymentSchema.index({ voucherType: 1 });

paymentSchema.pre('save', async function () {
    if (this.isNew && !this.paymentNumber) {
        const isVoucher = this.direction === 'paid' || !!this.voucherType;
        const seqKey = isVoucher ? 'voucher' : 'payment_receipt';
        const seq = await getNextSequence(seqKey);
        const prefix = isVoucher ? 'VOU' : 'REC';
        this.paymentNumber = `${prefix}-${seq}`;
    }

    const totalAllocated = (this.allocations || []).reduce((s, a) => s + (a.amount || 0), 0);
    this.unallocatedAmount = +(this.amount - totalAllocated).toFixed(2);
});

paymentSchema.pre(/^find/, function (next) {
    if (!this.getOptions || !this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    if (typeof next === 'function') next();
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;