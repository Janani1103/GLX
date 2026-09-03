import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: false,
        default: 'GLX Industries'
    },
    companyAddress: String,
    companyPhone: String,
    companyEmail: String,
    companyLogo: String,
    taxId: String,
    currency: {
        type: String,
        default: 'LKR'
    },
    currencySymbol: {
        type: String,
        default: 'Rs.'
    },
    managerSmsPhone: {
        type: String,
        default: '+94716666888'
    },
    bossSignature: {
        type: String,
        default: ''
    },
    bossTitle: {
        type: String,
        default: 'Authorized Signature / Managing Director'
    },
    defaultTaxRate: {
        type: Number,
        default: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 10
    },
    // Custom Print Templates
    invoiceCustomTemplateUrl: String,
    quotationCustomTemplateUrl: String,
    activeInvoiceTemplate: {
        type: String,
        enum: ['default', 'custom'],
        default: 'default'
    },
    activeQuotationTemplate: {
        type: String,
        enum: ['default', 'custom'],
        default: 'default'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
