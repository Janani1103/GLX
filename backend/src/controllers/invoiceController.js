import { backupDocumentAsPdf } from '../services/smsService.js';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import SalesOrder from '../models/SalesOrder.js';
import Warehouse from '../models/Warehouse.js';
import { decreaseStock } from '../services/stockService.js';

const deductStockForInvoice = async (invoice, userId) => {
    if (invoice.invoiceType === 'proforma') return; // Proforma NEVER impacts stock
    if (invoice.stockDeducted) return;

    let whId = invoice.warehouseId;
    if (!whId) {
        const wh = await Warehouse.findOne({ deletedAt: null });
        whId = wh?._id;
    }
    if (!whId) return;

    for (const item of invoice.items) {
        if (!item.productId) continue;
        try {
            await decreaseStock({
                productId: item.productId,
                warehouseId: whId,
                quantity: item.quantity,
                movementType: 'sale_dispatch',
                sourceDocument: {
                    type: 'invoice',
                    id: invoice._id,
                    number: invoice.invoiceNumber
                },
                reason: `Inventory deduction for Commercial Invoice ${invoice.invoiceNumber}`,
                userId
            });
        } catch (err) {
            console.warn(`[Invoice Stock Deduction] Failed for ${item.productName}:`, err.message);
        }
    }

    invoice.stockDeducted = true;
    invoice.warehouseId = whId;
    await invoice.save();
};

/**
 * Helper: recalculate customer credit balance
 */
const updateCustomerBalance = async (customerId) => {
    const result = await Invoice.aggregate([
        {
            $match: {
                customerId: new mongoose.Types.ObjectId(customerId),
                paymentStatus: { $in: ['unpaid', 'partially_paid', 'overdue'] },
                deletedAt: null,
            },
        },
        {
            $group: {
                _id: null,
                totalBalance: { $sum: '$balanceDue' },
                overdueAmount: {
                    $sum: {
                        $cond: [{ $in: ['$paymentStatus', ['overdue']] }, '$balanceDue', 0],
                    },
                },
            },
        },
    ]);

    const summary = result[0] || { totalBalance: 0, overdueAmount: 0 };

    const customer = await Customer.findById(customerId);
    if (customer) {
        const currentBalance = +summary.totalBalance.toFixed(2);
        const overdueAmount = +summary.overdueAmount.toFixed(2);
        const isOverdue = overdueAmount > 0;
        const availableCredit = Math.max(
            0,
            (customer.paymentTerms?.creditLimit || 0) - currentBalance
        );

        await Customer.updateOne(
            { _id: customerId },
            {
                $set: {
                    'creditStatus.currentBalance': currentBalance,
                    'creditStatus.overdueAmount': overdueAmount,
                    'creditStatus.isOverdue': isOverdue,
                    'creditStatus.availableCredit': availableCredit,
                }
            }
        );
    }
};

/**
 * POST /api/invoices
 * Create manual invoice
 */
export const createInvoice = asyncHandler(async (req, res) => {
    const { customerId, items, dueDate, ...rest } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) { res.status(404); throw new Error('Customer not found'); }

    // Auto-calc due date if not provided
    let finalDueDate = dueDate;
    if (!finalDueDate && customer.paymentTerms?.type === 'credit') {
        const d = new Date(rest.invoiceDate || Date.now());
        d.setDate(d.getDate() + (customer.paymentTerms.creditDays || 0));
        finalDueDate = d;
    }

    if (rest.discountPercent !== undefined) {
        rest.discountPercent = Math.max(0, Math.min(100, Number(rest.discountPercent) || 0));
    }

    const invoice = new Invoice({
        customerId: customer._id,
        customerSnapshot: {
            name: customer.displayName,
            code: customer.customerCode,
            taxRegistrationNumber: customer.taxRegistrationNumber,
            contactName: customer.primaryContact?.name,
        },
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddresses?.find((a) => a.isDefault) || customer.billingAddress,
        salesRepId: customer.assignedSalesRep,
        introducer: rest.introducer || customer.introducer,
        introducerName: rest.introducerName || customer.introducerName || '',
        biller: rest.biller || req.user._id,
        billerName: rest.billerName || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim(),
        paymentTerms: {
            type: customer.paymentTerms?.type || 'cod',
            creditDays: customer.paymentTerms?.creditDays || 0,
        },
        dueDate: finalDueDate,
        items,
        ...rest,
        createdBy: req.user._id,
    });

    await invoice.save();
    await deductStockForInvoice(invoice, req.user._id);
    await updateCustomerBalance(customer._id);

    const populated = await Invoice.findById(invoice._id)
        .populate('customerId', 'displayName customerCode')
        .populate('salesOrderIds', 'orderNumber');

    res.status(201).json({ success: true, data: populated });
});

/**
 * POST /api/invoices/from-sales-order
 * Generate an invoice from one or more delivered sales orders
 */
export const createFromSalesOrder = asyncHandler(async (req, res) => {
    const { salesOrderIds, invoiceDate, invoiceType = 'standard', notes } = req.body;

    const orders = await SalesOrder.find({
        _id: { $in: salesOrderIds },
        status: { $in: ['delivered', 'completed'] },
    }).populate('customerId');

    if (orders.length === 0) {
        res.status(400);
        throw new Error('No delivered orders found for the given IDs');
    }

    // Check all orders have a valid customer and belong to the same customer
    const validOrders = orders.filter(o => o.customerId);
    if (validOrders.length !== orders.length) {
        res.status(400);
        throw new Error('Some selected sales orders have missing or invalid customer references');
    }

    const customerIds = [...new Set(validOrders.map((o) => o.customerId._id.toString()))];
    if (customerIds.length > 1) {
        res.status(400);
        throw new Error('All sales orders must belong to the same customer');
    }

    const customer = validOrders[0].customerId;

    // Merge line items from all orders
    const invoiceItems = [];
    validOrders.forEach((order) => {
        order.items.forEach((orderItem) => {
            const qty = orderItem.deliveredQuantity || orderItem.orderedQuantity;
            if (qty <= 0) return;
            invoiceItems.push({
                productId: orderItem.productId,
                productCode: orderItem.productCode,
                productName: orderItem.productName,
                description: orderItem.description,
                quantity: qty,
                unitOfMeasure: orderItem.unitOfMeasure,
                unitPrice: orderItem.unitPrice,
                discountPercent: orderItem.discountPercent,
                taxRate: orderItem.taxRate,
                taxable: orderItem.taxable,
                salesOrderLineId: orderItem._id,
            });
        });
    });

    // Due date from customer terms
    const d = new Date(invoiceDate || Date.now());
    if (customer.paymentTerms?.type === 'credit') {
        d.setDate(d.getDate() + (customer.paymentTerms.creditDays || 0));
    }

    const invoice = new Invoice({
        customerId: customer._id,
        customerSnapshot: {
            name: customer.displayName,
            code: customer.customerCode,
            taxRegistrationNumber: customer.taxRegistrationNumber,
            contactName: customer.primaryContact?.name,
        },
        billingAddress: customer.billingAddress,
        shippingAddress: orders[0].shippingAddress || customer.billingAddress,
        salesOrderIds: orders.map((o) => o._id),
        salesOrderNumbers: orders.map((o) => o.orderNumber),
        invoiceType,
        invoiceDate: invoiceDate || new Date(),
        dueDate: customer.paymentTerms?.type === 'credit' ? d : undefined,
        salesRepId: orders[0].salesRepId,
        paymentTerms: {
            type: customer.paymentTerms?.type || 'cod',
            creditDays: customer.paymentTerms?.creditDays || 0,
        },
        items: invoiceItems,
        notes,
        status: 'approved',
        createdBy: req.user._id,
    });

    await invoice.save();
    await deductStockForInvoice(invoice, req.user._id);

    // Update sales orders to "invoiced" or "completed"
    for (const order of orders) {
        if (order.status === 'delivered') {
            order.status = 'invoiced';
            await order.save();
        }
    }

    await updateCustomerBalance(customer._id);

    const populated = await Invoice.findById(invoice._id)
        .populate('customerId', 'displayName customerCode')
        .populate('salesOrderIds', 'orderNumber');

    res.status(201).json({ success: true, data: populated });
});

/**
 * GET /api/invoices
 */
export const getInvoices = asyncHandler(async (req, res) => {
    const {
        search, customerId, paymentStatus, status, agingBucket,
        startDate, endDate,
        page = 1, limit = 20,
        sortBy = 'invoiceDate', sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (search) {
        filter.$or = [
            { invoiceNumber: { $regex: search, $options: 'i' } },
            { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
            { 'customerSnapshot.code': { $regex: search, $options: 'i' } },
        ];
    }
    if (customerId) filter.customerId = customerId;
    if (paymentStatus) {
        // Support comma-separated values: "unpaid,partially_paid,overdue"
        const statuses = paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
        filter.paymentStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (status) filter.status = status;
    if (agingBucket) filter.agingBucket = agingBucket;
    if (startDate || endDate) {
        filter.invoiceDate = {};
        if (startDate) filter.invoiceDate.$gte = new Date(startDate);
        if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [invoices, total] = await Promise.all([
        Invoice.find(filter)
            .populate('customerId', 'displayName customerCode introducer introducerName')
            .populate('introducer', 'firstName lastName callingName employeeCode')
            .populate('biller', 'firstName lastName')
            .populate('salesOrderIds', 'orderNumber')
            .sort(sortObj).skip(skip).limit(Number(limit)),
        Invoice.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: invoices.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: invoices,
    });
});

/**
 * GET /api/invoices/:id
 */
export const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('customerId', 'displayName customerCode taxRegistrationNumber primaryContact paymentTerms creditStatus introducer introducerName')
        .populate('introducer', 'firstName lastName callingName employeeCode designation')
        .populate('biller', 'firstName lastName')
        .populate('salesOrderIds', 'orderNumber orderDate')
        .populate('salesRepId', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .populate('cancelledBy', 'firstName lastName');
    if (!invoice) { res.status(404); throw new Error('Invoice not found'); }
    res.json({ success: true, data: invoice });
});

/**
 * GET /api/invoices/aging/summary
 * Accounts receivable aging summary
 */
export const getAgingSummary = asyncHandler(async (req, res) => {
    const { customerId } = req.query;
    const match = {
        paymentStatus: { $in: ['unpaid', 'partially_paid', 'overdue', 'Unpaid', 'Partially Paid', 'Overdue', 'partially paid'] },
        deletedAt: null,
    };
    if (customerId) match.customerId = new mongoose.Types.ObjectId(customerId);

    const aggregation = await Invoice.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$agingBucket',
                count: { $sum: 1 },
                total: { $sum: '$balanceDue' },
            },
        },
    ]);

    const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '91_plus': 0 };
    const counts = { ...buckets };
    aggregation.forEach((row) => {
        if (row._id in buckets) {
            buckets[row._id] = row.total;
            counts[row._id] = row.count;
        }
    });

    const totalOutstanding = Object.values(buckets).reduce((s, v) => s + v, 0);

    res.json({
        success: true,
        data: { buckets, counts, totalOutstanding },
    });
});

/**
 * PATCH /api/invoices/:id/status
 */
export const changeInvoiceStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) { res.status(404); throw new Error('Invoice not found'); }

    const allowed = {
        draft: ['approved', 'cancelled'],
        approved: ['sent', 'cancelled'],
        sent: ['viewed', 'cancelled'],
        viewed: ['cancelled'],
        paid: ['void'],
    };

    if (!allowed[invoice.status]?.includes(status)) {
        res.status(400);
        throw new Error(`Cannot change status from '${invoice.status}' to '${status}'`);
    }

    invoice.status = status;
    invoice.updatedBy = req.user._id;

    if (['approved', 'sent', 'viewed', 'paid'].includes(status)) {
        await deductStockForInvoice(invoice, req.user._id);
    }

    if (status === 'sent') invoice.sentAt = new Date();
    if (status === 'cancelled') {
        invoice.cancelledBy = req.user._id;
        invoice.cancelledAt = new Date();
        invoice.cancellationReason = reason;
        invoice.paymentStatus = 'cancelled';
    }

    await invoice.save();
    await updateCustomerBalance(invoice.customerId);

    res.json({ success: true, data: invoice });
});

/**
 * DELETE /api/invoices/:id
 */
export const deleteInvoice = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) { res.status(404); throw new Error('Invoice not found'); }
    if (invoice.status !== 'draft') {
        res.status(400); throw new Error('Only draft invoices can be deleted');
    }
    invoice.deletedAt = new Date();
    await invoice.save();
    res.json({ success: true, message: 'Draft invoice deleted' });
});

// Exported for use by payments module
/**
 * POST /api/invoices/:id/convert-proforma
 * Convert a Proforma invoice into a Commercial invoice and deduct stock
 */
export const convertProformaToCommercial = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    if (invoice.invoiceType !== 'proforma') {
        res.status(400);
        throw new Error('Only Proforma Invoices can be converted to Commercial Invoices');
    }

    invoice.invoiceType = 'standard';
    await invoice.save();

    await deductStockForInvoice(invoice, req.user._id);

    res.json({
        success: true,
        data: invoice,
        message: 'Successfully converted Proforma Invoice to Commercial Invoice and deducted inventory.'
    });
});

/**
 * POST /api/invoices/:id/convert-to-proforma
 * Convert Commercial / Standard invoice into Proforma invoice
 */
export const convertInvoiceToProforma = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    invoice.invoiceType = 'proforma';
    await invoice.save();

    res.json({
        success: true,
        data: invoice,
        message: 'Successfully converted Invoice to Proforma Invoice.'
    });
});

/**
 * POST /api/invoices/:id/convert-to-project
 * Convert any Invoice (Commercial or Proforma) into a Project
 */
export const convertInvoiceToProject = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    if (invoice.convertedProjectId) {
        const Project = mongoose.model('Project');
        const existingProject = await Project.findById(invoice.convertedProjectId);
        if (existingProject) {
            return res.json({ success: true, message: 'Already converted', data: existingProject });
        }
    }

    const { yard, assignedEmployees, details } = req.body;
    const Project = mongoose.model('Project');

    const project = new Project({
        name: `${invoice.customerSnapshot?.name || invoice.vehicleOwner || 'Customer'} - ${invoice.vehicleNo || invoice.invoiceNumber}`,
        customer: invoice.customerId || undefined,
        invoiceId: invoice._id,
        yard: yard || '',
        details: details || invoice.jobCaption || '',
        assignedEmployees: assignedEmployees || [],
        quotedPrice: invoice.grandTotal || 0,
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

        const advanceInvoice = new Invoice({
            invoiceType: 'commercial',
            sourceDocumentType: 'direct',
            sourceDocumentId: project._id,
            sourceDocumentCode: project.projectNumber,
            vehicleOwner: invoice.vehicleOwner || '',
            vehicleNo: invoice.vehicleNo || '',
            customerId: project.customer,
            customerSnapshot: invoice.customerSnapshot || { name: 'Customer' },
            invoiceDate: new Date(),
            items: [{
                lineNumber: 1,
                productName: `Advance Payment - ${project.projectNumber}`,
                description: `Advance payment for project ${project.projectNumber}`,
                quantity: 1,
                unitPrice: advanceAmount,
                lineSubtotal: advanceAmount,
                lineTotal: advanceAmount
            }],
            subtotal: advanceAmount,
            grandTotal: advanceAmount,
            amountPaid: advanceAmount,
            balanceDue: 0,
            status: 'approved',
            paymentStatus: 'paid',
            notes: `Advance payment for project ${project.projectNumber}`,
            createdBy: req.user._id
        });
        await advanceInvoice.save();

        if (req.body.bankAccountId && req.body.paymentMethod !== 'cash') {
            const BankAccount = mongoose.model('BankAccount');
            const bankAccount = await BankAccount.findById(req.body.bankAccountId);
            if (bankAccount) {
                bankAccount.balance = +(bankAccount.balance + advanceAmount).toFixed(2);
                await bankAccount.save();
            }
        }
    }

    await Invoice.updateOne(
        { _id: invoice._id },
        { $set: { convertedProjectId: project._id } }
    );

    res.status(201).json({ success: true, message: 'Converted Invoice to Project successfully', data: project });
});

/**
 * POST /api/invoices/:id/revert-conversion
 * Revert an invoice back to Quotation/Draft format requiring Admin Password
 */
export const revertInvoiceConversion = asyncHandler(async (req, res) => {
    const { adminPassword } = req.body;
    if (!adminPassword) {
        res.status(400);
        throw new Error('Admin password is required to revert conversion');
    }

    const { default: User } = await import('../models/User.js');
    let authorized = false;

    if (req.user) {
        const currentUser = await User.findById(req.user._id).select('+password');
        if (currentUser && currentUser.password) {
            const isMatch = await currentUser.matchPassword(adminPassword);
            if (isMatch && ['admin', 'superadmin', 'manager'].includes(currentUser.role)) {
                authorized = true;
            }
        }
    }

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

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    const { default: Quotation } = await import('../models/Quotation.js');

    let quotation = null;

    if (invoice.sourceDocumentId && invoice.sourceDocumentType === 'quotation') {
        quotation = await Quotation.findById(invoice.sourceDocumentId);
        if (quotation) {
            quotation.status = 'draft';
            quotation.convertedInvoiceId = undefined;
            await quotation.save();
        }
    }

    if (!quotation) {
        quotation = new Quotation({
            quoteNumber: `QUT-REV-${Date.now().toString().slice(-6)}`,
            documentType: 'quotation',
            status: 'draft',
            customerName: invoice.customerSnapshot?.name || invoice.vehicleOwner || 'Customer',
            customerPhone: invoice.customerSnapshot?.contactName || '',
            customerEmail: invoice.customerSnapshot?.code || '',
            vehicleNo: invoice.vehicleNo || '',
            vehicleModel: invoice.vehicleModel || '',
            insuranceCompany: invoice.insuranceCompany || '',
            jobCaption: invoice.jobCaption || '',
            items: (invoice.items || []).map(i => ({
                productName: i.productName,
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                subtotal: i.lineTotal
            })),
            totalAmount: invoice.subtotal || invoice.grandTotal,
            grandTotal: invoice.grandTotal,
            notes: invoice.notes,
            createdBy: req.user._id
        });
        await quotation.save();
    }

    invoice.deletedAt = new Date();
    invoice.status = 'cancelled';
    invoice.cancellationReason = `Reverted to Quotation Draft by Admin (${req.user?.firstName || 'Admin'})`;
    await invoice.save();

    res.json({
        success: true,
        message: 'Successfully reverted Invoice back to Quotation Draft format!',
        data: quotation
    });
});

export { updateCustomerBalance };