import asyncHandler from 'express-async-handler';
import Category from '../models/Category.js';

export const createCategory = asyncHandler(async (req, res) => {
    const category = await Category.create({
        ...req.body,
        createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: category });
});

export const getCategories = asyncHandler(async (req, res) => {
    const { search, type, isActive, parentCategory } = req.query;
    const filter = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } },
        ];
    }
    if (type) filter.type = type;
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }
    if (parentCategory) {
        filter.parentCategory = parentCategory === 'null' ? null : parentCategory;
    }

    const categories = await Category.find(filter)
        .populate('parentCategory', 'name code')
        .sort({ displayOrder: 1, name: 1 });

    res.json({ success: true, count: categories.length, data: categories });
});

export const getCategoryById = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id).populate('parentCategory', 'name code');
    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }
    res.json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );
    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }
    res.json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }
    category.deletedAt = new Date();
    category.isActive = false;
    await category.save();
    res.json({ success: true, message: 'Category deleted' });
});