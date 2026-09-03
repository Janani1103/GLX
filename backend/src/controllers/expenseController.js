import Expense from '../models/Expense.js';
import { decreaseStock } from '../services/stockService.js';

/**
 * @desc    Get all expenses with pagination & filters
 * @route   GET /api/expenses
 * @access  Private
 */
export const getExpenses = async (req, res) => {
  try {
    const { category, paymentMethod, startDate, endDate, search, projectId, page = 1, limit = 50 } = req.query;

    const query = {};

    if (projectId) {
      query.projectId = projectId;
    }

    if (category) {
      query.category = category;
    }
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { expenseNumber: { $regex: search, $options: 'i' } },
        { payeeName: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { chequeNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('supplierId', 'name companyName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate aggregated totals
    const totalAmountResult = await Expense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total : 0;

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        totalAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get expense by ID
 * @route   GET /api/expenses/:id
 * @access  Private
 */
export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('supplierId', 'name companyName');

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create new expense
 * @route   POST /api/expenses
 * @access  Private
 */
export const createExpense = async (req, res) => {
  try {
    let expenseData = {
      ...req.body,
      createdBy: req.user?._id,
    };

    if (req.body.isStockConsumption && Array.isArray(req.body.items) && req.body.items.length > 0) {
      const totalAmount = req.body.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.costPerUnit || 0)), 0);
      expenseData.amount = totalAmount;
    }

    const expense = await Expense.create(expenseData);

    if (req.body.isStockConsumption && Array.isArray(req.body.items) && req.body.items.length > 0) {
      try {
        for (const item of req.body.items) {
          await decreaseStock({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: Number(item.quantity),
            movementType: 'expense',
            sourceDocument: {
              type: 'Expense',
              id: expense._id,
              number: expense.expenseNumber,
            },
            reason: 'Internal stock consumption',
            notes: expense.title,
            userId: req.user?._id,
          });
        }
      } catch (stockErr) {
        await Expense.findByIdAndDelete(expense._id);
        return res.status(400).json({ success: false, message: stockErr.message });
      }
    }

    if (expense.projectId) {
      try {
        const { recalculateProjectFinancials } = await import('./projectController.js');
        await recalculateProjectFinancials(expense.projectId);
      } catch (err) {
        console.error('[Expense Project Update] Failed:', err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update expense
 * @route   PUT /api/expenses/:id
 * @access  Private
 */
export const updateExpense = async (req, res) => {
  try {
    let expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user?._id,
    };

    expense = await Expense.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (expense.projectId) {
      try {
        const { recalculateProjectFinancials } = await import('./projectController.js');
        await recalculateProjectFinancials(expense.projectId);
      } catch (err) {
        console.error('[Expense Update Project Update] Failed:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete expense (soft delete)
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense.deletedAt = new Date();
    expense.updatedBy = req.user?._id;
    await expense.save();

    if (expense.projectId) {
      try {
        const { recalculateProjectFinancials } = await import('./projectController.js');
        await recalculateProjectFinancials(expense.projectId);
      } catch (err) {
        console.error('[Expense Delete Project Update] Failed:', err.message);
      }
    }

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get expense analytics summary
 * @route   GET /api/expenses/summary
 * @access  Private
 */
export const getExpenseSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const byCategory = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const byPaymentMethod = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = byCategory.reduce((acc, c) => acc + c.total, 0);

    res.json({
      success: true,
      data: {
        grandTotal,
        byCategory,
        byPaymentMethod,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
