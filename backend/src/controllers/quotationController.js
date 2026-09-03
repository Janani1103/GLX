import mongoose from 'mongoose';
import { backupDocumentAsPdf } from '../services/smsService.js';
import asyncHandler from 'express-async-handler';
import Quotation from '../models/Quotation.js';
import { createAuditLog } from '../utils/auditLogger.js';

/**
 * @desc    Create a quotation from an inquiry
 * @route   POST /api/quotations
 * @access  Private
 */
export const createQuotation = asyncHandler(async (req, res) => {
    if (req.body.customerId === '') delete req.body.customerId;

    if (Array.isArray(req.body.items)) {
        req.body.items = req.body.items.map(item => {
            if (!item.product || item.product === '') {
                delete item.product;
            }
            return item;
        });
    }

    // Auto-register unregistered customer if customerName is provided but customerId is not
    if (!req.body.customerId && req.body.customerName) {
        const { default: Customer } = await import('../models/Customer.js');
        let customer = await Customer.findOne({
            displayName: { $regex: new RegExp('^' + req.body.customerName.trim() + '$', 'i') }
        });
        if (!customer) {
            customer = new Customer({
                displayName: req.body.customerName.trim(),
                companyName: req.body.customerName.trim(),
                primaryContact: {
                    email: req.body.customerEmail || undefined,
                    phone: req.body.customerPhone || undefined
                },
                billingAddress: req.body.customerAddress ? {
                    line1: req.body.customerAddress,
                    city: '',
                    country: 'Sri Lanka'
                } : undefined,
                status: 'active',
                createdBy: req.user._id
            });
            await customer.save();
        }
        req.body.customerId = customer._id;
    }

    if (!req.body.biller) req.body.biller = req.user._id;
    if (!req.body.billerName && req.user) {
        req.body.billerName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    }

    const quotation = await Quotation.create({
        ...req.body,
        createdBy: req.user._id,
        version: 1
    });

    createAuditLog({
        action: 'create',
        module: 'crm',
        documentId: quotation._id,
        documentCode: quotation.quoteNumber,
        description: `Generated quotation ${quotation.quoteNumber}`,
        req
    });

    res.status(201).json({ success: true, data: quotation });
});

/**
 * @desc    Get quotations
 * @route   GET /api/quotations
 * @access  Private
 */
export const getQuotations = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { deletedAt: null };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [quotations, total] = await Promise.all([
        Quotation.find(filter)
            .populate('customerId', 'displayName companyName introducer introducerName')
            .populate('introducer', 'firstName lastName callingName employeeCode')
            .populate('biller', 'firstName lastName')
            .populate('items.product', 'name productCode')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Quotation.countDocuments(filter)
    ]);

    res.json({
        success: true,
        data: quotations,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
    });
});

/**
 * @desc    Get quotation by ID
 * @route   GET /api/quotations/:id
 * @access  Private
 */
export const getQuotationById = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id)
        .populate('customerId', 'displayName companyName primaryContact billingAddress introducer introducerName')
        .populate('introducer', 'firstName lastName callingName employeeCode designation')
        .populate('biller', 'firstName lastName')
        .populate('items.product', 'name productCode uom basePrice sku')
        .populate('createdBy', 'firstName lastName');

    if (!quotation) {
        res.status(404);
        throw new Error('Quotation not found');
    }

    res.json({ success: true, data: quotation });
});

/**
 * @desc    Update a quotation
 * @route   PUT /api/crm/quotations/:id
 * @access  Private
 */
export const updateQuotation = asyncHandler(async (req, res) => {
    if (req.body.customerId === '') delete req.body.customerId;

    if (Array.isArray(req.body.items)) {
        req.body.items = req.body.items.map(item => {
            if (!item.product || item.product === '') {
                delete item.product;
            }
            return item;
        });
    }

    // Auto-register unregistered customer if customerName is provided but customerId is not
    if (!req.body.customerId && req.body.customerName) {
        const { default: Customer } = await import('../models/Customer.js');
        let customer = await Customer.findOne({
            displayName: { $regex: new RegExp('^' + req.body.customerName.trim() + '$', 'i') }
        });
        if (!customer) {
            customer = new Customer({
                displayName: req.body.customerName.trim(),
                companyName: req.body.customerName.trim(),
                primaryContact: {
                    email: req.body.customerEmail || undefined,
                    phone: req.body.customerPhone || undefined
                },
                billingAddress: req.body.customerAddress ? {
                    line1: req.body.customerAddress,
                    city: '',
                    country: 'Sri Lanka'
                } : undefined,
                status: 'active',
                createdBy: req.user._id
            });
            await customer.save();
        }
        req.body.customerId = customer._id;
    }

    const quotation = await Quotation.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );

    if (!quotation) {
        res.status(404);
        throw new Error('Quotation not found');
    }

    createAuditLog({
        action: 'update',
        module: 'crm',
        documentId: quotation._id,
        description: `Updated quotation ${quotation.quoteNumber}`,
        req
    });

    res.json({ success: true, data: quotation });
});

/**
 * @desc    Delete a quotation (soft)
 * @route   DELETE /api/crm/quotations/:id
 * @access  Private
 */
export const deleteQuotation = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
        res.status(404);
        throw new Error('Quotation not found');
    }
    quotation.deletedAt = new Date();
    await quotation.save();

    createAuditLog({
        action: 'delete',
        module: 'crm',
        documentId: quotation._id,
        description: `Deleted quotation ${quotation.quoteNumber}`,
        req
    });

    res.json({ success: true, message: 'Quotation deleted' });
});

/**
 * @desc    Convert quotation or estimate to invoice
 * @route   POST /api/crm/quotations/:id/convert-to-invoice
 * @access  Private
 */
export const convertQuotationToInvoice = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
        res.status(404);
        throw new Error('Document not found');
    }

    if (quotation.status === 'converted' && quotation.convertedInvoiceId) {
        // Return existing invoice
        const { default: Invoice } = await import('../models/Invoice.js');
        const existingInvoice = await Invoice.findById(quotation.convertedInvoiceId);
        if (existingInvoice) {
            return res.json({ success: true, message: 'Already converted', data: existingInvoice });
        }
    }

    const { default: Invoice } = await import('../models/Invoice.js');

    const invoiceItems = (quotation.items || []).map((item, index) => ({
        lineNumber: index + 1,
        productId: item.product || undefined,
        productName: item.productName || 'Custom Line Item',
        description: item.description || '',
        quantity: item.quantity || 1,
        unitOfMeasure: 'pcs',
        unitPrice: item.unitPrice || 0,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        taxable: false,
        lineSubtotal: (item.quantity || 1) * (item.unitPrice || 0),
        lineTotal: item.subtotal || ((item.quantity || 1) * (item.unitPrice || 0))
    }));

    if (quotation.laborCost && Number(quotation.laborCost) > 0) {
        invoiceItems.push({
            lineNumber: invoiceItems.length + 1,
            productName: 'Labor Charge / Workmanship',
            description: 'Engineering Labor Cost',
            quantity: 1,
            unitOfMeasure: 'job',
            unitPrice: Number(quotation.laborCost),
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 0,
            taxAmount: 0,
            taxable: false,
            lineSubtotal: Number(quotation.laborCost),
            lineTotal: Number(quotation.laborCost)
        });
    }

    const advancePaid = req.body.advanceAmount !== undefined 
        ? Number(req.body.advanceAmount || 0) 
        : Number(quotation.advanceAmount || 0);
    const grandTotal = Number(quotation.grandTotal || 0);
    let initialPaymentStatus = 'unpaid';
    if (advancePaid > 0) {
        initialPaymentStatus = advancePaid >= grandTotal ? 'paid' : 'partially_paid';
    }

    const invoice = new Invoice({
        invoiceType: req.body.invoiceType || 'commercial',
        sourceDocumentType: quotation.documentType || 'quotation',
        sourceDocumentId: quotation._id,
        sourceDocumentCode: quotation.quoteNumber || quotation.quotationCode,

        insuranceCompany: quotation.insuranceCompany || '',
        vehicleOwner: quotation.vehicleOwner || quotation.customerName || '',
        vehicleNo: quotation.vehicleNo || '',
        vehicleModel: quotation.vehicleModel || '',
        jobCaption: quotation.jobCaption || '',
        salesRep: quotation.salesRep || '',
        introducer: quotation.introducer || undefined,
        introducerName: quotation.introducerName || '',
        biller: quotation.biller || undefined,
        billerName: quotation.billerName || '',
        branch: quotation.branch || 'JA-ELA',

        numberPlateImage: quotation.numberPlateImage || '',
        lorryBodyImage: quotation.lorryBodyImage || '',

        bodyDimensions: quotation.bodyDimensions || { length: '', width: '', height: '' },
        specifications: quotation.specifications || [],
        warrantyInfo: quotation.warrantyInfo || '',
        paymentConditions: quotation.paymentConditions || [],

        customerId: quotation.customerId || undefined,
        customerSnapshot: {
            name: quotation.customerName || 'Walk-in Customer',
            code: quotation.customerEmail || '',
            contactName: quotation.customerPhone || ''
        },
        billingAddress: {
            line1: quotation.customerAddress || ''
        },

        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default
        items: invoiceItems,
        subtotal: quotation.totalAmount || quotation.grandTotal || 0,
        otherCharges: 0, // Labor cost is already included in invoiceItems
        totalDiscount: quotation.discount || 0,
        totalTax: quotation.tax || 0,
        grandTotal: grandTotal,
        amountPaid: advancePaid,
        balanceDue: Math.max(0, grandTotal - advancePaid),
        paymentStatus: initialPaymentStatus,
        notes: quotation.notes || `Converted from ${quotation.documentType || 'quotation'} ${quotation.quoteNumber}`,

        status: 'approved',
        createdBy: req.user._id
    });

    await invoice.save();

    if (advancePaid > 0) {
        const { default: Payment } = await import('../models/Payment.js');
        const { default: BankAccount } = await import('../models/BankAccount.js');
        const payment = new Payment({
            direction: 'received',
            customerId: quotation.customerId || undefined,
            bankAccountId: req.body.bankAccountId || undefined,
            amount: advancePaid,
            method: req.body.paymentMethod || 'cash',
            paymentDate: new Date(),
            partyName: quotation.customerName || 'Walk-in Customer',
            allocations: [{
                documentType: 'invoice',
                documentId: invoice._id,
                documentNumber: invoice.invoiceNumber,
                amount: advancePaid
            }],
            transactionReference: req.body.paymentReference || undefined,
            receivedBy: req.user._id,
            createdBy: req.user._id,
            notes: `Advance payment for Invoice ${invoice.invoiceNumber}`
        });
        await payment.save();

        if (req.body.bankAccountId) {
            const bankAccount = await BankAccount.findById(req.body.bankAccountId);
            if (bankAccount) {
                bankAccount.balance = +(bankAccount.balance + advancePaid).toFixed(2);
                await bankAccount.save();
            }
        }
    }

    await Quotation.updateOne(
        { _id: quotation._id },
        { $set: { status: 'converted', convertedInvoiceId: invoice._id, advanceAmount: advancePaid } }
    );

    createAuditLog({
        action: 'create',
        module: 'invoices',
        documentId: invoice._id,
        documentCode: invoice.invoiceNumber,
        description: `Converted ${quotation.documentType || 'quotation'} ${quotation.quoteNumber} to Invoice ${invoice.invoiceNumber}`,
        req
    });

    res.status(201).json({ success: true, message: 'Converted to Invoice successfully', data: invoice });
});

/**
 * @desc    Convert quotation or estimate to project
 * @route   POST /api/crm/quotations/:id/convert-to-project
 * @access  Private
 */
export const convertQuotationToProject = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
        res.status(404);
        throw new Error('Document not found');
    }

    if (quotation.status === 'converted' && quotation.convertedProjectId) {
        const Project = mongoose.model('Project');
        const existingProject = await Project.findById(quotation.convertedProjectId);
        if (existingProject) {
            return res.json({ success: true, message: 'Already converted', data: existingProject });
        }
    }

    const { yard, assignedEmployees, details } = req.body;
    const Project = mongoose.model('Project');

    const project = new Project({
        name: `${quotation.customerName || 'Walk-in Customer'} - ${quotation.vehicleNo || quotation.quoteNumber || 'Project'}`,
        customer: quotation.customerId || undefined,
        quotation: quotation._id,
        yard: yard || '',
        details: details || quotation.jobCaption || '',
        assignedEmployees: assignedEmployees || [],
        quotedPrice: quotation.grandTotal || 0,
        createdBy: req.user._id
    });

    // Handle walk-in if no customer
    if (!project.customer) {
        const Customer = mongoose.model('Customer');
        let walkInCustomer = await Customer.findOne({ displayName: 'Walk-in Customer' });
        if (!walkInCustomer) {
            walkInCustomer = new Customer({
                displayName: 'Walk-in Customer',
                legalName: 'Walk-in Customer',
                status: 'active',
                paymentTerms: { type: 'cod', creditDays: 0, creditLimit: 0 }
            });
            await walkInCustomer.save();
        }
        project.customer = walkInCustomer._id;
    }

    await project.save();

    // Handle advance payment if provided
    if (req.body.advancePaymentAmount && Number(req.body.advancePaymentAmount) > 0) {
        const advanceAmount = Number(req.body.advancePaymentAmount);
        const Invoice = mongoose.model('Invoice');
        const Payment = mongoose.model('Payment');
        const BankAccount = mongoose.model('BankAccount');

        // 1. Create a Commercial Invoice for the advance payment
        const invoice = new Invoice({
            invoiceType: 'commercial',
            sourceDocumentType: 'quotation',
            sourceDocumentId: quotation._id,
            sourceDocumentCode: quotation.quoteNumber,
            projectId: project._id,
            customerId: project.customer,
            invoiceDate: new Date(),
            dueDate: new Date(),
            items: [{
                productName: `Advance Payment for Project ${project.projectNumber}`,
                quantity: 1,
                unitPrice: advanceAmount,
                lineSubtotal: advanceAmount,
                lineTotal: advanceAmount,
                taxable: false,
                taxRate: 0,
                taxAmount: 0
            }],
            subtotal: advanceAmount,
            grandTotal: advanceAmount,
            amountPaid: advanceAmount,
            balanceDue: 0,
            paymentStatus: 'paid',
            status: 'approved',
            createdBy: req.user._id
        });
        await invoice.save();

        // 2. Register a Payment entry
        const payment = new Payment({
            direction: 'received',
            customerId: project.customer,
            bankAccountId: req.body.bankAccountId || undefined,
            amount: advanceAmount,
            method: req.body.paymentMethod || 'cash',
            paymentDate: new Date(),
            partyName: quotation.customerName || 'Walk-in Customer',
            allocations: [{
                documentType: 'invoice',
                documentId: invoice._id,
                documentNumber: invoice.invoiceNumber,
                amount: advanceAmount
            }],
            receivedBy: req.user._id,
            createdBy: req.user._id,
            notes: `Advance payment for Project ${project.projectNumber}`
        });
        await payment.save();

        // 3. Update Bank/Cash Account balance if provided
        if (req.body.bankAccountId) {
            const bankAccount = await BankAccount.findById(req.body.bankAccountId);
            if (bankAccount) {
                bankAccount.balance = +(bankAccount.balance + advanceAmount).toFixed(2);
                await bankAccount.save();
            }
        }
    }

    await Quotation.updateOne(
        { _id: quotation._id },
        { $set: { status: 'converted', convertedProjectId: project._id } }
    );

    createAuditLog({
        action: 'create',
        module: 'projects',
        documentId: project._id,
        documentCode: project.projectNumber,
        description: `Converted ${quotation.documentType || 'quotation'} ${quotation.quoteNumber} to Project ${project.projectNumber}`,
        req
    });

    res.status(201).json({ success: true, message: 'Converted to Project successfully', data: project });
});

/**
 * @desc    Revert converted quotation/estimate back to draft status with Admin password
 * @route   POST /api/crm/quotations/:id/revert-conversion
 * @access  Private (Requires Admin Password)
 */
export const revertQuotationConversion = asyncHandler(async (req, res) => {
    const { adminPassword } = req.body;
    if (!adminPassword) {
        res.status(400);
        throw new Error('Admin password is required to revert conversion');
    }

    const { default: User } = await import('../models/User.js');
    let authorized = false;

    // First check if current user is admin and password matches
    if (req.user) {
        const currentUser = await User.findById(req.user._id).select('+password');
        if (currentUser && currentUser.password) {
            const isMatch = await currentUser.matchPassword(adminPassword);
            if (isMatch && ['admin', 'superadmin', 'manager'].includes(currentUser.role)) {
                authorized = true;
            }
        }
    }

    // If current user is not admin or password didn't match, check if password matches ANY active admin user
    if (!authorized) {
        const adminUsers = await User.find({ role: { $in: ['admin', 'superadmin'] }, isActive: true }).select('+password');
        for (const admin of adminUsers) {
            if (admin.password && (await admin.matchPassword(adminPassword))) {
                authorized = true;
                break;
            }
        }
    }

    if (!authorized) {
        res.status(401);
        throw new Error('Invalid Admin Password. Action unauthorized.');
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
        res.status(404);
        throw new Error('Quotation not found');
    }

    if (quotation.status !== 'converted') {
        res.status(400);
        throw new Error('Document is not in converted status');
    }

    // Soft delete or cancel converted invoice if exists
    if (quotation.convertedInvoiceId) {
        const { default: Invoice } = await import('../models/Invoice.js');
        const invoice = await Invoice.findById(quotation.convertedInvoiceId);
        if (invoice) {
            invoice.deletedAt = new Date();
            invoice.status = 'cancelled';
            invoice.cancellationReason = `Reverted conversion by Admin (${req.user?.firstName || 'Admin'})`;
            await invoice.save();
        }
    }

    // Soft delete or cancel converted project if exists
    if (quotation.convertedProjectId) {
        const Project = mongoose.model('Project');
        const project = await Project.findById(quotation.convertedProjectId);
        if (project) {
            project.deletedAt = new Date();
            project.status = 'cancelled';
            await project.save();
        }
    }

    quotation.status = 'draft';
    quotation.convertedInvoiceId = undefined;
    quotation.convertedProjectId = undefined;
    await quotation.save();

    createAuditLog({
        action: 'update',
        module: 'crm',
        documentId: quotation._id,
        documentCode: quotation.quoteNumber,
        description: `Reverted conversion of quotation ${quotation.quoteNumber} back to draft with Admin Password`,
        req
    });

    res.json({ success: true, message: 'Quotation conversion reverted back to Draft successfully', data: quotation });
});
