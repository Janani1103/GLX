import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/permissionMiddleware.js';
import { 
    exportPettyCash, 
    exportProduction, 
    exportPnL,
    exportMonthlyPerformance,
    exportModuleData
} from '../controllers/exportController.js';

const router = express.Router();

router.get('/petty-cash', protect, requirePermission('payments.view'), exportPettyCash);
router.get('/production', protect, requirePermission('reports.production'), exportProduction);
router.get('/pnl', protect, requirePermission('reports.financial'), exportPnL);
router.get('/monthly-performance', protect, requirePermission('reports.financial'), exportMonthlyPerformance);
router.get('/:module/:format', protect, requireAnyPermission('reports.sales', 'reports.financial', 'reports.inventory', 'reports.hr', 'reports.production', 'admin.settings'), exportModuleData);

export default router;
