import express from 'express';
import {
    createPettyCashEntry,
    getPettyCashEntries,
    getPettyCashBalance,
    updatePettyCashStatus,
    updatePettyCashEntry,
    deletePettyCashEntry,
    getPettyCashEntryById
} from '../controllers/pettyCashController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

// Running balance + category breakdown
// GET /api/finance/petty-cash/balance?poolId=MAIN
router.get('/balance', requirePermission('payments.view'), getPettyCashBalance);

router.route('/')
    .post(requirePermission('payments.manage'), createPettyCashEntry)
    .get(requirePermission('payments.view'), getPettyCashEntries);

router.route('/:id')
    .get(requirePermission('payments.view'), getPettyCashEntryById)
    .put(requirePermission('payments.manage'), updatePettyCashEntry)
    .delete(requirePermission('payments.manage'), deletePettyCashEntry);

router.put('/:id/status', requirePermission('payments.manage'), updatePettyCashStatus);

export default router;
