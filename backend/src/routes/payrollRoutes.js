import express from 'express';
import {
    processPayroll, getPayrolls, getPayrollById,
    approvePayroll, markPayrollPaid,
    getEmployeePayslip, previewPayslip, getMyPayslips,
    downloadPayrollSheet,
    getDailyPayrollSummary, processDailyPayout, getDailyPayrollHistory,
    getPublicPayslipByToken, getPeriodPayrollSummary
} from '../controllers/payrollController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Public shareable link route (unprotected)
router.get('/payslips/share/:token', getPublicPayslipByToken);

router.use(protect);

router.get('/daily-summary', requirePermission('hr.payroll.view'), getDailyPayrollSummary);
router.post('/daily-payout', requirePermission('hr.payroll.manage'), processDailyPayout);
router.get('/daily-history', requirePermission('hr.payroll.view'), getDailyPayrollHistory);
router.get('/period-summary', requirePermission('hr.payroll.view'), getPeriodPayrollSummary);

router.post('/process', requirePermission('hr.payroll.manage'), processPayroll);
router.post('/preview', requirePermission('hr.payroll.manage'), previewPayslip);
router.get('/', requirePermission('hr.payroll.view'), getPayrolls);
router.get('/my-payslips', getMyPayslips);
router.get('/:id/download-sheet', requirePermission('hr.payroll.view'), downloadPayrollSheet);
router.get('/:id', requirePermission('hr.payroll.view'), getPayrollById);
router.patch('/:id/approve', requirePermission('hr.payroll.manage'), approvePayroll);
router.patch('/:id/mark-paid', requirePermission('hr.payroll.manage'), markPayrollPaid);
router.get('/:payrollId/payslip/:employeeId', requirePermission('hr.payroll.view'), getEmployeePayslip);

export default router;