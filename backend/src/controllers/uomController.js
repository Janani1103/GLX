import asyncHandler from 'express-async-handler';
import UnitOfMeasure from '../models/UnitOfMeasure.js';

export const createUom = asyncHandler(async (req, res) => {
    const uom = await UnitOfMeasure.create(req.body);
    res.status(201).json({ success: true, data: uom });
});

export const getUoms = asyncHandler(async (req, res) => {
    const { type, isActive } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }

    const uoms = await UnitOfMeasure.find(filter).sort({ type: 1, name: 1 });
    res.json({ success: true, count: uoms.length, data: uoms });
});

export const updateUom = asyncHandler(async (req, res) => {
    const uom = await UnitOfMeasure.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!uom) {
        res.status(404);
        throw new Error('UOM not found');
    }
    res.json({ success: true, data: uom });
});

export const deleteUom = asyncHandler(async (req, res) => {
    const uom = await UnitOfMeasure.findByIdAndDelete(req.params.id);
    if (!uom) {
        res.status(404);
        throw new Error('UOM not found');
    }
    res.json({ success: true, message: 'UOM deleted' });
});