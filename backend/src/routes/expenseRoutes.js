import express from 'express';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/summary', requirePermission('payments.view'), getExpenseSummary);

router.route('/')
  .get(requirePermission('payments.view'), getExpenses)
  .post(requirePermission('payments.manage'), createExpense);

router.route('/:id')
  .get(requirePermission('payments.view'), getExpenseById)
  .put(requirePermission('payments.manage'), updateExpense)
  .delete(requirePermission('payments.manage'), deleteExpense);

export default router;
