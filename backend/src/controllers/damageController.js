import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import DamageRecord from '../models/DamageRecord.js';
import Product from '../models/Product.js';
import RepairOrder from '../models/RepairOrder.js';
import { decreaseStock } from '../services/stockService.js';

/**
 * POST /api/damages
 * Manually record damage (warehouse, transit, etc.)
 * If adjustStock=true, will also decrement physical stock
 */
export const createDamage = asyncHandler(async (req, res) => {
    const {
        productId, quantity, warehouseId, source, description,
        disposition, costPerUnit, adjustStock,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) { res.status(404); throw new Error('Product not found'); }

    const damage = new DamageRecord({
        productId: product._id,
        productCode: product.productCode,
        productName: product.name,
        quantity,
        unitOfMeasure: product.unitOfMeasure,
        costPerUnit: costPerUnit ?? (product.costs?.averageCost || product.costs?.lastPurchaseCost || 0),
        warehouseId,
        source: source || 'warehouse_damage',
        description,
        disposition: disposition || 'pending',
        reportedBy: req.user._id,
    });
    await damage.save();

    if (adjustStock) {
        const result = await decreaseStock({
            productId: product._id,
            warehouseId,
            quantity,
            movementType: 'damage',
            sourceDocument: {
                type: 'damage_record',
                id: damage._id,
                number: damage.damageNumber,
            },
            reason: description || 'Damage recorded',
            userId: req.user._id,
        });
        damage.stockMovementId = result.movement._id;
        damage.stockAdjusted = true;
        await damage.save();
    }

    // If disposition is 'repair', auto-create a RepairOrder
    if (disposition === 'repair' || disposition === 'send_to_repair') {
        const repair = new RepairOrder({
            productId: product._id,
            productCode: product.productCode,
            productName: product.name,
            quantity: quantity || 1,
            sourceType: 'damage_record',
            damageRecordId: damage._id,
            issueDescription: description || `Damaged item from ${damage.damageNumber} (${source || 'warehouse damage'})`,
            createdBy: req.user._id,
        });
        await repair.save();
        damage.repairOrderId = repair._id;
        await damage.save();
    }

    res.status(201).json({ success: true, data: damage });
});

export const getDamages = asyncHandler(async (req, res) => {
    const {
        productId, warehouseId, source, disposition,
        startDate, endDate,
        page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (productId) filter.productId = productId;
    if (warehouseId) filter.warehouseId = warehouseId;
    if (source) filter.source = source;
    if (disposition) filter.disposition = disposition;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [damages, total] = await Promise.all([
        DamageRecord.find(filter)
            .populate('productId', 'name productCode')
            .populate('warehouseId', 'name warehouseCode')
            .populate('reportedBy', 'firstName lastName')
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        DamageRecord.countDocuments(filter),
    ]);

    res.json({
        success: true, count: damages.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: damages,
    });
});

export const getDamageById = asyncHandler(async (req, res) => {
    const d = await DamageRecord.findById(req.params.id)
        .populate('productId', 'name productCode')
        .populate('warehouseId', 'name warehouseCode')
        .populate('reportedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName');
    if (!d) { res.status(404); throw new Error('Damage record not found'); }
    res.json({ success: true, data: d });
});

/**
 * PATCH /api/damages/:id/write-off
 */
export const writeOffDamage = asyncHandler(async (req, res) => {
    const damage = await DamageRecord.findById(req.params.id);
    if (!damage) { res.status(404); throw new Error('Damage record not found'); }

    damage.writtenOff = true;
    damage.writtenOffAt = new Date();
    damage.writeOffValue = damage.totalValue;
    damage.approvedBy = req.user._id;
    damage.approvedAt = new Date();
    await damage.save();

    res.json({ success: true, data: damage });
});

export const getDamageSummary = asyncHandler(async (req, res) => {
    const result = await DamageRecord.aggregate([
        { $match: { deletedAt: null } },
        {
            $group: {
                _id: '$source',
                count: { $sum: 1 },
                totalValue: { $sum: '$totalValue' },
            },
        },
    ]);

    const totalCount = result.reduce((s, r) => s + r.count, 0);
    const totalValue = result.reduce((s, r) => s + r.totalValue, 0);

    res.json({ success: true, data: { bySource: result, totalCount, totalValue } });
});