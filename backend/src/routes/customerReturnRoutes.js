import express from 'express';
import {
    createReturn, getReturns, getReturnById,
    approveReturn, rejectReturn, receiveReturn,
    processReturn, issueCreditNote, completeReturn,
    getEligibleOrders,
} from '../controllers/customerReturnController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
router.use(protect);

router.route('/')
    .get(requirePermission('returns.view'), getReturns)
    .post(requirePermission('returns.manage'), createReturn);

router.route('/:id').get(requirePermission('returns.view'), getReturnById);

router.patch('/:id/approve', requirePermission('returns.manage'), approveReturn);
router.patch('/:id/reject', requirePermission('returns.manage'), rejectReturn);
router.patch('/:id/receive', requirePermission('inventory.manage', 'returns.manage'), receiveReturn);
router.patch('/:id/process', requirePermission('inventory.manage', 'returns.manage'), processReturn);
router.patch('/:id/issue-credit-note', requirePermission('credit_notes.manage'), issueCreditNote);
router.patch('/:id/complete', requirePermission('returns.manage'), completeReturn);
router.get('/eligible-orders', requirePermission('returns.manage'), getEligibleOrders);

export default router;