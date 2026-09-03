import express from 'express';
import {
  getPettyCash, createPettyCash, updatePettyCash, deletePettyCash,
  getProduction, createProduction, updateProduction, deleteProduction,
  getPnL, createPnL, updatePnL, deletePnL,
  exportWithTemplate,
} from '../controllers/syncController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
router.use(protect);

// Petty Cash
router.get('/petty-cash', requirePermission('payments.view'), getPettyCash);
router.post('/petty-cash', requirePermission('payments.manage'), createPettyCash);
router.put('/petty-cash/:id', requirePermission('payments.manage'), updatePettyCash);
router.delete('/petty-cash/:id', requirePermission('payments.manage'), deletePettyCash);

// Production
router.get('/production', requirePermission('production.view'), getProduction);
router.post('/production', requirePermission('production.manage'), createProduction);
router.put('/production/:id', requirePermission('production.manage'), updateProduction);
router.delete('/production/:id', requirePermission('production.manage'), deleteProduction);

// P&L
router.get('/pnl', requirePermission('reports.financial'), getPnL);
router.post('/pnl', requirePermission('reports.financial'), createPnL);
router.put('/pnl/:id', requirePermission('reports.financial'), updatePnL);
router.delete('/pnl/:id', requirePermission('reports.financial'), deletePnL);

// Download source Excel file (with latest DB data synced in)
router.get('/export-template/:type', requirePermission('admin.settings'), exportWithTemplate);

export default router;
