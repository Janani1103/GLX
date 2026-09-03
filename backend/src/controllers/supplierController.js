import asyncHandler from 'express-async-handler';
import Supplier from '../models/Supplier.js';

export const createSupplier = asyncHandler(async (req, res) => {
    const payload = { ...req.body, createdBy: req.user._id };
    const supplier = await Supplier.create(payload);
    res.status(201).json({ success: true, data: supplier });
});

export const getSuppliers = asyncHandler(async (req, res) => {
    const {
        search, category, status,
        page = 1, limit = 20,
        sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
        filter.$or = [
            { displayName: { $regex: search, $options: 'i' } },
            { companyName: { $regex: search, $options: 'i' } },
            { supplierCode: { $regex: search, $options: 'i' } },
            { 'primaryContact.phone': { $regex: search, $options: 'i' } },
        ];
    }
    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [suppliers, total] = await Promise.all([
        Supplier.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
        Supplier.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: suppliers.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        data: suppliers,
    });
});

export const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    res.json({ success: true, data: supplier });
});

export const updateSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    res.json({ success: true, data: supplier });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    supplier.deletedAt = new Date();
    supplier.status = 'inactive';
    await supplier.save();
    res.json({ success: true, message: 'Supplier deleted' });
});