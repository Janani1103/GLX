import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Holiday from '../models/Holiday.js';
import SalaryAdvance from '../models/SalaryAdvance.js';
import DailyWagePayment from '../models/DailyWagePayment.js';
import Expense from '../models/Expense.js';
import Project from '../models/Project.js';
import BankAccount from '../models/BankAccount.js';
import { recalculateProjectFinancials } from './projectController.js';
import { calculatePayslip } from '../services/payrollCalculator.js';
import PdfPrinter from 'pdfkit-table';

/**
 * Helper: count working days in a month (excluding Sundays and holidays)
 */
const countWorkingDays = async (year, month) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const holidays = await Holiday.find({
        date: { $gte: start, $lte: end },
        type: { $in: ['public', 'national', 'poya', 'religious'] },
    }).select('date');

    const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));

    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0) continue; // Skip Sundays
        if (holidayDates.has(d.toDateString())) continue;
        count++;
    }
    return count;
};

/**
 * Get attendance summary for employee in a month
 */
const getEmployeeMonthAttendance = async (employeeId, year, month) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await Attendance.find({
        employeeId,
        date: { $gte: start, $lte: end },
    });

    let daysPresent = 0;
    let daysAbsent = 0;
    let halfDays = 0;
    let overtimeMinutes = 0;
    let totalWorkedMinutes = 0;
    let totalLatePenalties = 0;

    records.forEach((r) => {
        if (r.status === 'present' || r.status === 'late') daysPresent++;
        else if (r.status === 'half_day') halfDays++;
        else if (r.status === 'absent') daysAbsent++;
        overtimeMinutes += r.overtimeMinutes || 0;
        totalWorkedMinutes += r.totalWorkedMinutes || 0;
        if (!r.waivedLatePenalty && r.latePenaltyAmount > 0) {
            totalLatePenalties += r.latePenaltyAmount;
        }
    });

    const totalWorkedHours = +(totalWorkedMinutes / 60).toFixed(2);

    // Get approved leaves in this period
    const approvedLeaves = await LeaveRequest.find({
        employeeId, status: 'approved',
        fromDate: { $lte: end },
        toDate: { $gte: start },
    });

    let leaveDays = 0;
    let unpaidLeaveDays = 0;
    approvedLeaves.forEach((l) => {
        // Calculate overlap
        const lFrom = new Date(Math.max(l.fromDate, start));
        const lTo = new Date(Math.min(l.toDate, end));
        const overlapDays = Math.max(0, Math.floor((lTo - lFrom) / (1000 * 60 * 60 * 24)) + 1);
        const actualDays = l.isHalfDay ? Math.min(0.5, overlapDays) : overlapDays;
        leaveDays += actualDays;
        if (l.leaveType === 'unpaid') unpaidLeaveDays += actualDays;
    });

    return {
        daysPresent: daysPresent + halfDays * 0.5,
        daysAbsent,
        leaveDays,
        unpaidLeaveDays,
        overtimeHours: +(overtimeMinutes / 60).toFixed(2),
        totalWorkedHours,
        totalLatePenalties: +totalLatePenalties.toFixed(2),
    };
};

/**
 * POST /api/payroll/process
 * Process monthly payroll — generate payslips for all active employees
 */
export const processPayroll = asyncHandler(async (req, res) => {
    const { periodMonth, periodYear, includeEmployeeIds, overtimeRatePerHour = 0 } = req.body;

    if (!periodMonth || !periodYear) {
        res.status(400); throw new Error('periodMonth and periodYear are required');
    }

    // Check if payroll for this period already exists
    const existing = await Payroll.findOne({ periodMonth, periodYear, deletedAt: null });
    if (existing && existing.status !== 'draft') {
        res.status(400); throw new Error(`Payroll for ${periodMonth}/${periodYear} already ${existing.status}`);
    }

    // Delete old draft if exists
    if (existing) await Payroll.deleteOne({ _id: existing._id });

    // Get active employees
    const filter = { status: { $in: ['active', 'on_leave', 'probation'] } };
    if (includeEmployeeIds?.length) filter._id = { $in: includeEmployeeIds };

    const employees = await Employee.find(filter).populate('salaryStructureId');
    if (employees.length === 0) {
        res.status(400); throw new Error('No active employees found for payroll');
    }

    const workingDays = await countWorkingDays(periodYear, periodMonth);

    const payslips = [];

    for (const emp of employees) {
        const isHourly = emp.salaryStructureId?.frequency === 'hourly' || (!emp.basicSalary && emp.basicWageRate > 0);
        if (!isHourly && (!emp.basicSalary || emp.basicSalary <= 0)) continue;
        if (isHourly && (!emp.basicWageRate || emp.basicWageRate <= 0)) continue;

        const attendance = await getEmployeeMonthAttendance(emp._id, periodYear, periodMonth);
        const isDaily = emp.salaryStructureId?.frequency === 'daily';

        let basic = emp.basicSalary;
        if (isHourly) {
            basic = (emp.basicWageRate || 0) * (attendance.totalWorkedHours || 0);
        } else if (isDaily) {
            // Basic salary is daily rate * days present
            basic = (emp.basicSalary || 0) * (attendance.daysPresent || 0);
        }

        // Build earnings from salary structure
        const structureEarnings = [];
        if (emp.salaryStructureId?.components) {
            emp.salaryStructureId.components
                .filter((c) => c.type === 'earning')
                .forEach((c) => {
                    let amount = 0;
                    if (c.calculationType === 'fixed') {
                        amount = isDaily ? (c.amount || 0) * (attendance.daysPresent || 0) : (c.amount || 0);
                    } else if (c.calculationType === 'percentage_of_basic') {
                        amount = (basic * (c.percentage || 0)) / 100;
                    }
                    structureEarnings.push({
                        name: c.name,
                        amount,
                        type: 'allowance',
                        isTaxable: c.isTaxable !== false,
                        isEpfable: true, // default; can be overridden in structure design
                    });
                });
        }

        // Build deductions from salary structure & salary advances
        const otherDeductions = [];
        if (emp.salaryStructureId?.components) {
            emp.salaryStructureId.components
                .filter((c) => c.type === 'deduction')
                .forEach((c) => {
                    let amount = 0;
                    if (c.calculationType === 'fixed') {
                        amount = c.amount || 0;
                    } else if (c.calculationType === 'percentage_of_basic') {
                        amount = (basic * (c.percentage || 0)) / 100;
                    }
                    otherDeductions.push({
                        name: c.name,
                        amount,
                        type: 'other_deduction',
                    });
                });
        }

        const startOfMonth = new Date(periodYear, periodMonth - 1, 1);
        const endOfMonth = new Date(periodYear, periodMonth, 0, 23, 59, 59);
        const advances = await SalaryAdvance.find({
            employeeId: emp._id,
            status: 'approved',
            isDeducted: false,
            date: { $lte: endOfMonth },
        });

        let totalAdvanceForEmp = 0;
        advances.forEach((adv) => {
            const advAmt = adv.amount || 0;
            totalAdvanceForEmp += advAmt;
            otherDeductions.push({
                name: `Salary Advance (${adv.advanceType === 'percentage' ? adv.requestedPercentage + '%' : 'LKR ' + advAmt})`,
                amount: advAmt,
                type: 'advance',
            });
        });

        if (attendance.totalLatePenalties > 0) {
            otherDeductions.push({
                name: `Shift Late Penalties (Uncovered)`,
                amount: attendance.totalLatePenalties,
                type: 'penalty',
            });
        }

        const calc = calculatePayslip({
            basicSalary: basic,
            earnings: structureEarnings,
            otherDeductions: otherDeductions,
            attendance: {
                workingDays,
                daysPresent: attendance.daysPresent,
                unpaidLeaveDays: isDaily ? 0 : attendance.unpaidLeaveDays, // Daily wage earners don't have double unpaid leave deductions
                overtimeHours: attendance.overtimeHours,
            },
            overtimeRate: overtimeRatePerHour,
        });

        const shareToken = crypto.randomBytes(16).toString('hex');

        payslips.push({
            employeeId: emp._id,
            employeeCode: emp.employeeCode,
            employeeName: emp.fullName,
            workingDays,
            daysPresent: attendance.daysPresent,
            daysAbsent: attendance.daysAbsent,
            leaveDays: attendance.leaveDays,
            unpaidLeaveDays: isDaily ? 0 : attendance.unpaidLeaveDays,
            overtimeHours: attendance.overtimeHours,
            basicSalary: basic, // Store calculated period basic salary
            earnings: calc.earnings,
            grossEarnings: calc.grossEarnings,
            deductions: calc.deductions,
            totalDeductions: calc.totalDeductions,
            epfEmployeeContribution: calc.epfEmployeeContribution,
            epfEmployerContribution: calc.epfEmployerContribution,
            etfContribution: calc.etfContribution,
            apitAmount: calc.apitAmount,
            advanceDeducted: totalAdvanceForEmp,
            netPay: calc.netPay,
            payslipShareToken: shareToken,
            paymentStatus: 'pending',
        });
    }

    const periodStartDate = new Date(periodYear, periodMonth - 1, 1);
    const periodEndDate = new Date(periodYear, periodMonth, 0);

    const payroll = new Payroll({
        periodMonth, periodYear, periodStartDate, periodEndDate,
        payslips,
        status: 'processed',
        processedAt: new Date(),
        processedBy: req.user._id,
        createdBy: req.user._id,
    });
    await payroll.save();

    // Mark deducted advances as deducted in DB
    const processedEmpIds = employees.map(e => e._id);
    await SalaryAdvance.updateMany(
        { employeeId: { $in: processedEmpIds }, status: 'approved', isDeducted: false },
        { $set: { isDeducted: true, deductedPayrollId: payroll._id } }
    );

    res.status(201).json({ success: true, data: payroll });
});

export const getPayrolls = asyncHandler(async (req, res) => {
    if (req.user.role === 'employee') {
        res.status(403);
        throw new Error('Access denied');
    }
    const { year, status, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (year) filter.periodYear = Number(year);
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [list, total] = await Promise.all([
        Payroll.find(filter)
            .select('-payslips') // exclude payslips for list view
            .sort({ periodYear: -1, periodMonth: -1 })
            .skip(skip).limit(Number(limit)),
        Payroll.countDocuments(filter),
    ]);

    res.json({
        success: true, count: list.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: list,
    });
});

export const getPayrollById = asyncHandler(async (req, res) => {
    if (req.user.role === 'employee') {
        res.status(403);
        throw new Error('Access denied');
    }
    const p = await Payroll.findById(req.params.id)
        .populate('processedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName');
    if (!p) { res.status(404); throw new Error('Payroll not found'); }
    res.json({ success: true, data: p });
});

export const approvePayroll = asyncHandler(async (req, res) => {
    const p = await Payroll.findById(req.params.id);
    if (!p) { res.status(404); throw new Error('Payroll not found'); }
    if (p.status !== 'processed') {
        res.status(400); throw new Error(`Cannot approve payroll with status '${p.status}'`);
    }
    p.status = 'approved';
    p.approvedBy = req.user._id;
    p.approvedAt = new Date();
    await p.save();
    res.json({ success: true, data: p });
});

export const markPayrollPaid = asyncHandler(async (req, res) => {
    const p = await Payroll.findById(req.params.id);
    if (!p) { res.status(404); throw new Error('Payroll not found'); }
    if (p.status !== 'approved') {
        res.status(400); throw new Error('Payroll must be approved before marking paid');
    }
    p.status = 'paid';
    p.paidAt = new Date();
    p.payslips.forEach((ps) => {
        ps.paymentStatus = 'paid';
        ps.paidAt = new Date();
    });
    await p.save();
    res.json({ success: true, data: p });
});

export const getEmployeePayslip = asyncHandler(async (req, res) => {
    const { payrollId, employeeId } = req.params;

    if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ userId: req.user._id });
        if (!emp || emp._id.toString() !== employeeId) {
            res.status(403);
            throw new Error('Not authorized to view this payslip');
        }
    }

    const p = await Payroll.findById(payrollId);
    if (!p) { res.status(404); throw new Error('Payroll not found'); }

    const payslip = p.payslips.find((ps) => ps.employeeId.toString() === employeeId);
    if (!payslip) { res.status(404); throw new Error('Payslip not found for this employee'); }

    const employee = await Employee.findById(employeeId).populate('departmentId designationId');

    res.json({
        success: true,
        data: {
            payslip,
            payroll: {
                payrollNumber: p.payrollNumber,
                periodMonth: p.periodMonth,
                periodYear: p.periodYear,
                periodStartDate: p.periodStartDate,
                periodEndDate: p.periodEndDate,
            },
            employee: {
                firstName: employee?.firstName,
                lastName: employee?.lastName,
                employeeCode: employee?.employeeCode,
                department: employee?.departmentId?.name,
                designation: employee?.designationId?.name,
                epfNumber: employee?.epfNumber,
                bankDetails: employee?.bankDetails,
            },
        },
    });
});

/**
 * Preview calculation for a single employee (doesn't save)
 */
export const previewPayslip = asyncHandler(async (req, res) => {
    const { employeeId, periodMonth, periodYear, overtimeRatePerHour = 0 } = req.body;

    const emp = await Employee.findById(employeeId).populate('salaryStructureId');
    if (!emp) { res.status(404); throw new Error('Employee not found'); }

    const workingDays = await countWorkingDays(periodYear, periodMonth);
    const attendance = await getEmployeeMonthAttendance(emp._id, periodYear, periodMonth);

    const structureEarnings = [];
    if (emp.salaryStructureId?.components) {
        emp.salaryStructureId.components
            .filter((c) => c.type === 'earning')
            .forEach((c) => {
                let amount = 0;
                if (c.calculationType === 'fixed') amount = c.amount || 0;
                else if (c.calculationType === 'percentage_of_basic') amount = (emp.basicSalary * (c.percentage || 0)) / 100;
                structureEarnings.push({ name: c.name, amount });
            });
    }

    const calc = calculatePayslip({
        basicSalary: emp.basicSalary,
        earnings: structureEarnings,
        attendance: {
            workingDays,
            daysPresent: attendance.daysPresent,
            unpaidLeaveDays: attendance.unpaidLeaveDays,
            overtimeHours: attendance.overtimeHours,
        },
        overtimeRate: overtimeRatePerHour,
    });

    res.json({
        success: true,
        data: { employee: emp, workingDays, attendance, calculation: calc },
    });
});

export const getMyPayslips = asyncHandler(async (req, res) => {
    const Employee = (await import('../models/Employee.js')).default;
    const Payroll = (await import('../models/Payroll.js')).default;

    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) {
        res.status(404);
        throw new Error('Employee profile not found for this user');
    }

    const payrolls = await Payroll.find({ 'payslips.employeeId': emp._id, status: 'approved' })
        .select('payrollNumber periodMonth periodYear periodStartDate periodEndDate payslips.$');

    const payslips = payrolls.map(p => {
        const ps = p.payslips[0];
        return {
            payrollId: p._id,
            payrollNumber: p.payrollNumber,
            periodMonth: p.periodMonth,
            periodYear: p.periodYear,
            periodStartDate: p.periodStartDate,
            periodEndDate: p.periodEndDate,
            netPay: ps.netPay,
            paymentStatus: ps.paymentStatus,
            paidAt: ps.paidAt,
            _id: ps._id,
            employeeId: emp._id,
        };
    });

    res.json({ success: true, count: payslips.length, data: payslips });
});

/**
 * GET /api/payroll/:id/download-sheet
 * Download professional landscape PDF payroll sheet
 */
export const downloadPayrollSheet = asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
        res.status(404);
        throw new Error('Payroll not found');
    }

    const doc = new PdfPrinter({
        margin: 30,
        size: 'A4',
        layout: 'landscape'
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Payroll_Sheet_${payroll.payrollNumber}.pdf`);
        res.send(pdfData);
    });
    doc.on('error', (err) => {
        console.error('PDF Generation error:', err);
        if (!res.headersSent) {
            res.status(500).send('Could not generate PDF');
        }
    });

    // Branding Header
    doc.rect(0, 0, doc.page.width, 60).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(20).text('GLX INDUSTRIES', 30, 20);
    doc.fontSize(10).text('Payroll Sheet - Professional Report', 30, 45);

    doc.fillColor('#FFFFFF').fontSize(14).text(`PAYROLL NUMBER: ${payroll.payrollNumber}`, 30, 20, { align: 'right' });
    doc.fontSize(8).text(`Period: ${payroll.periodMonth}/${payroll.periodYear}`, 30, 38, { align: 'right' });
    doc.text(`Status: ${payroll.status.toUpperCase()}`, 30, 48, { align: 'right' });

    // Table Data
    const tableData = payroll.payslips.map(ps => ({
        employeeCode: ps.employeeCode || 'EMP',
        employeeName: ps.employeeName || '—',
        presentWorked: `${ps.daysPresent || 0}d / ${ps.overtimeHours || 0}h OT`,
        basicSalary: (ps.basicSalary || 0).toFixed(2),
        grossEarnings: (ps.grossEarnings || 0).toFixed(2),
        epfEmployee: (ps.epfEmployeeContribution || 0).toFixed(2),
        apit: (ps.apitAmount || 0).toFixed(2),
        totalDeductions: (ps.totalDeductions || 0).toFixed(2),
        netPay: (ps.netPay || 0).toFixed(2)
    }));

    const table = {
        title: '',
        headers: [
            { label: 'EMP Code', property: 'employeeCode', width: 65 },
            { label: 'Name', property: 'employeeName', width: 140 },
            { label: 'Present / OT', property: 'presentWorked', width: 85 },
            { label: 'Basic (LKR)', property: 'basicSalary', width: 75 },
            { label: 'Gross (LKR)', property: 'grossEarnings', width: 80 },
            { label: 'EPF (8%)', property: 'epfEmployee', width: 65 },
            { label: 'APIT (LKR)', property: 'apit', width: 65 },
            { label: 'Deductions', property: 'totalDeductions', width: 75 },
            { label: 'Net Pay (LKR)', property: 'netPay', width: 85 }
        ],
        datas: tableData,
        options: {
            padding: 5,
            columnSpacing: 5,
            divider: {
                header: { disabled: false, width: 1.5, opacity: 1 },
                horizontal: { disabled: false, width: 0.5, opacity: 0.1 }
            }
        }
    };

    doc.moveDown(5);

    const totalGross = payroll.totalGrossEarnings || 0;
    const totalDeductions = payroll.totalDeductions || 0;
    const totalEpf = payroll.totalEpfEmployee || 0;
    const totalApit = payroll.totalApit || 0;
    const totalNet = payroll.totalNetPay || 0;

    await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#0F172A'),
        prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#334155'),
    });

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(9).fillColor('#0F172A');
    doc.text(`TOTAL SUMMARY:`, 30);
    doc.fontSize(8).font("Helvetica");
    doc.text(`Total Employees: ${payroll.totalEmployees}  |  Total Gross: LKR ${totalGross.toFixed(2)}  |  Total EPF (8%): LKR ${totalEpf.toFixed(2)}  |  Total APIT: LKR ${totalApit.toFixed(2)}  |  Total Deductions: LKR ${totalDeductions.toFixed(2)}  |  Total Net Pay: LKR ${totalNet.toFixed(2)}`, 30);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor('#94A3B8').text(
            `Page ${i + 1} of ${range.count}  ·  Generated automatically by GLX ERP`,
            0,
            doc.page.height - 20,
            { align: 'center', width: doc.page.width }
        );
    }

    doc.end();
});

/**
 * @desc    Get Daily Wage Payout Summary for a specific date
 * @route   GET /api/payroll/daily-summary
 * @access  Private (hr.payroll.view)
 */
export const getDailyPayrollSummary = asyncHandler(async (req, res) => {
    const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get active daily and hourly workers
    const employees = await Employee.find({
        status: { $in: ['active', 'probation', 'on_leave'] }
    }).populate('salaryStructureId');

    // Filter daily/hourly wage earners or any employee with basicWageRate > 0 or daily frequency
    const dailyWorkers = employees.filter((emp) => {
        const isDailyFreq = emp.salaryStructureId?.frequency === 'daily';
        const isHourlyFreq = emp.salaryStructureId?.frequency === 'hourly';
        const hasHourlyRate = (emp.basicWageRate || 0) > 0;
        const hasDailyRate = (emp.basicSalary || 0) > 0 && isDailyFreq;
        return isDailyFreq || isHourlyFreq || hasHourlyRate || hasDailyRate;
    });

    // Get attendance for target date
    const attendanceRecords = await Attendance.find({
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    const attendanceMap = new Map();
    attendanceRecords.forEach((a) => attendanceMap.set(a.employeeId.toString(), a));

    // Get existing daily wage payments for target date
    const existingPayments = await DailyWagePayment.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        deletedAt: null
    });

    const paymentMap = new Map();
    existingPayments.forEach((p) => paymentMap.set(p.employeeId.toString(), p));

    const workerSummaries = dailyWorkers.map((emp) => {
        const att = attendanceMap.get(emp._id.toString());
        const existingPay = paymentMap.get(emp._id.toString());

        const isHourly = emp.salaryStructureId?.frequency === 'hourly' || (!emp.basicSalary && (emp.basicWageRate || 0) > 0);
        const rate = isHourly ? (emp.basicWageRate || 0) : (emp.basicSalary || 0);

        let units = 0;
        let attStatus = 'absent';
        let workedHours = 0;
        let otHours = 0;

        if (att) {
            attStatus = att.status || 'absent';
            workedHours = att.totalWorkedHours || 0;
            otHours = +( (att.overtimeMinutes || 0) / 60 ).toFixed(2);
            if (isHourly) {
                units = workedHours;
            } else {
                units = attStatus === 'present' || attStatus === 'late' ? 1.0 : (attStatus === 'half_day' ? 0.5 : 0);
            }
        }

        const baseWage = +(rate * units).toFixed(2);

        return {
            employeeId: emp._id,
            employeeCode: emp.employeeCode,
            employeeName: emp.fullName,
            designation: emp.designationId?.name || emp.jobTitle || 'Daily Worker',
            payType: isHourly ? 'hourly' : 'daily',
            rate,
            attendanceStatus: attStatus,
            units,
            workedHours,
            overtimeHours: otHours,
            baseWage,
            alreadyPaid: !!existingPay,
            paymentDetails: existingPay || null
        };
    });

    // Also get active projects and bank accounts for payout modal options
    const activeProjects = await Project.find({ status: { $in: ['active', 'in_progress'] } }).select('projectNumber name yard');
    const bankAccounts = await BankAccount.find({ isActive: true }).select('bankName accountNumber balance');

    res.json({
        success: true,
        date: targetDateStr,
        workers: workerSummaries,
        activeProjects,
        bankAccounts
    });
});

/**
 * @desc    Process & Pay Daily Wages for selected workers
 * @route   POST /api/payroll/daily-payout
 * @access  Private (hr.payroll.manage)
 */
export const processDailyPayout = asyncHandler(async (req, res) => {
    const { date, payouts = [] } = req.body;

    if (!payouts.length) {
        res.status(400);
        throw new Error('No employee payouts provided');
    }

    const payoutDate = date ? new Date(date) : new Date();
    const createdPayments = [];

    for (const item of payouts) {
        const {
            employeeId, employeeCode, employeeName, payType,
            rate, units, overtimeHours = 0, overtimeAmount = 0,
            allowances = 0, deductions = 0, netPaid,
            paymentMethod = 'cash', bankAccountId, projectId, notes
        } = item;

        if (!netPaid || netPaid <= 0) continue;

        // Save DailyWagePayment record
        const paymentRecord = new DailyWagePayment({
            date: payoutDate,
            employeeId,
            employeeCode,
            employeeName,
            payType,
            rate,
            units,
            overtimeHours,
            overtimeAmount,
            allowances,
            deductions,
            netPaid,
            paymentMethod,
            bankAccountId: bankAccountId || undefined,
            projectId: projectId || undefined,
            status: 'paid',
            notes: notes || `Daily wage payout for ${employeeName}`,
            createdBy: req.user._id
        });
        await paymentRecord.save();
        createdPayments.push(paymentRecord);

        // Record Expense under "Salaries & Wages" category
        const expense = new Expense({
            title: `Daily Wage Payout: ${employeeName} (${paymentRecord.voucherNumber})`,
            category: 'Salaries & Wages',
            amount: netPaid,
            paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'Bank Transfer',
            bankAccountId: bankAccountId || undefined,
            paymentStatus: 'Paid',
            date: payoutDate,
            notes: `Daily Wage Payout for ${employeeName} (${units} ${payType === 'hourly' ? 'hrs' : 'days'})`,
            projectId: projectId || undefined,
            createdBy: req.user._id
        });
        await expense.save();

        // Update Bank Balance if non-cash
        if (bankAccountId && paymentMethod !== 'cash') {
            const acc = await BankAccount.findById(bankAccountId);
            if (acc) {
                acc.balance = +(acc.balance - netPaid).toFixed(2);
                await acc.save();
            }
        }

        // If assigned to a project, add to project labor cost
        if (projectId) {
            const project = await Project.findById(projectId);
            if (project) {
                project.laborCost = +( (project.laborCost || 0) + netPaid ).toFixed(2);
                await project.save();
                await recalculateProjectFinancials(projectId);
            }
        }
    }

    res.status(201).json({
        success: true,
        message: `Successfully processed daily wage payouts for ${createdPayments.length} worker(s)`,
        data: createdPayments
    });
});

/**
 * @desc    Get Daily Wage Payout History
 * @route   GET /api/payroll/daily-history
 * @access  Private (hr.payroll.view)
 */
export const getDailyPayrollHistory = asyncHandler(async (req, res) => {
    const { startDate, endDate, search, limit = 100 } = req.query;

    const filter = { deletedAt: null };
    if (startDate && endDate) {
        filter.date = {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        };
    }

    if (search) {
        filter.$or = [
            { employeeName: new RegExp(search, 'i') },
            { employeeCode: new RegExp(search, 'i') },
            { voucherNumber: new RegExp(search, 'i') }
        ];
    }

    const history = await DailyWagePayment.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .limit(Number(limit))
        .populate('projectId', 'projectNumber name')
        .populate('bankAccountId', 'bankName accountNumber');

    const totalPaid = history.reduce((sum, h) => sum + (h.netPaid || 0), 0);

    res.json({
        success: true,
        totalPaid,
        count: history.length,
        data: history
    });
});

/**
 * @desc    Get public shareable payslip by share token
 * @route   GET /api/payroll/payslips/share/:token
 * @access  Public
 */
export const getPublicPayslipByToken = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const payroll = await Payroll.findOne(
        { 'payslips.payslipShareToken': token, deletedAt: null },
        { 'payslips.$': 1, periodMonth: 1, periodYear: 1, payrollNumber: 1, createdAt: 1 }
    ).populate('payslips.employeeId', 'firstName lastName employeeCode departmentId designationId phone secondaryPhone email bankDetails gsCertificate policeReport educationCertificates paymentType labourRate');

    if (!payroll || !payroll.payslips || payroll.payslips.length === 0) {
        res.status(404);
        throw new Error('Payslip link invalid or expired');
    }

    const payslip = payroll.payslips[0];
    res.json({
        success: true,
        data: {
            payrollNumber: payroll.payrollNumber,
            periodMonth: payroll.periodMonth,
            periodYear: payroll.periodYear,
            payslip,
        }
    });
});

/**
 * @desc    Get Bi-Monthly / Period Payroll Summary (e.g. 1st-15th or 16th-end)
 * @route   GET /api/payroll/period-summary
 * @access  Private (hr.payroll.view)
 */
export const getPeriodPayrollSummary = asyncHandler(async (req, res) => {
    let { startDate, endDate } = req.query;

    const earliestAtt = await Attendance.findOne().sort({ date: 1 });
    const latestAtt = await Attendance.findOne().sort({ date: -1 });

    const minDateStr = earliestAtt?.date ? new Date(earliestAtt.date).toISOString().split('T')[0] : '2024-01-01';
    const maxDateStr = latestAtt?.date ? new Date(latestAtt.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    if (!startDate) {
        startDate = minDateStr;
    }
    if (!endDate) {
        endDate = maxDateStr;
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const employees = await Employee.find({ status: { $in: ['active', 'on_leave', 'probation'] } })
        .populate('departmentId', 'name')
        .sort({ firstName: 1 });

    const periodData = [];

    for (const emp of employees) {
        const attendance = await Attendance.find({
            employeeId: emp._id,
            date: { $gte: start, $lte: end }
        });

        let daysPresent = 0;
        let totalWorkedMinutes = 0;
        let overtimeMinutes = 0;
        let totalEarnedSalary = 0;

        const hourlyRate = emp.hourlyRate || emp.basicWageRate || (emp.basicSalary ? emp.basicSalary / 200 : 250);

        attendance.forEach(att => {
            if (['present', 'late', 'half_day'].includes(att.status)) {
                daysPresent += att.status === 'half_day' ? 0.5 : 1;
            }
            totalWorkedMinutes += att.totalWorkedMinutes || 0;
            overtimeMinutes += att.overtimeMinutes || 0;

            if (att.earnedSalary && att.earnedSalary > 0) {
                totalEarnedSalary += att.earnedSalary;
            } else if (att.totalWorkedMinutes > 0) {
                totalEarnedSalary += (att.totalWorkedMinutes / 60) * hourlyRate;
            }
        });

        // Fetch pending salary advances for this employee up to end date
        const advances = await SalaryAdvance.find({
            employeeId: emp._id,
            status: 'approved',
            isDeducted: false,
            date: { $lte: end }
        });

        const totalAdvanceDeduction = advances.reduce((sum, adv) => sum + (adv.amount || 0), 0);
        const workedHours = +(totalWorkedMinutes / 60).toFixed(2);
        const grossWage = +totalEarnedSalary.toFixed(2);
        const netPayable = Math.max(0, +(grossWage - totalAdvanceDeduction).toFixed(2));

        if (workedHours > 0 || grossWage > 0 || totalAdvanceDeduction > 0) {
            periodData.push({
                employeeId: emp._id,
                employeeCode: emp.employeeCode,
                employeeName: emp.fullName || `${emp.firstName} ${emp.lastName}`,
                department: emp.departmentId?.name || '',
                daysPresent,
                workedHours,
                overtimeHours: +(overtimeMinutes / 60).toFixed(2),
                hourlyRate,
                grossWage,
                advancesCount: advances.length,
                totalAdvanceDeduction: +totalAdvanceDeduction.toFixed(2),
                netPayable,
                advanceIds: advances.map(a => a._id)
            });
        }
    }

    const { default: BankAccount } = await import('../models/BankAccount.js');
    const bankAccounts = await BankAccount.find({ isActive: true });

    res.json({
        success: true,
        startDate,
        endDate,
        systemAttendanceRange: { minDate: minDateStr, maxDate: maxDateStr },
        count: periodData.length,
        summary: {
            totalGrossWage: periodData.reduce((s, p) => s + p.grossWage, 0),
            totalAdvancesDeducted: periodData.reduce((s, p) => s + p.totalAdvanceDeduction, 0),
            totalNetPayable: periodData.reduce((s, p) => s + p.netPayable, 0)
        },
        bankAccounts,
        data: periodData
    });
});