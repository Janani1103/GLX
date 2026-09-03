import express from 'express';
import {
    createInvoice, createFromSalesOrder, getInvoices, getInvoiceById,
    getAgingSummary, changeInvoiceStatus, deleteInvoice,
    convertProformaToCommercial, convertInvoiceToProforma, convertInvoiceToProject,
    revertInvoiceConversion
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
    createInvoiceSchema, createFromSalesOrderSchema,
} from '../validators/invoiceValidator.js';

const router = express.Router();
router.use(protect);

router.get('/aging/summary', requirePermission('reports.financial'), getAgingSummary);

router
    .route('/')
    .get(requirePermission('invoices.view'), getInvoices)
    .post(
        requirePermission('invoices.create'),
        validate(createInvoiceSchema),
        createInvoice
    );

router.post(
    '/from-sales-order',
    requirePermission('invoices.create'),
    validate(createFromSalesOrderSchema),
    createFromSalesOrder
);

router.post(
    '/:id/convert-proforma',
    requirePermission('invoices.create'),
    convertProformaToCommercial
);

router.post(
    '/:id/convert-to-commercial',
    requirePermission('invoices.create'),
    convertProformaToCommercial
);

router.post(
    '/:id/convert-to-proforma',
    requirePermission('invoices.create'),
    convertInvoiceToProforma
);

router.post(
    '/:id/convert-to-project',
    requirePermission('invoices.create'),
    convertInvoiceToProject
);

router.post(
    '/:id/revert-conversion',
    requirePermission('invoices.edit'),
    revertInvoiceConversion
);

router
    .route('/:id')
    .get(requirePermission('invoices.view'), getInvoiceById)
    .delete(requirePermission('invoices.view'), deleteInvoice);

router.patch(
    '/:id/status',
    requirePermission('invoices.edit'),
    changeInvoiceStatus
);

export default router;