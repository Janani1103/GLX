import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Expense from '../models/Expense.js';
import { createAuditLog } from '../utils/auditLogger.js';

/**
 * Recalculate dynamic financials for a project
 */
export const recalculateProjectFinancials = async (projectId) => {
    const project = await Project.findById(projectId);
    if (!project) return;

    // 1. Calculate material cost from materialsIssued
    let materialCost = 0;
    if (project.materialsIssued && project.materialsIssued.length > 0) {
        materialCost = project.materialsIssued.reduce((sum, item) => sum + ((item.buyingPrice || 0) * (item.qty || 0)), 0);
    }
    project.materialCost = +materialCost.toFixed(2);

    // 2. Calculate other expenses linked to this project
    const expenses = await Expense.find({ projectId: project._id, paymentStatus: 'Paid', deletedAt: null });
    const otherExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    project.otherExpenses = +otherExpenses.toFixed(2);

    // 3. Calculate labor cost from assigned employees' attendance logs during project duration
    let laborCost = 0;
    if (project.assignedEmployees && project.assignedEmployees.length > 0) {
        const startDate = project.createdAt || new Date();
        const endDate = project.status === 'delivered' ? (project.deliveryDate || new Date()) : new Date();

        const employeeIds = project.assignedEmployees;
        const employees = await Employee.find({ _id: { $in: employeeIds } });
        const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));

        const attendanceLogs = await Attendance.find({
            employeeId: { $in: employeeIds },
            date: { $gte: startDate, $lte: endDate }
        });

        attendanceLogs.forEach(log => {
            const emp = employeeMap.get(log.employeeId?.toString());
            if (emp) {
                const workedHours = (log.totalWorkedMinutes || 0) / 60;
                if (emp.basicWageRate && emp.basicWageRate > 0) {
                    laborCost += workedHours * emp.basicWageRate;
                } else if (emp.basicSalary && emp.basicSalary > 0) {
                    // Estimate hourly rate: basic salary divided by 26 working days of 8 hours
                    const hourlyRate = emp.basicSalary / (26 * 8);
                    laborCost += workedHours * hourlyRate;
                }
            }
        });
    }
    project.laborCost = +laborCost.toFixed(2);

    // 4. Net Profit calculation
    project.netProfit = +(project.quotedPrice - project.materialCost - project.laborCost - project.otherExpenses).toFixed(2);
    await project.save();
    return project;
};

/**
 * GET /api/projects
 * List all projects with search and filters
 */
export const getProjects = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    const filter = { deletedAt: null };

    if (status) {
        filter.status = status;
    }

    let projectIds = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        // Search by projectNumber, name, yard
        const matchQuery = {
            $or: [
                { projectNumber: searchRegex },
                { name: searchRegex },
                { yard: searchRegex }
            ]
        };
        const projects = await Project.find({ ...filter, ...matchQuery }).select('_id');
        projectIds = projects.map(p => p._id);
        filter._id = { $in: projectIds };
    }

    const projects = await Project.find(filter)
        .populate('customer', 'displayName customerCode')
        .populate('assignedEmployees', 'firstName lastName employeeCode basicWageRate')
        .sort({ createdAt: -1 });

    // Recalculate financials in real-time for active projects to keep dashboard up to date
    for (const p of projects) {
        if (p.status === 'active') {
            await recalculateProjectFinancials(p._id);
        }
    }

    // Refetch sorted projects with updated calculations
    const updatedProjects = await Project.find(filter)
        .populate('customer', 'displayName customerCode')
        .populate('assignedEmployees', 'firstName lastName employeeCode basicWageRate')
        .sort({ createdAt: -1 });

    res.json({ success: true, data: updatedProjects });
});

/**
 * GET /api/projects/:id
 * Get details of a single project (with on-the-fly financial updates)
 */
export const getProjectById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let project = await Project.findById(id)
        .populate('customer', 'displayName customerCode phone email billingAddress')
        .populate('quotation', 'quotationCode grandTotal items')
        .populate('assignedEmployees', 'firstName lastName displayName employeeCode basicWageRate basicSalary photoUrl')
        .populate('materialsIssued.product', 'name productCode unitOfMeasure')
        .populate('materialsIssued.issuedBy', 'firstName lastName employeeCode');

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Recalculate financials dynamically
    await recalculateProjectFinancials(project._id);

    // Reload with updated numbers
    project = await Project.findById(id)
        .populate('customer', 'displayName customerCode phone email billingAddress')
        .populate('quotation', 'quotationCode grandTotal items')
        .populate('assignedEmployees', 'firstName lastName displayName employeeCode basicWageRate basicSalary photoUrl')
        .populate('materialsIssued.product', 'name productCode unitOfMeasure')
        .populate('materialsIssued.issuedBy', 'firstName lastName employeeCode');

    res.json({ success: true, data: project });
});

/**
 * POST /api/projects
 * Create manual project
 */
export const createProject = asyncHandler(async (req, res) => {
    const { name, customer, yard, details, assignedEmployees, quotedPrice } = req.body;

    if (!name || !customer) {
        res.status(400);
        throw new Error('Name and Customer are required');
    }

    const project = new Project({
        name,
        customer,
        yard,
        details,
        assignedEmployees: assignedEmployees || [],
        quotedPrice: Number(quotedPrice) || 0,
        createdBy: req.user._id
    });

    await project.save();

    createAuditLog({
        action: 'create',
        module: 'projects',
        documentId: project._id,
        documentCode: project.projectNumber,
        description: `Created manual project: ${project.name}`,
        req
    });

    res.status(201).json({ success: true, data: project });
});

/**
 * PUT /api/projects/:id
 * Update project details
 */
export const updateProject = asyncHandler(async (req, res) => {
    const { name, yard, details, assignedEmployees, quotedPrice, progress, status } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    project.name = name !== undefined ? name : project.name;
    project.yard = yard !== undefined ? yard : project.yard;
    project.details = details !== undefined ? details : project.details;
    project.assignedEmployees = assignedEmployees !== undefined ? assignedEmployees : project.assignedEmployees;
    project.quotedPrice = quotedPrice !== undefined ? Number(quotedPrice) : project.quotedPrice;
    project.progress = progress !== undefined ? Number(progress) : project.progress;
    project.status = status !== undefined ? status : project.status;
    project.updatedBy = req.user._id;

    if (status === 'delivered' && project.status !== 'delivered') {
        project.deliveryDate = new Date();
    }

    await project.save();
    await recalculateProjectFinancials(project._id);

    createAuditLog({
        action: 'update',
        module: 'projects',
        documentId: project._id,
        documentCode: project.projectNumber,
        description: `Updated project: ${project.name} (Status: ${project.status})`,
        req
    });

    res.json({ success: true, data: project });
});

/**
 * POST /api/projects/:id/deliver
 * Finalize delivery and freeze financials
 */
export const deliverProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    project.status = 'delivered';
    project.progress = 100;
    project.deliveryDate = new Date();
    project.updatedBy = req.user._id;

    await project.save();
    const updated = await recalculateProjectFinancials(project._id);

    createAuditLog({
        action: 'update',
        module: 'projects',
        documentId: project._id,
        documentCode: project.projectNumber,
        description: `Delivered project: ${project.name}. Net Profit: LKR ${updated.netProfit}`,
        req
    });

    res.json({ success: true, message: 'Project delivered successfully', data: updated });
});

/**
 * DELETE /api/projects/:id
 * Soft delete project
 */
export const deleteProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    project.deletedAt = new Date();
    project.updatedBy = req.user._id;
    await project.save();

    createAuditLog({
        action: 'delete',
        module: 'projects',
        documentId: project._id,
        documentCode: project.projectNumber,
        description: `Soft deleted project: ${project.name}`,
        req
    });

    res.json({ success: true, message: 'Project deleted successfully' });
});
