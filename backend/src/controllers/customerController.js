import asyncHandler from 'express-async-handler';
import Customer from '../models/Customer.js';
import backupEmitter, { BACKUP_EVENTS } from '../utils/backupEventEmitter.js';
import { createAuditLog } from '../utils/auditLogger.js';

export const createCustomer = asyncHandler(async (req, res) => {
    // Clean up empty string ID fields
    const payload = { ...req.body, createdBy: req.user._id };
    if (!payload.assignedSalesRep) delete payload.assignedSalesRep;
    if (!payload.introducer) delete payload.introducer;

    // Check if customer with exact same name already exists to prevent duplicates
    const searchName = (payload.displayName || payload.companyName || '').trim();
    if (searchName) {
        const existing = await Customer.findOne({
            $or: [
                { displayName: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                { companyName: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            ],
            deletedAt: null,
        })
        .populate('assignedSalesRep', 'firstName lastName')
        .populate('introducer', 'firstName lastName callingName employeeCode designation');

        if (existing) {
            return res.status(200).json({ success: true, data: existing, message: 'Existing customer resolved' });
        }
    }

    const customer = await Customer.create(payload);
    const populated = await Customer.findById(customer._id)
        .populate('assignedSalesRep', 'firstName lastName')
        .populate('introducer', 'firstName lastName callingName employeeCode designation');
    res.status(201).json({ success: true, data: populated });

    createAuditLog({
        action: 'create',
        module: 'customers',
        documentId: customer._id,
        documentCode: customer.customerCode,
        description: `Created new customer: ${customer.displayName}`,
        req
    });

    backupEmitter.emit(BACKUP_EVENTS.CUSTOMER_CHANGED);
});

export const getCustomers = asyncHandler(async (req, res) => {
    const {
        search, status, assignedSalesRep,
        onCreditHold, isOverdue,
        page = 1, limit = 20,
        sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
        filter.$or = [
            { displayName: { $regex: search, $options: 'i' } },
            { companyName: { $regex: search, $options: 'i' } },
            { customerCode: { $regex: search, $options: 'i' } },
            { 'primaryContact.phone': { $regex: search, $options: 'i' } },
        ];
    }
    if (status) filter.status = status;
    if (assignedSalesRep) filter.assignedSalesRep = assignedSalesRep;
    if (onCreditHold !== undefined) filter['creditStatus.onCreditHold'] = onCreditHold === 'true';
    if (isOverdue !== undefined) filter['creditStatus.isOverdue'] = isOverdue === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [customers, total] = await Promise.all([
        Customer.find(filter)
            .populate('assignedSalesRep', 'firstName lastName')
            .populate('introducer', 'firstName lastName callingName employeeCode designation')
            .sort(sortObj)
            .skip(skip)
            .limit(Number(limit)),
        Customer.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: customers.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        data: customers,
    });
});

export const getCustomerById = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id)
        .populate('assignedSalesRep', 'firstName lastName email phone')
        .populate('introducer', 'firstName lastName callingName employeeCode designation')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');

    if (!customer) { res.status(404); throw new Error('Customer not found'); }
    res.json({ success: true, data: customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
    const payload = { ...req.body, updatedBy: req.user._id };
    if (payload.assignedSalesRep === '') payload.assignedSalesRep = null;
    if (payload.introducer === '') payload.introducer = null;

    const oldData = await Customer.findById(req.params.id);
    const customer = await Customer.findByIdAndUpdate(req.params.id, payload, {
        new: true, runValidators: true,
    })
        .populate('assignedSalesRep', 'firstName lastName')
        .populate('introducer', 'firstName lastName callingName employeeCode designation');

    if (!customer) { res.status(404); throw new Error('Customer not found'); }
    res.json({ success: true, data: customer });

    createAuditLog({
        action: 'update',
        module: 'customers',
        documentId: customer._id,
        documentCode: customer.customerCode,
        description: `Updated customer: ${customer.displayName}`,
        changes: req.body,
        previousData: oldData,
        req
    });

    backupEmitter.emit(BACKUP_EVENTS.CUSTOMER_CHANGED);
});

export const deleteCustomer = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404); throw new Error('Customer not found'); }
    customer.deletedAt = new Date();
    customer.status = 'inactive';
    await customer.save();
    res.json({ success: true, message: 'Customer deleted' });

    createAuditLog({
        action: 'delete',
        module: 'customers',
        documentId: customer._id,
        documentCode: customer.customerCode,
        description: `Soft-deleted customer: ${customer.displayName}`,
        req
    });

    backupEmitter.emit(BACKUP_EVENTS.CUSTOMER_CHANGED);
});

// Toggle credit hold
export const toggleCreditHold = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404); throw new Error('Customer not found'); }

    customer.creditStatus.onCreditHold = !customer.creditStatus.onCreditHold;
    customer.creditStatus.creditHoldReason = customer.creditStatus.onCreditHold ? reason : null;
    await customer.save();

    res.json({
        success: true,
        message: customer.creditStatus.onCreditHold ? 'Customer placed on credit hold' : 'Credit hold removed',
        data: customer,
    });

    createAuditLog({
        action: 'update',
        module: 'customers',
        documentId: customer._id,
        documentCode: customer.customerCode,
        description: customer.creditStatus.onCreditHold ? 'Placed customer on credit hold' : 'Removed customer from credit hold',
        req
    });

    backupEmitter.emit(BACKUP_EVENTS.CUSTOMER_CHANGED);
});