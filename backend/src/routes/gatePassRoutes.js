import express from 'express';
import {
    getGatePasses,
    getGatePassById,
    getGateScreen,
    createGatePass,
    updateGatePass,
    approveGatePass,
    rejectGatePass,
    recordExit,
    deleteGatePass,
} from '../controllers/gatePassController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
router.use(protect);

// Public-ish: security screen polling fallback (no auth required for screen display)
router.get('/screen', requirePermission('inventory.view'), getGateScreen);

router.route('/')
    .get(requirePermission('inventory.view'), getGatePasses)
    .post(requirePermission('inventory.transfer'), createGatePass);

router.route('/:id')
    .get(requirePermission('inventory.view'), getGatePassById)
    .put(requirePermission('inventory.transfer'), updateGatePass)
    .delete(requirePermission('inventory.transfer'), deleteGatePass);

// Actions
router.put('/:id/approve', requirePermission('inventory.transfer'), approveGatePass);
router.put('/:id/reject',  requirePermission('inventory.transfer'), rejectGatePass);
router.put('/:id/exit',    requirePermission('inventory.transfer'), recordExit);

export default router;
