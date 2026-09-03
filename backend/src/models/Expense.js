import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const expenseSchema = new mongoose.Schema({
  expenseNumber: { type: String, unique: true },
  title: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Raw Materials',
      'Transport & Freight',
      'Salaries & Wages',
      'Utilities & Electricity',
      'Fuel & Vehicles',
      'Rent & Rates',
      'Maintenance & Repairs',
      'Stationery & Office',
      'Welfare & Food',
      'Marketing & Sales',
      'Tax & Legal',
      'Miscellaneous'
    ],
    default: 'Miscellaneous',
  },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Petty Cash'],
    default: 'Cash',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Cancelled'],
    default: 'Paid',
  },
  chequeNumber: { type: String, trim: true },
  chequeDate: { type: Date },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  payeeName: { type: String, trim: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  date: { type: Date, default: Date.now },
  referenceNo: { type: String, trim: true },
  notes: { type: String },
  attachmentUrl: { type: String },
  isStockConsumption: { type: Boolean, default: false },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productCode: { type: String },
    productName: { type: String },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    quantity: { type: Number, required: true },
    costPerUnit: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  }],
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

expenseSchema.pre('save', async function() {
  if (this.isNew && !this.expenseNumber) {
    const seq = await getNextSequence('expense');
    this.expenseNumber = `EXP-${String(seq).padStart(5, '0')}`;
  }
});

expenseSchema.pre(/^find/, function(next) {
  if (!this.getOptions || !this.getOptions().includeDeleted) {
    this.where({ deletedAt: null });
  }
  if (typeof next === 'function') next();
});

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paymentMethod: 1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
