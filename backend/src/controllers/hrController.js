import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import Employee from '../models/Employee.js';
import Shift from '../models/Shift.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Holiday from '../models/Holiday.js';
import SalaryStructure from '../models/SalaryStructure.js';
import LeaveStructure from '../models/LeaveStructure.js';
import AttendancePolicy from '../models/AttendancePolicy.js';
import SalaryAdvance from '../models/SalaryAdvance.js';

// ============================================================
// DEPARTMENTS
// ============================================================

export const createDepartment = asyncHandler(async (req, res) => {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, data: dept });
});

export const getDepartments = asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }

    const depts = await Department.find(filter)
        .populate('managerId', 'firstName lastName employeeCode')
        .populate('parentDepartmentId', 'name code')
        .sort({ name: 1 });

    res.json({ success: true, count: depts.length, data: depts });
});

export const updateDepartment = asyncHandler(async (req, res) => {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) { res.status(404); throw new Error('Department not found'); }
    res.json({ success: true, data: dept });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) { res.status(404); throw new Error('Department not found'); }
    dept.deletedAt = new Date();
    dept.isActive = false;
    await dept.save();
    res.json({ success: true });
});

// ============================================================
// DESIGNATIONS
// ============================================================

export const createDesignation = asyncHandler(async (req, res) => {
    const des = await Designation.create(req.body);
    res.status(201).json({ success: true, data: des });
});

export const getDesignations = asyncHandler(async (req, res) => {
    const { departmentId, isActive } = req.query;
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }

    const list = await Designation.find(filter)
        .populate('departmentId', 'name code')
        .sort({ level: 1, name: 1 });

    res.json({ success: true, count: list.length, data: list });
});

export const updateDesignation = asyncHandler(async (req, res) => {
    const d = await Designation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!d) { res.status(404); throw new Error('Designation not found'); }
    res.json({ success: true, data: d });
});

export const deleteDesignation = asyncHandler(async (req, res) => {
    const d = await Designation.findById(req.params.id);
    if (!d) { res.status(404); throw new Error('Designation not found'); }
    d.deletedAt = new Date(); d.isActive = false; await d.save();
    res.json({ success: true });
});

// ============================================================
// EMPLOYEES
// ============================================================

export const createEmployee = asyncHandler(async (req, res) => {
    let linkedUserId = req.body.userId || null;

    if (req.body.createLogin) {
        const loginEmail = (req.body.loginEmail || req.body.email || '').trim().toLowerCase();
        const loginPassword = req.body.loginPassword;
        const loginRole = req.body.loginRole || 'employee';

        if (!loginEmail) {
            res.status(400);
            throw new Error('Email is required to create a user login.');
        }
        if (!loginPassword || loginPassword.length < 6) {
            res.status(400);
            throw new Error('Password must be at least 6 characters for user login.');
        }

        const existingUser = await User.findOne({ email: loginEmail });
        if (existingUser) {
            res.status(400);
            throw new Error(`A user account with email "${loginEmail}" already exists in the system.`);
        }

        const newUser = await User.create({
            firstName: req.body.firstName || '',
            lastName: req.body.lastName || '',
            email: loginEmail,
            phone: req.body.phone || req.body.mobile || '',
            password: loginPassword,
            role: loginRole,
            createdBy: req.user._id,
        });

        linkedUserId = newUser._id;
    }

    if (req.body.leaveStructureId) {
        const ls = await LeaveStructure.findById(req.body.leaveStructureId);
        if (ls) req.body.leaveBalances = ls.leaveBalances;
    }

    const emp = new Employee({
        ...req.body,
        userId: linkedUserId,
        createdBy: req.user._id,
    });
    await emp.save();

    const populated = await Employee.findById(emp._id)
        .populate('departmentId', 'name code')
        .populate('designationId', 'name code')
        .populate('reportsToId', 'firstName lastName employeeCode')
        .populate('leaveStructureId', 'name code leaveBalances')
        .populate('userId', 'email role isActive');

    res.status(201).json({ success: true, data: populated });
});

export const getEmployees = asyncHandler(async (req, res) => {
    const {
        search, departmentId, designationId, status, employmentType,
        page = 1, limit = 20,
        sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    // Auto-sync any existing active User accounts that do not have an Employee record
    try {
        const users = await User.find({ deletedAt: null, isActive: true });
        const existingEmpUserIds = (await Employee.find().select('userId')).map(e => e.userId?.toString()).filter(Boolean);
        for (const u of users) {
            if (!existingEmpUserIds.includes(u._id.toString())) {
                await Employee.create({
                    userId: u._id,
                    firstName: u.firstName || 'User',
                    lastName: u.lastName || '',
                    email: u.email,
                    phone: u.phone,
                    status: 'active',
                    basicSalary: 50000,
                    epfRate: 8,
                    etfRate: 3,
                    createdBy: u.createdBy || u._id,
                    dateOfJoining: u.createdAt || new Date(),
                }).catch(() => {});
            }
        }
    } catch (syncErr) {
        console.error('Error auto-syncing users to employees:', syncErr);
    }

    const filter = {};
    if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ userId: req.user._id });
        if (!emp) {
            res.status(404);
            throw new Error('Employee profile not found');
        }
        filter._id = emp._id;
    } else {
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { employeeCode: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        if (departmentId) filter.departmentId = departmentId;
        if (designationId) filter.designationId = designationId;
        if (status) filter.status = status;
        if (employmentType) filter.employmentType = employmentType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [employees, total] = await Promise.all([
        Employee.find(filter)
            .populate('departmentId', 'name code')
            .populate('designationId', 'name code')
            .populate('reportsToId', 'firstName lastName employeeCode')
            .populate('userId', 'email role isActive')
            .sort(sortObj).skip(skip).limit(Number(limit)),
        Employee.countDocuments(filter),
    ]);

    res.json({
        success: true, count: employees.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: employees,
    });
});

export const getEmployeeById = asyncHandler(async (req, res) => {
    const emp = await Employee.findById(req.params.id)
        .populate('departmentId', 'name code')
        .populate('designationId', 'name code')
        .populate('reportsToId', 'firstName lastName employeeCode')
        .populate('userId', 'email role isActive')
        .populate('workShift', 'name startTime endTime')
        .populate('salaryStructureId', 'name code components')
        .populate('leaveStructureId', 'name code leaveBalances');
    if (!emp) { res.status(404); throw new Error('Employee not found'); }

    if (req.user.role === 'employee' && emp.userId?._id?.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this employee profile');
    }

    res.json({ success: true, data: emp });
});

export const updateEmployee = asyncHandler(async (req, res) => {
    const existingEmp = await Employee.findById(req.params.id);
    if (!existingEmp) {
        res.status(404);
        throw new Error('Employee not found');
    }

    let linkedUserId = existingEmp.userId;

    if (req.body.createLogin && !linkedUserId) {
        const loginEmail = (req.body.loginEmail || req.body.email || existingEmp.email || '').trim().toLowerCase();
        const loginPassword = req.body.loginPassword;
        const loginRole = req.body.loginRole || 'employee';

        if (!loginEmail) {
            res.status(400);
            throw new Error('Email is required to create a user login.');
        }
        if (!loginPassword || loginPassword.length < 6) {
            res.status(400);
            throw new Error('Password must be at least 6 characters for user login.');
        }

        const existingUser = await User.findOne({ email: loginEmail });
        if (existingUser) {
            res.status(400);
            throw new Error(`A user account with email "${loginEmail}" already exists in the system.`);
        }

        const newUser = await User.create({
            firstName: req.body.firstName || existingEmp.firstName || '',
            lastName: req.body.lastName || existingEmp.lastName || '',
            email: loginEmail,
            phone: req.body.phone || req.body.mobile || existingEmp.phone || '',
            password: loginPassword,
            role: loginRole,
            createdBy: req.user._id,
        });

        linkedUserId = newUser._id;
    }

    if (req.body.leaveStructureId) {
        const ls = await LeaveStructure.findById(req.body.leaveStructureId);
        if (ls) req.body.leaveBalances = ls.leaveBalances;
    }

    const emp = await Employee.findByIdAndUpdate(
        req.params.id,
        { ...req.body, userId: linkedUserId, updatedBy: req.user._id },
        { new: true, runValidators: true }
    )
    .populate('departmentId', 'name code')
    .populate('designationId', 'name code')
    .populate('userId', 'email role isActive');

    res.json({ success: true, data: emp });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    if (!emp) { res.status(404); throw new Error('Employee not found'); }
    emp.deletedAt = new Date();
    emp.status = 'terminated';
    await emp.save();
    res.json({ success: true, message: 'Employee terminated successfully' });
});

export const createShift = asyncHandler(async (req, res) => {
    const shift = await Shift.create(req.body);
    res.status(201).json({ success: true, data: shift });
});

export const getShifts = asyncHandler(async (req, res) => {
    const shifts = await Shift.find().sort({ startTime: 1 });
    res.json({ success: true, count: shifts.length, data: shifts });
});

export const updateShift = asyncHandler(async (req, res) => {
    const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!shift) { res.status(404); throw new Error('Shift not found'); }
    res.json({ success: true, data: shift });
});

export const deleteShift = asyncHandler(async (req, res) => {
    const shift = await Shift.findById(req.params.id);
    if (!shift) { res.status(404); throw new Error('Shift not found'); }
    shift.deletedAt = new Date(); shift.isActive = false; await shift.save();
    res.json({ success: true });
});

// ============================================================
// ATTENDANCE
// ============================================================

/**
 * Mark attendance for one employee (manual entry)
 */
export const markAttendance = asyncHandler(async (req, res) => {
    const {
        employeeId, date, checkInTime, checkOutTime,
        status, shiftId, notes, lateMinutes, overtimeMinutes,
    } = req.body;

    const emp = await Employee.findById(employeeId);
    if (!emp) { res.status(404); throw new Error('Employee not found'); }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Try to find existing record
    let att = await Attendance.findOne({ employeeId, date: attendanceDate });

    if (att) {
        // Update
        if (checkInTime !== undefined) {
            const checkIn = (checkInTime && checkInTime !== "") ? new Date(checkInTime) : null;
            att.checkInTime = (checkIn && !isNaN(checkIn.getTime())) ? checkIn : null;
        }
        if (checkOutTime !== undefined) {
            const checkOut = (checkOutTime && checkOutTime !== "") ? new Date(checkOutTime) : null;
            att.checkOutTime = (checkOut && !isNaN(checkOut.getTime())) ? checkOut : null;
        }
        if (status) att.status = status;
        if (shiftId) att.shiftId = shiftId;
        if (notes !== undefined) att.notes = notes;
        if (lateMinutes !== undefined) att.lateMinutes = lateMinutes;
        if (overtimeMinutes !== undefined) att.overtimeMinutes = overtimeMinutes;
    } else {
        const checkIn = (checkInTime && checkInTime !== "") ? new Date(checkInTime) : null;
        const checkOut = (checkOutTime && checkOutTime !== "") ? new Date(checkOutTime) : null;
        att = new Attendance({
            employeeId: emp._id,
            employeeCode: emp.employeeCode,
            employeeName: emp.fullName,
            date: attendanceDate,
            checkInTime: (checkIn && !isNaN(checkIn.getTime())) ? checkIn : null,
            checkOutTime: (checkOut && !isNaN(checkOut.getTime())) ? checkOut : null,
            status: status || 'present',
            shiftId,
            lateMinutes: lateMinutes || 0,
            overtimeMinutes: overtimeMinutes || 0,
            notes,
            markedBy: req.user._id,
        });
    }

    // Calculate worked minutes, earned salary, and late penalty with work-back waiver
    if (att.checkInTime && att.checkOutTime) {
        const diff = (new Date(att.checkOutTime) - new Date(att.checkInTime)) / 60000;
        att.totalWorkedMinutes = Math.max(0, Math.floor(diff));
        const rate = emp.hourlyRate || emp.basicWageRate || 260;
        att.earnedSalary = Number(((att.totalWorkedMinutes / 60) * rate).toFixed(2));

        // Shift start timestamp (default 08:00 AM)
        const shiftStart = new Date(att.date);
        shiftStart.setHours(8, 0, 0, 0);
        const expectedShiftMins = 480; // 8 hours

        const checkInMs = new Date(att.checkInTime).getTime();
        const shiftStartMs = shiftStart.getTime();
        let lateMins = 0;
        if (checkInMs > shiftStartMs) {
            lateMins = Math.floor((checkInMs - shiftStartMs) / 60000);
        }
        att.lateMinutes = lateMins;

        let initialPenaltyHours = 0;
        if (lateMins > 5 && lateMins <= 30) {
            initialPenaltyHours = 0.5;
        } else if (lateMins > 30) {
            initialPenaltyHours = 1.0;
        }

        if (initialPenaltyHours > 0) {
            if (att.totalWorkedMinutes >= expectedShiftMins) {
                // Shift duration fully covered -> waive late penalty!
                att.waivedLatePenalty = true;
                att.latePenaltyHours = 0;
                att.latePenaltyAmount = 0;
                att.latePenaltyReason = `Waived: Late ${lateMins}m covered by full shift`;
            } else {
                att.waivedLatePenalty = false;
                att.latePenaltyHours = initialPenaltyHours;
                att.latePenaltyAmount = Number((initialPenaltyHours * rate).toFixed(2));
                att.latePenaltyReason = `Late ${lateMins}m (${initialPenaltyHours}h salary cut)`;
            }
        } else {
            att.waivedLatePenalty = false;
            att.latePenaltyHours = 0;
            att.latePenaltyAmount = 0;
            att.latePenaltyReason = 'On Time';
        }
    } else {
        att.totalWorkedMinutes = 0;
        att.overtimeMinutes = 0;
        att.earnedSalary = 0;
        att.latePenaltyHours = 0;
        att.latePenaltyAmount = 0;
        att.waivedLatePenalty = false;
    }

    await att.save();
    res.status(201).json({ success: true, data: att });
});

export const getAttendance = asyncHandler(async (req, res) => {
    const {
        employeeId, departmentId, status,
        startDate, endDate, date,
        page = 1, limit = 50,
    } = req.query;

    const filter = {};
    if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ userId: req.user._id });
        if (!emp) {
            res.status(404);
            throw new Error('Employee profile not found');
        }
        filter.employeeId = emp._id;
    } else {
        if (employeeId) filter.employeeId = employeeId;
        if (status) filter.status = status;
    }
    if (date) {
        const d = new Date(date); d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        filter.date = { $gte: d, $lt: next };
    } else if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Department filter or active employee filter
    if (departmentId && req.user.role !== 'employee') {
        const empIds = await Employee.find({ departmentId, status: { $ne: 'terminated' } }).distinct('_id');
        filter.employeeId = { $in: empIds };
    } else if (!filter.employeeId && req.user.role !== 'employee') {
        const activeEmpIds = await Employee.find({ status: { $ne: 'terminated' } }).distinct('_id');
        filter.employeeId = { $in: activeEmpIds };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
        Attendance.find(filter)
            .populate('employeeId', 'firstName lastName employeeCode departmentId hourlyRate basicWageRate')
            .populate('shiftId', 'name startTime endTime')
            .sort({ date: -1 })
            .skip(skip).limit(Number(limit)),
        Attendance.countDocuments(filter),
    ]);

    res.json({
        success: true, count: records.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: records,
    });
});

/**
 * Bulk mark attendance for a day (for supervisors marking the whole team)
 */
export const bulkMarkAttendance = asyncHandler(async (req, res) => {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
        res.status(400); throw new Error('date and records array required');
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const results = [];
    for (const r of records) {
        if (!r.employeeId) continue;
        const emp = await Employee.findById(r.employeeId);
        if (!emp) continue;

        let att = await Attendance.findOne({ employeeId: r.employeeId, date: attendanceDate });
        if (!att) {
            att = new Attendance({
                employeeId: emp._id,
                employeeCode: emp.employeeCode,
                employeeName: emp.fullName,
                date: attendanceDate,
                markedBy: req.user._id,
            });
        }
        att.status = r.status || 'present';
        const checkIn = (r.checkInTime && r.checkInTime !== "") ? new Date(r.checkInTime) : null;
        const checkOut = (r.checkOutTime && r.checkOutTime !== "") ? new Date(r.checkOutTime) : null;
        att.checkInTime = (checkIn && !isNaN(checkIn.getTime())) ? checkIn : null;
        att.checkOutTime = (checkOut && !isNaN(checkOut.getTime())) ? checkOut : null;
        att.lateMinutes = r.lateMinutes || 0;
        att.overtimeMinutes = r.overtimeMinutes || 0;
        att.notes = r.notes;

        if (att.checkInTime && att.checkOutTime) {
            const diff = (new Date(att.checkOutTime) - new Date(att.checkInTime)) / 60000;
            att.totalWorkedMinutes = Math.max(0, Math.floor(diff));
            const rate = emp.hourlyRate || emp.basicWageRate || 260;
            att.earnedSalary = Number(((att.totalWorkedMinutes / 60) * rate).toFixed(2));
        } else {
            att.totalWorkedMinutes = 0;
            att.overtimeMinutes = 0;
            att.earnedSalary = 0;
        }
        await att.save();
        results.push(att);
    }

    res.json({ success: true, count: results.length, data: results });
});

// ============================================================
// LEAVE REQUESTS
// ============================================================

export const createLeaveRequest = asyncHandler(async (req, res) => {
    const { employeeId, leaveType, fromDate, toDate, ...rest } = req.body;

    let targetEmployeeId = employeeId;
    if (req.user.role === 'employee') {
        const empSelf = await Employee.findOne({ userId: req.user._id });
        if (!empSelf) {
            res.status(404);
            throw new Error('Employee profile not found');
        }
        targetEmployeeId = empSelf._id;
    }

    const emp = await Employee.findById(targetEmployeeId);
    if (!emp) { res.status(404); throw new Error('Employee not found'); }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const days = rest.isHalfDay ? 0.5 : (Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1);

    // Check balance (warn but don't block — admin can override)
    const balance = emp.leaveBalances?.[leaveType] || 0;

    const leave = new LeaveRequest({
        employeeId: emp._id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        leaveType, fromDate: from, toDate: to, numberOfDays: days,
        ...rest,
        status: req.user.role === 'employee' ? 'pending' : (rest.status || 'pending'),
        createdBy: req.user._id,
    });
    await leave.save();

    res.status(201).json({
        success: true, data: leave,
        warning: days > balance ? `Requested ${days} days exceeds balance of ${balance}` : undefined,
    });
});

export const getLeaveRequests = asyncHandler(async (req, res) => {
    const {
        employeeId, status, leaveType,
        startDate, endDate,
        page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ userId: req.user._id });
        if (!emp) {
            res.status(404);
            throw new Error('Employee profile not found');
        }
        filter.employeeId = emp._id;
    } else {
        if (employeeId) filter.employeeId = employeeId;
    }
    if (status) filter.status = status;
    if (leaveType) filter.leaveType = leaveType;
    if (req.query.isUninformed !== undefined) filter.isUninformed = req.query.isUninformed === 'true';
    if (startDate || endDate) {
        filter.fromDate = {};
        if (startDate) filter.fromDate.$gte = new Date(startDate);
        if (endDate) filter.fromDate.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [leaves, total] = await Promise.all([
        LeaveRequest.find(filter)
            .populate('employeeId', 'firstName lastName employeeCode departmentId leaveBalances')
            .populate('approvedBy', 'firstName lastName')
            .sort({ fromDate: -1 }).skip(skip).limit(Number(limit)),
        LeaveRequest.countDocuments(filter),
    ]);

    res.json({
        success: true, count: leaves.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: leaves,
    });
});

export const approveLeaveRequest = asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) { res.status(404); throw new Error('Leave not found'); }
    if (leave.status !== 'pending') {
        res.status(400); throw new Error(`Cannot approve leave with status '${leave.status}'`);
    }

    leave.status = 'approved';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    await leave.save();

    // Deduct from employee balance
    const emp = await Employee.findById(leave.employeeId);
    if (emp) {
        emp.leaveBalances = emp.leaveBalances || {};
        const current = emp.leaveBalances[leave.leaveType] || 0;
        emp.leaveBalances[leave.leaveType] = Math.max(0, current - leave.numberOfDays);
        await emp.save();
    }

    res.json({ success: true, data: leave });
});

export const rejectLeaveRequest = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) { res.status(404); throw new Error('Leave not found'); }
    if (leave.status !== 'pending') {
        res.status(400); throw new Error(`Cannot reject leave with status '${leave.status}'`);
    }
    leave.status = 'rejected';
    leave.rejectedBy = req.user._id;
    leave.rejectedAt = new Date();
    leave.rejectionReason = reason;
    await leave.save();
    res.json({ success: true, data: leave });
});

export const cancelLeaveRequest = asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) { res.status(404); throw new Error('Leave not found'); }

    const wasApproved = leave.status === 'approved';
    leave.status = 'cancelled';
    await leave.save();

    // Restore balance if was approved
    if (wasApproved) {
        const emp = await Employee.findById(leave.employeeId);
        if (emp) {
            emp.leaveBalances = emp.leaveBalances || {};
            const current = emp.leaveBalances[leave.leaveType] || 0;
            emp.leaveBalances[leave.leaveType] = current + leave.numberOfDays;
            await emp.save();
        }
    }

    res.json({ success: true, data: leave });
});

// ============================================================
// HOLIDAYS
// ============================================================

export const createHoliday = asyncHandler(async (req, res) => {
    const h = await Holiday.create(req.body);
    res.status(201).json({ success: true, data: h });
});

export const getHolidays = asyncHandler(async (req, res) => {
    const { year, type } = req.query;
    const filter = {};
    if (year) {
        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year}-12-31`);
        filter.date = { $gte: start, $lte: end };
    }
    if (type) filter.type = type;

    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json({ success: true, count: holidays.length, data: holidays });
});

export const updateHoliday = asyncHandler(async (req, res) => {
    const h = await Holiday.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!h) { res.status(404); throw new Error('Holiday not found'); }
    res.json({ success: true, data: h });
});

export const deleteHoliday = asyncHandler(async (req, res) => {
    const h = await Holiday.findById(req.params.id);
    if (!h) { res.status(404); throw new Error('Holiday not found'); }
    h.deletedAt = new Date(); h.isActive = false; await h.save();
    res.json({ success: true });
});

// ============================================================
// SALARY STRUCTURES
// ============================================================

export const createSalaryStructure = asyncHandler(async (req, res) => {
    const s = await SalaryStructure.create(req.body);
    res.status(201).json({ success: true, data: s });
});

export const getSalaryStructures = asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }
    const list = await SalaryStructure.find(filter).sort({ name: 1 });
    res.json({ success: true, count: list.length, data: list });
});

export const updateSalaryStructure = asyncHandler(async (req, res) => {
    const s = await SalaryStructure.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) { res.status(404); throw new Error('Salary structure not found'); }
    res.json({ success: true, data: s });
});

export const deleteSalaryStructure = asyncHandler(async (req, res) => {
    const s = await SalaryStructure.findById(req.params.id);
    if (!s) { res.status(404); throw new Error('Salary structure not found'); }
    s.deletedAt = new Date(); s.isActive = false; await s.save();
    res.json({ success: true });
});

// ============================================================
// LEAVE STRUCTURES & PROFILE SELF-SERVICE
// ============================================================

export const createLeaveStructure = asyncHandler(async (req, res) => {
    const s = await LeaveStructure.create(req.body);
    res.status(201).json({ success: true, data: s });
});

export const getLeaveStructures = asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
        filter.isActive = isActive === 'true' || isActive === true;
    }
    const list = await LeaveStructure.find(filter).sort({ name: 1 });
    res.json({ success: true, count: list.length, data: list });
});

export const updateLeaveStructure = asyncHandler(async (req, res) => {
    const s = await LeaveStructure.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) { res.status(404); throw new Error('Leave structure not found'); }
    res.json({ success: true, data: s });
});

export const deleteLeaveStructure = asyncHandler(async (req, res) => {
    const s = await LeaveStructure.findById(req.params.id);
    if (!s) { res.status(404); throw new Error('Leave structure not found'); }
    s.deletedAt = new Date(); s.isActive = false; await s.save();
    res.json({ success: true });
});

export const getMyEmployeeProfile = asyncHandler(async (req, res) => {
    const emp = await Employee.findOne({ userId: req.user._id })
        .populate('departmentId', 'name code')
        .populate('designationId', 'name code')
        .populate('workShift', 'name startTime endTime')
        .populate('salaryStructureId', 'name code components')
        .populate('leaveStructureId', 'name code leaveBalances');
    if (!emp) {
        res.status(404);
        throw new Error('Employee profile not found for this user');
    }
    res.json({ success: true, data: emp });
});

// ============================================================
// ATTENDANCE & LEAVE POLICIES
// ============================================================

export const createAttendancePolicy = asyncHandler(async (req, res) => {
    const policy = new AttendancePolicy({
        ...req.body,
        createdBy: req.user._id,
    });
    await policy.save();
    res.status(201).json({ success: true, data: policy });
});

export const getAttendancePolicies = asyncHandler(async (req, res) => {
    const policies = await AttendancePolicy.find()
        .populate('assignedEmployees', 'firstName lastName employeeCode')
        .sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, count: policies.length, data: policies });
});

export const updateAttendancePolicy = asyncHandler(async (req, res) => {
    const policy = await AttendancePolicy.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!policy) { res.status(404); throw new Error('Attendance policy not found'); }
    res.json({ success: true, data: policy });
});

export const deleteAttendancePolicy = asyncHandler(async (req, res) => {
    const policy = await AttendancePolicy.findById(req.params.id);
    if (!policy) { res.status(404); throw new Error('Attendance policy not found'); }
    policy.deletedAt = new Date();
    await policy.save();
    res.json({ success: true, message: 'Attendance policy deleted' });
});

// Helper: Resolve effective AttendancePolicy for employee
const resolveEmployeePolicy = async (empId, empCategory) => {
    // 1. Specific employee policy
    let policy = await AttendancePolicy.findOne({
        applicableScope: 'SPECIFIC_EMPLOYEE',
        assignedEmployees: empId,
    });
    if (policy) return policy;

    // 2. Category policy (e.g. Permanent)
    if (empCategory) {
        policy = await AttendancePolicy.findOne({
            applicableScope: 'PERMANENT',
        });
        if (policy) return policy;
    }

    // 3. Default or Global policy
    policy = await AttendancePolicy.findOne({
        $or: [{ isDefault: true }, { applicableScope: 'ALL' }],
    }).sort({ isDefault: -1 });

    // Fallback default structure
    return policy || {
        shiftStartTime: '09:00',
        shiftEndTime: '17:00',
        standardWorkHours: 8,
        overtimeRatePerHour: 100,
        earlyLeavePenaltyRatePerHour: 100,
        lateArrivalPenaltyRatePerHour: 100,
    };
};

/**
 * Import Fingerprint Attendance Sheet & Auto-Calculate OT/Penalties using Policies
 */
export const importFingerprintAttendance = asyncHandler(async (req, res) => {
    const { records } = req.body; // Array of parsed row objects from Excel/CSV

    if (!records || !Array.isArray(records) || records.length === 0) {
        res.status(400);
        throw new Error('No attendance records provided in request');
    }

    let successCount = 0;
    let errors = [];

    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        try {
            const empCode = (row.employeeCode || row.empCode || row.employeeId || row.code || '').trim();
            const empName = (row.employeeName || row.name || '').trim();
            const rawDate = row.date || row.punchDate;

            if (!empCode && !empName) {
                errors.push(`Row ${i + 1}: Missing employee identifier`);
                continue;
            }

            // Find employee
            let emp = null;
            if (empCode) {
                emp = await Employee.findOne({
                    $or: [
                        { employeeCode: { $regex: `^${empCode}$`, $options: 'i' } },
                        { nationalIdNumber: { $regex: `^${empCode}$`, $options: 'i' } }
                    ]
                });
            }
            if (!emp && empName) {
                emp = await Employee.findOne({
                    $or: [
                        { fullName: { $regex: empName, $options: 'i' } },
                        { firstName: { $regex: empName, $options: 'i' } }
                    ]
                });
            }

            if (!emp) {
                errors.push(`Row ${i + 1}: Employee '${empCode || empName}' not found`);
                continue;
            }

            // Parse Date
            const attDate = new Date(rawDate);
            if (isNaN(attDate.getTime())) {
                errors.push(`Row ${i + 1}: Invalid date '${rawDate}'`);
                continue;
            }
            attDate.setHours(0, 0, 0, 0);

            // Parse CheckIn / CheckOut
            let checkIn = null;
            let checkOut = null;

            if (row.checkIn) {
                if (typeof row.checkIn === 'string' && row.checkIn.includes(':')) {
                    const [h, m] = row.checkIn.split(':').map(Number);
                    checkIn = new Date(attDate);
                    checkIn.setHours(h, m, 0, 0);
                } else {
                    checkIn = new Date(row.checkIn);
                }
            }

            if (row.checkOut) {
                if (typeof row.checkOut === 'string' && row.checkOut.includes(':')) {
                    const [h, m] = row.checkOut.split(':').map(Number);
                    checkOut = new Date(attDate);
                    checkOut.setHours(h, m, 0, 0);
                } else {
                    checkOut = new Date(row.checkOut);
                }
            }

            // Resolve Attendance Policy
            const policy = await resolveEmployeePolicy(emp._id, emp.employeeCategory);

            // Calculate shift timestamps
            const [sh, sm] = (policy.shiftStartTime || '09:00').split(':').map(Number);
            const [eh, em] = (policy.shiftEndTime || '17:00').split(':').map(Number);

            const shiftStart = new Date(attDate); shiftStart.setHours(sh, sm, 0, 0);
            const shiftEnd = new Date(attDate); shiftEnd.setHours(eh, em, 0, 0);

            let totalWorkedMinutes = 0;
            let overtimeMinutes = 0;
            let overtimeAmount = 0;
            let lateMinutes = 0;
            let latePenaltyAmount = 0;
            let earlyLeaveMinutes = 0;
            let earlyLeavePenaltyAmount = 0;

            if (checkIn && checkOut) {
                totalWorkedMinutes = Math.max(0, Math.floor((checkOut - checkIn) / 60000));

                // Late arrival
                if (checkIn > shiftStart) {
                    lateMinutes = Math.floor((checkIn - shiftStart) / 60000);
                    const lateHours = Math.ceil(lateMinutes / 60);
                    latePenaltyAmount = lateHours * (policy.lateArrivalPenaltyRatePerHour || 100);
                }

                // Early leave
                if (checkOut < shiftEnd) {
                    earlyLeaveMinutes = Math.floor((shiftEnd - checkOut) / 60000);
                    const earlyHours = Math.ceil(earlyLeaveMinutes / 60);
                    earlyLeavePenaltyAmount = earlyHours * (policy.earlyLeavePenaltyRatePerHour || 100);
                }

                // Overtime
                if (checkOut > shiftEnd) {
                    overtimeMinutes = Math.floor((checkOut - shiftEnd) / 60000);
                    const otHours = overtimeMinutes / 60;
                    overtimeAmount = Math.round(otHours * (policy.overtimeRatePerHour || 100));
                }
            }

            // Status determination
            let status = row.status || 'present';
            if (!checkIn && !checkOut) status = 'absent';

            // Next day date threshold for lookup
            const nextDay = new Date(attDate); nextDay.setDate(nextDay.getDate() + 1);

            await Attendance.findOneAndUpdate(
                { employeeId: emp._id, date: { $gte: attDate, $lt: nextDay } },
                {
                    employeeId: emp._id,
                    employeeCode: emp.employeeCode,
                    employeeName: emp.fullName,
                    date: attDate,
                    checkInTime: checkIn,
                    checkOutTime: checkOut,
                    totalWorkedMinutes,
                    overtimeMinutes,
                    overtimeAmount,
                    lateMinutes,
                    latePenaltyAmount,
                    earlyLeaveMinutes,
                    earlyLeavePenaltyAmount,
                    status,
                    policyId: policy._id || null,
                    importedViaFingerprint: true,
                    markedBy: req.user._id,
                },
                { upsert: true, new: true }
            );

            successCount++;
        } catch (err) {
            errors.push(`Row ${i + 1}: ${err.message}`);
        }
    }

    res.json({
        success: true,
        message: `Successfully processed ${successCount} fingerprint attendance records`,
        successCount,
        errorCount: errors.length,
        errors,
    });
});
// ============================================================
// SALARY ADVANCES & PAYMENT SHEETS
// ============================================================

export const createSalaryAdvance = asyncHandler(async (req, res) => {
    let { employeeId, date, amount, advanceType, requestedPercentage, reason } = req.body;

    if (req.user?.role === 'employee' || !employeeId) {
        const linkedEmp = await Employee.findOne({ userId: req.user._id });
        if (!linkedEmp) {
            res.status(404);
            throw new Error('Employee profile not found for this user');
        }
        employeeId = linkedEmp._id;
    }

    const emp = await Employee.findById(employeeId);
    if (!emp) {
        res.status(404);
        throw new Error('Employee not found');
    }

    let finalAmount = Number(amount) || 0;
    let calcAmount = 0;
    if (advanceType === 'percentage' && requestedPercentage) {
        const baseSalary = emp.basicSalary || (emp.labourRate ? (emp.paymentType === 'per_day' ? emp.labourRate * 26 : emp.labourRate * 200) : 0);
        calcAmount = +((baseSalary * Number(requestedPercentage)) / 100).toFixed(2);
        if (calcAmount > 0) finalAmount = calcAmount;
    }

    const isDirectAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'hr_manager';

    const advance = await SalaryAdvance.create({
        employeeId,
        date: date ? new Date(date) : new Date(),
        advanceType: advanceType || 'amount',
        requestedPercentage: Number(requestedPercentage) || 0,
        calculatedAmount: calcAmount,
        amount: finalAmount,
        reason: reason || '',
        status: isDirectAdmin ? 'approved' : 'pending',
        approvedBy: isDirectAdmin ? req.user._id : undefined,
        approvedAt: isDirectAdmin ? new Date() : undefined,
        createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: advance });
});

export const approveSalaryAdvance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    const advance = await SalaryAdvance.findById(id);
    if (!advance) {
        res.status(404);
        throw new Error('Salary advance request not found');
    }
    advance.status = 'approved';
    if (approvalNotes) advance.approvalNotes = approvalNotes;
    advance.approvedBy = req.user._id;
    advance.approvedAt = new Date();
    await advance.save();
    res.json({ success: true, data: advance });
});

export const declineSalaryAdvance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectedReason } = req.body;
    const advance = await SalaryAdvance.findById(id);
    if (!advance) {
        res.status(404);
        throw new Error('Salary advance request not found');
    }
    advance.status = 'rejected';
    if (rejectedReason) advance.rejectedReason = rejectedReason;
    advance.rejectedBy = req.user._id;
    advance.rejectedAt = new Date();
    await advance.save();
    res.json({ success: true, data: advance });
});

export const getSalaryAdvances = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const filter = {};

    if (req.user?.role === 'employee') {
        const linkedEmp = await Employee.findOne({ userId: req.user._id });
        if (!linkedEmp) {
            return res.json({ success: true, data: [] });
        }
        filter.employeeId = linkedEmp._id;
    } else {
        if (employeeId) filter.employeeId = employeeId;
        else if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    }
    if (req.query.status) filter.status = req.query.status;

    const advances = await SalaryAdvance.find(filter)
        .populate('employeeId', 'firstName lastName employeeCode departmentId basicSalary labourRate paymentType')
        .populate('approvedBy', 'firstName lastName')
        .populate('rejectedBy', 'firstName lastName')
        .sort({ date: -1 });
    res.json({ success: true, data: advances });
});

export const getMyAdvanceLedger = asyncHandler(async (req, res) => {
    let targetEmployeeId = req.query.employeeId || req.params.employeeId;

    if (req.user?.role === 'employee' || !targetEmployeeId) {
        const linkedEmp = await Employee.findOne({ userId: req.user._id });
        if (!linkedEmp) {
            res.status(404);
            throw new Error('Employee profile not found for this user');
        }
        targetEmployeeId = linkedEmp._id;
    }

    const emp = await Employee.findById(targetEmployeeId)
        .populate('departmentId', 'name')
        .populate('designationId', 'name');

    if (!emp) {
        res.status(404);
        throw new Error('Employee not found');
    }

    const advances = await SalaryAdvance.find({ employeeId: targetEmployeeId })
        .populate('approvedBy', 'firstName lastName')
        .populate('rejectedBy', 'firstName lastName')
        .populate('deductedPayrollId', 'periodMonth periodYear status')
        .sort({ date: 1, createdAt: 1 });

    let totalRequested = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalDeducted = 0;
    let runningBalance = 0;

    const ledgerEntries = [];

    advances.forEach((adv) => {
        const amt = adv.amount || 0;
        totalRequested += amt;

        if (adv.status === 'pending') {
            totalPending += amt;
            ledgerEntries.push({
                _id: adv._id,
                date: adv.date,
                type: 'request',
                description: `Requested Salary Advance (${adv.advanceType === 'percentage' ? adv.requestedPercentage + '%' : 'LKR ' + amt.toLocaleString()}) - ${adv.reason || 'No reason'}`,
                amount: amt,
                deduction: 0,
                status: 'pending',
                runningBalance: runningBalance,
            });
        } else if (adv.status === 'rejected') {
            totalRejected += amt;
            ledgerEntries.push({
                _id: adv._id,
                date: adv.date,
                type: 'rejected',
                description: `Advance Request Rejected (${adv.rejectedReason || 'Declined by Admin'})`,
                amount: amt,
                deduction: 0,
                status: 'rejected',
                runningBalance: runningBalance,
            });
        } else if (adv.status === 'approved') {
            totalApproved += amt;
            runningBalance += amt;

            ledgerEntries.push({
                _id: adv._id,
                date: adv.date,
                type: 'advance_issued',
                description: `Salary Advance Approved (${adv.advanceType === 'percentage' ? adv.requestedPercentage + '%' : 'LKR ' + amt.toLocaleString()})`,
                amount: amt,
                deduction: 0,
                status: adv.isDeducted ? 'approved' : 'active',
                runningBalance: runningBalance,
            });

            if (adv.isDeducted) {
                totalDeducted += amt;
                runningBalance -= amt;
                const monthName = adv.deductedPayrollId?.periodMonth
                    ? new Date(2000, adv.deductedPayrollId.periodMonth - 1, 1).toLocaleString('en-US', { month: 'short' })
                    : '';
                const periodLabel = adv.deductedPayrollId
                    ? `${monthName} ${adv.deductedPayrollId.periodYear}`
                    : 'Payroll';

                ledgerEntries.push({
                    _id: `${adv._id}-deduction`,
                    date: adv.updatedAt || adv.date,
                    type: 'payroll_deduction',
                    description: `Payroll Deduction Recovery (${periodLabel})`,
                    amount: 0,
                    deduction: amt,
                    status: 'deducted',
                    runningBalance: runningBalance,
                });
            }
        }
    });

    const outstandingBalance = Math.max(0, runningBalance);

    res.json({
        success: true,
        data: {
            employee: {
                id: emp._id,
                employeeCode: emp.employeeCode,
                fullName: `${emp.firstName} ${emp.lastName}`,
                department: emp.departmentId?.name || '',
                designation: emp.designationId?.name || '',
                basicSalary: emp.basicSalary || (emp.labourRate ? (emp.paymentType === 'per_day' ? emp.labourRate * 26 : emp.labourRate * 200) : 0),
            },
            summary: {
                totalRequested,
                totalApproved,
                totalPending,
                totalRejected,
                totalDeducted,
                outstandingBalance,
            },
            ledger: ledgerEntries.reverse(),
            advances,
        }
    });
});

export const getEmployeePaymentSheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const employee = await Employee.findById(id);
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    const start = new Date(startDate || new Date(new Date().setDate(new Date().getDate() - 30)));
    const end = new Date(endDate || new Date());
    end.setHours(23, 59, 59, 999);

    // Fetch attendance records and advances
    const [attendanceLogs, advances] = await Promise.all([
        Attendance.find({
            employeeId: id,
            date: { $gte: start, $lte: end },
            status: { $in: ['present', 'late', 'half_day'] }
        }).sort({ date: 1 }),
        SalaryAdvance.find({
            employeeId: id,
            date: { $gte: start, $lte: end },
            status: 'approved'
        }).sort({ date: 1 })
    ]);

    const hourlyRate = employee.hourlyRate || employee.labourRate || 260;
    const empName = employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.displayName || 'Employee';

    // Create a date-wise mapping
    const rows = [];
    const dateMap = {};

    // Standard loop day by day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('en-GB'); // dd/mm/yyyy
        dateMap[dateStr] = {
            date: dateStr,
            inTime: '—',
            outTime: '—',
            hours: '00:00:00',
            hoursDecimal: 0,
            daySalary: 0,
            advance: 0
        };
    }

    // Populate attendance logs
    attendanceLogs.forEach(log => {
        const dateStr = new Date(log.date).toLocaleDateString('en-GB');
        if (dateMap[dateStr]) {
            let inStr = '—';
            let outStr = '—';
            let workedHrs = 0;
            let durationStr = '00:00:00';

            if (log.checkInTime && log.checkOutTime) {
                const inDate = new Date(log.checkInTime);
                const outDate = new Date(log.checkOutTime);
                
                inStr = inDate.toTimeString().split(' ')[0]; // HH:MM:SS
                outStr = outDate.toTimeString().split(' ')[0]; // HH:MM:SS
                
                const diffMs = outDate - inDate;
                const totalSec = Math.max(0, Math.floor(diffMs / 1000));
                
                const hrs = Math.floor(totalSec / 3600);
                const mins = Math.floor((totalSec % 3600) / 60);
                const secs = totalSec % 60;
                
                durationStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                workedHrs = totalSec / 3600;
            }

            dateMap[dateStr].inTime = inStr;
            dateMap[dateStr].outTime = outStr;
            dateMap[dateStr].hours = durationStr;
            dateMap[dateStr].hoursDecimal = workedHrs;
            dateMap[dateStr].daySalary = +(workedHrs * hourlyRate).toFixed(2);
        }
    });

    // Populate advances
    advances.forEach(adv => {
        const dateStr = new Date(adv.date).toLocaleDateString('en-GB');
        if (dateMap[dateStr]) {
            dateMap[dateStr].advance = adv.amount;
        }
    });

    // Convert dateMap to sorted list
    const sortedDates = Object.keys(dateMap).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

    const paymentRows = sortedDates.map(dateKey => dateMap[dateKey]);

    // Totals
    const totalSalary = paymentRows.reduce((sum, r) => sum + r.daySalary, 0);
    const totalAdvances = paymentRows.reduce((sum, r) => sum + r.advance, 0);
    const netSalary = totalSalary - totalAdvances;

    res.json({
        success: true,
        data: {
            employee: {
                id: employee._id,
                code: employee.employeeCode,
                name: empName,
                hourlyRate: hourlyRate
            },
            startDate: start.toLocaleDateString('en-GB'),
            endDate: end.toLocaleDateString('en-GB'),
            rows: paymentRows,
            totalSalary: +totalSalary.toFixed(2),
            totalAdvances: +totalAdvances.toFixed(2),
            netSalary: +netSalary.toFixed(2)
        }
    });
});
