import express from 'express';
import { getAuditLogs, getAuditLogById, getSmsLogs, sendManualSms } from '../controllers/auditController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

const ALLOWED_ROLES = ['admin', 'super_admin', 'manager', 'warehouse_manager', 'sales_manager', 'hr_manager', 'accountant'];

router.route('/sms')
    .get(protect, authorize(...ALLOWED_ROLES), getSmsLogs);

router.route('/sms/send-manual')
    .post(protect, authorize(...ALLOWED_ROLES), sendManualSms);

router.route('/')
    .get(protect, authorize(...ALLOWED_ROLES), getAuditLogs);

router.route('/:id')
    .get(protect, authorize(...ALLOWED_ROLES), getAuditLogById);

export default router;
