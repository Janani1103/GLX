import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const projectSchema = new mongoose.Schema({
    projectNumber: { type: String, unique: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    yard: { type: String, trim: true },
    details: { type: String, trim: true },
    assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    
    // Financials
    quotedPrice: { type: Number, default: 0 },   // Total price offered to customer
    materialCost: { type: Number, default: 0 },  // Sum of buyingPrice of materials issued
    laborCost: { type: Number, default: 0 },     // Dynamic cost from attendance rates
    otherExpenses: { type: Number, default: 0 }, // Directly logged expenses
    netProfit: { type: Number, default: 0 },     // quotedPrice - materialCost - laborCost - otherExpenses
    
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
        type: String,
        enum: ['active', 'delivered', 'cancelled'],
        default: 'active',
    },
    deliveryDate: Date,
    
    materialsIssued: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productCode: { type: String },
        productName: { type: String },
        qty: { type: Number, required: true, default: 1 },
        buyingPrice: { type: Number, required: true, default: 0 },
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        issuedDate: { type: Date, default: Date.now }
    }],
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });

projectSchema.pre('save', async function () {
    if (this.isNew && !this.projectNumber) {
        const seq = await getNextSequence('project');
        this.projectNumber = `PRJ-${seq}`;
    }
    
    // Recompute profit
    this.netProfit = +(this.quotedPrice - (this.materialCost || 0) - (this.laborCost || 0) - (this.otherExpenses || 0)).toFixed(2);
});

projectSchema.pre(/^find/, function (next) {
    if (!this.getOptions || !this.getOptions().includeDeleted) this.where({ deletedAt: null });
    if (typeof next === 'function') next();
});

const Project = mongoose.model('Project', projectSchema);
export default Project;
