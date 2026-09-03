import express from 'express';
import {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    convertQuotationToInvoice,
    convertQuotationToProject,
    revertQuotationConversion
} from '../controllers/quotationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

// ── Quotation Routes ───────────────────────────────────────────────────────────
router.get('/quotations', requirePermission('sales.view'), getQuotations);
router.get('/quotations/:id', requirePermission('sales.view'), getQuotationById);
router.post('/quotations', requirePermission('sales.create'), createQuotation);
router.put('/quotations/:id', requirePermission('sales.edit'), updateQuotation);
router.delete('/quotations/:id', requirePermission('sales.delete'), deleteQuotation);
router.post('/quotations/:id/convert-to-invoice', requirePermission('sales.edit'), convertQuotationToInvoice);
router.post('/quotations/:id/convert-to-project', requirePermission('sales.edit'), convertQuotationToProject);
router.post('/quotations/:id/revert-conversion', requirePermission('sales.edit'), revertQuotationConversion);

export default router;
