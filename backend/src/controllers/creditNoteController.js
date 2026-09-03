import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import CreditNote from '../models/CreditNote.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import { updateCustomerBalance } from './invoiceController.js';

/**
 * POST /api/credit-notes — manual credit note (not from return)
 */
export const createCreditNote = asyncHandler(async (req, res) => {
    const { customerId, amount, reason, description, invoiceId } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) { res.status(404); throw new Error('Customer not found'); }

    const cn = new CreditNote({
        customerId: customer._id,
        customerSnapshot: { name: customer.displayName, code: customer.customerCode },
        amount,
        reason: reason || 'other',
        description,
        invoiceId,
        createdBy: req.user._id,
    });
    await cn.save();

    await updateCustomerBalance(customer._id);

    res.status(201).json({ success: true, data: cn });
});

export const getCreditNotes = asyncHandler(async (req, res) => {
    const { customerId, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [notes, total] = await Promise.all([
        CreditNote.find(filter)
            .populate('customerId', 'displayName customerCode')
            .populate('customerReturnId', 'rmaNumber')
            .sort({ issueDate: -1 }).skip(skip).limit(Number(limit)),
        CreditNote.countDocuments(filter),
    ]);

    res.json({
        success: true, count: notes.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: notes,
    });
});

export const getCreditNoteById = asyncHandler(async (req, res) => {
    const cn = await CreditNote.findById(req.params.id)
        .populate('customerId', 'displayName customerCode')
        .populate('customerReturnId', 'rmaNumber')
        .populate('applications.invoiceId', 'invoiceNumber')
        .populate('applications.appliedBy', 'firstName lastName')
        .populate('createdBy', 'firstName lastName');
    if (!cn) { res.status(404); throw new Error('Credit note not found'); }
    res.json({ success: true, data: cn });
});

/**
 * POST /api/credit-notes/:id/apply
 * Apply credit note to an invoice
 */
export const applyCreditNote = asyncHandler(async (req, res) => {
    const { invoiceId, amount } = req.body;
    const cn = await CreditNote.findById(req.params.id);
    if (!cn) { res.status(404); throw new Error('Credit note not found'); }
    if (cn.status === 'fully_applied' || cn.status === 'cancelled') {
        res.status(400); throw new Error(`Credit note is ${cn.status}`);
    }
    if (amount > cn.remainingAmount) {
        res.status(400); throw new Error(`Cannot apply more than remaining (${cn.remainingAmount})`);
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) { res.status(404); throw new Error('Invoice not found'); }
    if (invoice.customerId.toString() !== cn.customerId.toString()) {
        res.status(400); throw new Error('Credit note and invoice must be for the same customer');
    }
    if (amount > invoice.balanceDue) {
        res.status(400); throw new Error(`Cannot apply more than invoice balance (${invoice.balanceDue})`);
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            cn.applications.push({
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                amountApplied: amount,
                appliedBy: req.user._id,
            });
            await cn.save({ session });

            invoice.amountPaid = +(invoice.amountPaid + amount).toFixed(2);
            invoice.lastPaymentDate = new Date();
            await invoice.save({ session });
        });

        await updateCustomerBalance(cn.customerId);

        res.json({ success: true, message: 'Credit applied to invoice', data: cn });
    } finally {
        session.endSession();
    }
});