import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import BankAccount from '../models/BankAccount.js';
import { broadcast } from '../services/socketService.js';
import { updateCustomerBalance } from './invoiceController.js';

/**
 * POST /api/payments
 * Record a payment (received from customer or paid to supplier)
 */
export const createPayment = asyncHandler(async (req, res) => {
    const { direction, customerId, supplierId, bankAccountId, amount, allocations = [], method, chequeStatus, ...rest } = req.body;

    if (direction === 'received' && !customerId) {
        res.status(400); throw new Error('customerId required for received payments');
    }
    if (direction === 'paid' && !supplierId) {
        res.status(400); throw new Error('supplierId required for paid payments');
    }

    let payment;
    const isChequePending = method === 'cheque' && chequeStatus !== 'cleared';

    try {
        // Validate & adjust allocations
        for (const alloc of allocations) {
            if (alloc.documentType === 'invoice') {
                const inv = await Invoice.findById(alloc.documentId);
                if (!inv) throw new Error(`Invoice ${alloc.documentId} not found`);
                if (alloc.amount > inv.balanceDue) {
                    throw new Error(`Cannot allocate ${alloc.amount} to invoice ${inv.invoiceNumber}, balance is ${inv.balanceDue}`);
                }
                alloc.documentNumber = inv.invoiceNumber;
            } else if (alloc.documentType === 'bill') {
                const bill = await Bill.findById(alloc.documentId);
                if (!bill) throw new Error(`Bill ${alloc.documentId} not found`);
                if (alloc.amount > bill.balanceDue) {
                    throw new Error(`Cannot allocate ${alloc.amount} to bill ${bill.billNumber}, balance is ${bill.balanceDue}`);
                }
                alloc.documentNumber = bill.billNumber;
            }
        }

        // Get party name
        let partyName = '';
        if (direction === 'received') {
            const c = await Customer.findById(customerId);
            partyName = c?.displayName;
        } else {
            const Supplier = (await import('../models/Supplier.js')).default;
            const s = await Supplier.findById(supplierId);
            partyName = s?.displayName;
        }

        // Update bank account balance if bankAccountId is provided and not a pending cheque
        if (bankAccountId && !isChequePending) {
            const bankAccount = await BankAccount.findById(bankAccountId);
            if (!bankAccount) throw new Error('Company bank account not found');
            
            const payAmount = Number(amount || 0);
            if (direction === 'received') {
                bankAccount.balance = +(bankAccount.balance + payAmount).toFixed(2);
            } else if (direction === 'paid') {
                bankAccount.balance = +(bankAccount.balance - payAmount).toFixed(2);
            }
            await bankAccount.save();
        }

        payment = new Payment({
            direction,
            customerId: direction === 'received' ? customerId : undefined,
            supplierId: direction === 'paid' ? supplierId : undefined,
            bankAccountId,
            amount,
            method,
            chequeStatus: method === 'cheque' ? (chequeStatus || 'pending') : undefined,
            partyName,
            allocations,
            receivedBy: req.user._id,
            createdBy: req.user._id,
            ...rest,
        });

        await payment.save();

        // Apply allocations to invoices/bills
        for (const alloc of allocations) {
            if (alloc.documentType === 'invoice') {
                const inv = await Invoice.findById(alloc.documentId);
                inv.amountPaid = +(inv.amountPaid + alloc.amount).toFixed(2);
                inv.lastPaymentDate = payment.paymentDate;
                await inv.save();
            } else if (alloc.documentType === 'bill') {
                const bill = await Bill.findById(alloc.documentId);
                bill.amountPaid = +(bill.amountPaid + alloc.amount).toFixed(2);
                bill.lastPaymentDate = payment.paymentDate;
                await bill.save();
            }
        }

        // Update customer balance if received
        if (direction === 'received') {
            await updateCustomerBalance(customerId);
        }
        try {
            broadcast('financial_update', {
                message: 'Financial accounts updated via new payment log',
            });
        } catch (_) {}

        // Broadcast bank account balance change after successful save
        if (bankAccountId && !isChequePending) {
            const updatedAccount = await BankAccount.findById(bankAccountId);
            if (updatedAccount) {
                broadcast('bank_balance_update', { 
                    bankAccountId, 
                    balance: updatedAccount.balance 
                });
            }
        }

        const populated = await Payment.findById(payment._id)
            .populate('customerId', 'displayName customerCode')
            .populate('supplierId', 'displayName supplierCode')
            .populate('bankAccountId', 'bankName accountNumber accountName');

        res.status(201).json({ success: true, data: populated });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to create payment');
    }
});

/**
 * PUT /api/payments/:id/clear
 * Clear a pending cheque payment, adjusting the linked bank account balance.
 */
export const clearPaymentCheque = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }
    if (payment.method !== 'cheque') {
        res.status(400);
        throw new Error('Only cheque payments can be cleared');
    }
    if (payment.chequeStatus === 'cleared') {
        res.status(400);
        throw new Error('Cheque is already cleared');
    }

    try {
        payment.chequeStatus = 'cleared';
        await payment.save();

        if (payment.bankAccountId) {
            const bankAccount = await BankAccount.findById(payment.bankAccountId);
            if (!bankAccount) throw new Error('Associated company bank account not found');

            const payAmount = Number(payment.amount || 0);
            if (payment.direction === 'received') {
                bankAccount.balance = +(bankAccount.balance + payAmount).toFixed(2);
            } else if (payment.direction === 'paid') {
                bankAccount.balance = +(bankAccount.balance - payAmount).toFixed(2);
            }
            await bankAccount.save();
        }

        // Broadcast bank balance update
        if (payment.bankAccountId) {
            const updatedAccount = await BankAccount.findById(payment.bankAccountId);
            if (updatedAccount) {
                broadcast('bank_balance_update', {
                    bankAccountId: payment.bankAccountId,
                    balance: updatedAccount.balance,
                });
            }
        }

        // Broadcast cheque clearance event
        try {
            broadcast('cheque_cleared', {
                paymentId: payment._id,
                paymentNumber: payment.paymentNumber,
                amount: payment.amount,
                chequeNumber: payment.chequeNumber,
            });
            broadcast('financial_update', {
                message: 'Financial accounts updated via cheque clearance',
            });
        } catch (_) {}

        const populated = await Payment.findById(payment._id)
            .populate('customerId', 'displayName customerCode')
            .populate('supplierId', 'displayName supplierCode')
            .populate('bankAccountId', 'bankName accountNumber accountName');

        res.json({ success: true, message: 'Cheque cleared successfully', data: populated });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to clear cheque');
    }
});

/**
 * PUT /api/payments/:id/status
 * Update the chequeStatus of a payment, adjusting bank account balance based on status transition.
 */
export const updatePaymentChequeStatus = asyncHandler(async (req, res) => {
    const { chequeStatus } = req.body;
    if (!['pending', 'cleared', 'bounced'].includes(chequeStatus)) {
        res.status(400);
        throw new Error('Invalid cheque status');
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }
    if (payment.method !== 'cheque') {
        res.status(400);
        throw new Error('Only cheque payments can have their status updated');
    }

    const oldStatus = payment.chequeStatus || 'pending';
    const newStatus = chequeStatus;

    if (oldStatus === newStatus) {
        return res.json({ success: true, message: 'Status is already set to ' + newStatus, data: payment });
    }

    try {
        payment.chequeStatus = newStatus;
        await payment.save();

        if (payment.bankAccountId) {
            const bankAccount = await BankAccount.findById(payment.bankAccountId);
            if (!bankAccount) throw new Error('Associated company bank account not found');

            const payAmount = Number(payment.amount || 0);

            // If transitioning from cleared -> non-cleared, reverse the bank balance adjustment
            if (oldStatus === 'cleared' && newStatus !== 'cleared') {
                if (payment.direction === 'received') {
                    bankAccount.balance = +(bankAccount.balance - payAmount).toFixed(2);
                } else if (payment.direction === 'paid') {
                    bankAccount.balance = +(bankAccount.balance + payAmount).toFixed(2);
                }
                await bankAccount.save();
            }
            // If transitioning from non-cleared -> cleared, apply the bank balance adjustment
            else if (oldStatus !== 'cleared' && newStatus === 'cleared') {
                if (payment.direction === 'received') {
                    bankAccount.balance = +(bankAccount.balance + payAmount).toFixed(2);
                } else if (payment.direction === 'paid') {
                    bankAccount.balance = +(bankAccount.balance - payAmount).toFixed(2);
                }
                await bankAccount.save();
            }
        }

        // Broadcast bank balance update if bankAccountId was adjusted
        if (payment.bankAccountId && (oldStatus === 'cleared' || newStatus === 'cleared')) {
            const updatedAccount = await BankAccount.findById(payment.bankAccountId);
            if (updatedAccount) {
                broadcast('bank_balance_update', {
                    bankAccountId: payment.bankAccountId,
                    balance: updatedAccount.balance,
                });
            }
        }

        // Broadcast cheque status update event
        try {
            broadcast('cheque_cleared', {
                paymentId: payment._id,
                paymentNumber: payment.paymentNumber,
                amount: payment.amount,
                chequeNumber: payment.chequeNumber,
                status: newStatus,
            });
            broadcast('financial_update', {
                message: `Financial accounts updated via cheque status change to ${newStatus}`,
            });
        } catch (_) {}

        const populated = await Payment.findById(payment._id)
            .populate('customerId', 'displayName customerCode')
            .populate('supplierId', 'displayName supplierCode')
            .populate('bankAccountId', 'bankName accountNumber accountName');

        res.json({ success: true, message: `Cheque status updated to ${newStatus} successfully`, data: populated });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to update cheque status');
    }
});


export const getPayments = asyncHandler(async (req, res) => {
    const {
        direction, voucherType, customerId, supplierId, method, status,
        startDate, endDate, search,
        page = 1, limit = 50,
    } = req.query;

    const { documentId } = req.query;

    const filter = {};
    if (direction) filter.direction = direction;
    if (voucherType) filter.voucherType = voucherType;
    if (customerId) filter.customerId = customerId;
    if (documentId) {
        filter['allocations.documentId'] = documentId;
    }
    if (supplierId) filter.supplierId = supplierId;
    if (method) filter.method = method;
    if (status) filter.status = status;
    if (startDate || endDate) {
        filter.paymentDate = {};
        if (startDate) filter.paymentDate.$gte = new Date(startDate);
        if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
            { paymentNumber: searchRegex },
            { partyName: searchRegex },
            { notes: searchRegex },
            { hireNoteNumber: searchRegex },
            { vehicleNo: searchRegex },
            { 'allocations.documentNumber': searchRegex },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
        Payment.find(filter)
            .populate('customerId', 'displayName customerCode companyName')
            .populate('supplierId', 'displayName supplierCode companyName')
            .populate('employeeId', 'firstName lastName employeeCode')
            .populate('receivedBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
        Payment.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: payments.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: payments,
    });
});

export const getPaymentById = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id)
        .populate('customerId', 'displayName customerCode companyName')
        .populate('supplierId', 'displayName supplierCode companyName')
        .populate('employeeId', 'firstName lastName employeeCode')
        .populate('receivedBy', 'firstName lastName')
        .populate('createdBy', 'firstName lastName');
    if (!payment) { res.status(404); throw new Error('Payment or Voucher not found'); }
    res.json({ success: true, data: payment });
});

/**
 * POST /api/payments/voucher
 * Issue a Voucher (Cash OUT / Payment Out)
 * Reason Types:
 * 1. customer_advance_refund (Customer Advance Refund)
 * 2. supplier_payment (Supplier Payment)
 * 3. transport_hire (Transport & Hire Expense)
 * 4. operational_expense (Petty Cash / Daily Yard Expenses)
 * 5. labor_advance / salary_advance (Labor / Employee Salary Advance)
 */
export const createVoucher = asyncHandler(async (req, res) => {
    const {
        voucherType,
        customerId,
        supplierId,
        employeeId,
        partyName,
        bankAccountId,
        amount,
        method = 'cash',
        chequeNumber,
        chequeDate,
        bankName,
        transactionReference,
        hireNoteNumber,
        vehicleNo,
        transportDriver,
        notes,
        signatureNote,
        allocations = [],
    } = req.body;

    if (!voucherType) {
        res.status(400); throw new Error('voucherType is required for issuing a voucher');
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        res.status(400); throw new Error('Valid positive voucher amount is required');
    }

    let voucher;

    try {
        let resolvedPartyName = partyName || '';

        // Handle party name resolution and party validation
        if (voucherType === 'customer_advance_refund') {
            if (!customerId) throw new Error('customerId is required for Customer Advance Refund');
            const c = await Customer.findById(customerId);
            if (!c) throw new Error('Customer not found');
            resolvedPartyName = c.displayName || c.companyName || `${c.firstName} ${c.lastName}`;
        } else if (voucherType === 'supplier_payment') {
            if (!supplierId) throw new Error('supplierId is required for Supplier Payment');
            const Supplier = (await import('../models/Supplier.js')).default;
            const s = await Supplier.findById(supplierId);
            if (!s) throw new Error('Supplier not found');
            resolvedPartyName = s.displayName || s.companyName;
        } else if (voucherType === 'labor_advance' || voucherType === 'salary_advance') {
            if (!employeeId) throw new Error('Employee selection is required for Labor Advance Voucher');
            const Employee = (await import('../models/Employee.js')).default;
            const emp = await Employee.findById(employeeId);
            if (!emp) throw new Error('Employee not found');
            resolvedPartyName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeCode || 'Employee';
        }

        // Update bank account if provided
        if (bankAccountId) {
            const bankAccount = await BankAccount.findById(bankAccountId);
            if (!bankAccount) throw new Error('Selected bank account not found');
            bankAccount.balance = +(bankAccount.balance - numAmount).toFixed(2);
            await bankAccount.save();
        }

        // Create Voucher payment doc
        voucher = new Payment({
            direction: 'paid',
            voucherType,
            voucherCategory: voucherType,
            customerId: voucherType === 'customer_advance_refund' ? customerId : undefined,
            supplierId: voucherType === 'supplier_payment' ? supplierId : undefined,
            employeeId: (voucherType === 'labor_advance' || voucherType === 'salary_advance') ? employeeId : undefined,
            partyName: resolvedPartyName,
            bankAccountId,
            amount: numAmount,
            method,
            chequeNumber,
            chequeDate: chequeDate ? new Date(chequeDate) : undefined,
            bankName,
            transactionReference,
            hireNoteNumber,
            vehicleNo,
            transportDriver,
            notes,
            signatureNote,
            allocations,
            receivedBy: req.user._id,
            createdBy: req.user._id,
        });

        await voucher.save();

        // If voucher is labor_advance or salary_advance, auto-create SalaryAdvance record for payroll deduction
        if ((voucherType === 'labor_advance' || voucherType === 'salary_advance') && employeeId) {
            const SalaryAdvance = (await import('../models/SalaryAdvance.js')).default;
            await SalaryAdvance.create([{
                employeeId,
                date: voucher.paymentDate || new Date(),
                advanceType: 'amount',
                amount: numAmount,
                reason: notes || `Payment Voucher Advance: ${voucher.paymentNumber}`,
                status: 'approved',
                approvedBy: req.user._id,
                approvedAt: new Date(),
                createdBy: req.user._id,
            }]);
        }

        // Apply allocations or update document amounts
        for (const alloc of allocations) {
            if (alloc.documentType === 'invoice' && alloc.documentId) {
                const inv = await Invoice.findById(alloc.documentId);
                if (inv) {
                    if (voucherType === 'customer_advance_refund') {
                        inv.amountPaid = Math.max(0, +(inv.amountPaid - alloc.amount).toFixed(2));
                    } else {
                        inv.amountPaid = +(inv.amountPaid + alloc.amount).toFixed(2);
                    }
                    inv.lastPaymentDate = voucher.paymentDate;
                    await inv.save();
                }
            } else if (alloc.documentType === 'bill' && alloc.documentId) {
                const bill = await Bill.findById(alloc.documentId);
                if (bill) {
                    bill.amountPaid = +(bill.amountPaid + alloc.amount).toFixed(2);
                    bill.lastPaymentDate = voucher.paymentDate;
                    await bill.save();
                }
            }
        }

        // Update customer balance if advance refund
        if (voucherType === 'customer_advance_refund' && customerId) {
            await updateCustomerBalance(customerId);
        }

        // Broadcast financial update
        try {
            broadcast('financial_update', {
                message: `New Voucher issued: ${voucher.paymentNumber} (${voucherType})`,
            });
        } catch (_) {}

        const populated = await Payment.findById(voucher._id)
            .populate('customerId', 'displayName customerCode companyName')
            .populate('supplierId', 'displayName supplierCode companyName')
            .populate('employeeId', 'firstName lastName employeeCode')
            .populate('bankAccountId', 'bankName accountNumber accountName')
            .populate('receivedBy', 'firstName lastName');

        res.status(201).json({ success: true, data: populated });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to issue voucher');
    }
});

/**
 * GET /api/payments/linkable-documents
 * Search for Invoices, Quotations, Estimates, Bills, GRNs for document linking during Voucher / Receipt entry
 */
export const searchLinkableDocuments = asyncHandler(async (req, res) => {
    const { customerId, supplierId, search, type } = req.query;
    const documents = [];

    // Customer documents (Invoices, Quotations, Estimates)
    if (customerId || type === 'customer') {
        const queryFilter = {};
        if (customerId) queryFilter.customerId = customerId;

        // Invoices
        const invList = await Invoice.find(queryFilter)
            .select('_id invoiceNumber invoiceCode grandTotal amountPaid status createdAt')
            .sort({ createdAt: -1 })
            .limit(30);

        invList.forEach(inv => {
            const balanceDue = +(inv.grandTotal - (inv.amountPaid || 0)).toFixed(2);
            documents.push({
                documentType: 'invoice',
                documentId: inv._id,
                documentNumber: inv.invoiceNumber || inv.invoiceCode,
                totalAmount: inv.grandTotal,
                amountPaid: inv.amountPaid || 0,
                balanceDue: balanceDue > 0 ? balanceDue : 0,
                status: inv.status,
                label: `Invoice: ${inv.invoiceNumber || inv.invoiceCode} (Total: LKR ${inv.grandTotal.toLocaleString()})`,
            });
        });

        // Quotations & Estimates
        const Quotation = (await import('../models/Quotation.js')).default;
        const qList = await Quotation.find(queryFilter)
            .select('_id quotationCode quoteNumber documentType grandTotal status createdAt')
            .sort({ createdAt: -1 })
            .limit(30);

        qList.forEach(q => {
            documents.push({
                documentType: q.documentType || 'quotation',
                documentId: q._id,
                documentNumber: q.quoteNumber || q.quotationCode,
                totalAmount: q.grandTotal,
                amountPaid: 0,
                balanceDue: q.grandTotal,
                status: q.status,
                label: `${q.documentType === 'estimate' ? 'Estimate' : 'Quotation'}: ${q.quoteNumber || q.quotationCode} (LKR ${q.grandTotal.toLocaleString()})`,
            });
        });
    }

    // Supplier documents (Bills & GRNs)
    if (supplierId || type === 'supplier') {
        const queryFilter = {};
        if (supplierId) queryFilter.supplierId = supplierId;

        const billList = await Bill.find(queryFilter)
            .select('_id billNumber totalAmount amountPaid status createdAt')
            .sort({ createdAt: -1 })
            .limit(30);

        billList.forEach(b => {
            const balanceDue = +(b.totalAmount - (b.amountPaid || 0)).toFixed(2);
            documents.push({
                documentType: 'bill',
                documentId: b._id,
                documentNumber: b.billNumber,
                totalAmount: b.totalAmount,
                amountPaid: b.amountPaid || 0,
                balanceDue: balanceDue > 0 ? balanceDue : 0,
                status: b.status,
                label: `Supplier Bill: ${b.billNumber} (Total: LKR ${b.totalAmount.toLocaleString()})`,
            });
        });

        const GoodsReceiptNote = (await import('../models/GoodsReceiptNote.js')).default;
        const grnList = await GoodsReceiptNote.find(queryFilter)
            .select('_id grnNumber totalAmount status createdAt')
            .sort({ createdAt: -1 })
            .limit(30);

        grnList.forEach(grn => {
            documents.push({
                documentType: 'grn',
                documentId: grn._id,
                documentNumber: grn.grnNumber,
                totalAmount: grn.totalAmount || 0,
                amountPaid: 0,
                balanceDue: grn.totalAmount || 0,
                status: grn.status,
                label: `GRN: ${grn.grnNumber}`,
            });
        });
    }

    // Filter by search text if provided
    let results = documents;
    if (search) {
        const s = search.toLowerCase();
        results = documents.filter(d => 
            d.documentNumber.toLowerCase().includes(s) || 
            d.label.toLowerCase().includes(s)
        );
    }

    res.json({ success: true, count: results.length, data: results });
});

/**
 * GET /api/payments/document-summary/:documentId
 * Fetch Payment History Audit & Total Paid Summary for a given document (Invoice, Quotation, Estimate, Bill, GRN, etc.)
 */
export const getDocumentPaymentSummary = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    if (!documentId) {
        res.status(400); throw new Error('documentId is required');
    }

    // Find all payments / vouchers where allocations contain this documentId
    const payments = await Payment.find({
        'allocations.documentId': documentId,
        status: 'confirmed',
    })
    .populate('customerId', 'displayName customerCode companyName')
    .populate('supplierId', 'displayName supplierCode companyName')
    .populate('receivedBy', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .sort({ paymentDate: -1 });

    let totalPaidSoFar = 0;
    const auditLogs = payments.map(p => {
        const alloc = p.allocations.find(a => a.documentId?.toString() === documentId.toString());
        const allocAmount = alloc ? alloc.amount : p.amount;
        
        // Receipts add to net paid; Advance Refunds deduct from net paid
        if (p.direction === 'paid' || p.voucherType === 'customer_advance_refund') {
            totalPaidSoFar -= allocAmount;
        } else {
            totalPaidSoFar += allocAmount;
        }

        return {
            paymentId: p._id,
            paymentNumber: p.paymentNumber,
            direction: p.direction,
            voucherType: p.voucherType,
            paymentDate: p.paymentDate,
            amount: allocAmount,
            totalPaymentAmount: p.amount,
            method: p.method,
            chequeNumber: p.chequeNumber,
            signatureNote: p.signatureNote,
            notes: p.notes,
            partyName: p.partyName,
            handledBy: p.receivedBy ? `${p.receivedBy.firstName || ''} ${p.receivedBy.lastName || ''}`.trim() : 'System Administrator',
        };
    });

    res.json({
        success: true,
        documentId,
        totalPaidSoFar: +totalPaidSoFar.toFixed(2),
        formattedTotalPaid: `LKR ${totalPaidSoFar.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`,
        summaryText: `Total amount settled so far via vouchers/receipts for this document: LKR ${totalPaidSoFar.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`,
        count: auditLogs.length,
        payments: auditLogs,
    });
});
