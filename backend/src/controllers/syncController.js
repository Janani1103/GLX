import asyncHandler from 'express-async-handler';
import ExcelJS from 'exceljs';
import PettyCash from '../models/PettyCash.js';
import ProductionBatch from '../models/ProductionBatch.js';
import DailyPnL from '../models/DailyPnL.js';
import excelService from '../services/excelService.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ────── PETTY CASH ──────────────────────────────────────

export const getPettyCash = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, search = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { deletedAt: null };
  if (search) {
    filter.$or = [
      { item: { $regex: search, $options: 'i' } },
      { supplier: { $regex: search, $options: 'i' } },
      { refNo: { $regex: search, $options: 'i' } },
    ];
  }
  const [data, total] = await Promise.all([
    PettyCash.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean(),
    PettyCash.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const createPettyCash = asyncHandler(async (req, res) => {
  const entry = await PettyCash.create({ ...req.body, createdBy: req.user._id });
  // Async disk sync - add row to Excel
  excelService.appendExcelRow('petty_cash', entry.toObject()).catch(console.error);
  res.status(201).json({ success: true, data: entry });
});

export const updatePettyCash = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await PettyCash.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!updated) { res.status(404); throw new Error('Record not found'); }
  excelService.updateExcelRow('petty_cash', updated.toObject()).catch(console.error);
  res.json({ success: true, data: updated });
});

export const deletePettyCash = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await PettyCash.findById(id);
  if (!item) { res.status(404); throw new Error('Record not found'); }
  await excelService.deleteExcelRow('petty_cash', item.toObject()).catch(console.error);
  await PettyCash.findByIdAndDelete(id);
  res.json({ success: true, message: 'Deleted successfully' });
});

// ────── PRODUCTION ──────────────────────────────────────

export const getProduction = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, search = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { deletedAt: null };
  if (search) {
    filter.$or = [
      { batchNo: { $regex: search, $options: 'i' } },
      { product: { $regex: search, $options: 'i' } },
    ];
  }
  const [data, total] = await Promise.all([
    ProductionBatch.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean(),
    ProductionBatch.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const createProduction = asyncHandler(async (req, res) => {
  const entry = await ProductionBatch.create({ ...req.body, createdBy: req.user._id });
  excelService.appendExcelRow('production', entry.toObject()).catch(console.error);
  res.status(201).json({ success: true, data: entry });
});

export const updateProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await ProductionBatch.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!updated) { res.status(404); throw new Error('Record not found'); }
  excelService.updateExcelRow('production', updated.toObject()).catch(console.error);
  res.json({ success: true, data: updated });
});

export const deleteProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await ProductionBatch.findById(id);
  if (!item) { res.status(404); throw new Error('Record not found'); }
  await excelService.deleteExcelRow('production', item.toObject()).catch(console.error);
  await ProductionBatch.findByIdAndDelete(id);
  res.json({ success: true, message: 'Deleted successfully' });
});

// ────── P&L ─────────────────────────────────────────────

export const getPnL = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { deletedAt: null };
  const [data, total] = await Promise.all([
    DailyPnL.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean(),
    DailyPnL.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const createPnL = asyncHandler(async (req, res) => {
  const entry = await DailyPnL.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: entry });
});

export const updatePnL = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await DailyPnL.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!updated) { res.status(404); throw new Error('Record not found'); }
  excelService.updateExcelRow('pnl', updated.toObject()).catch(console.error);
  res.json({ success: true, data: updated });
});

export const deletePnL = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await DailyPnL.findById(id);
  if (!item) { res.status(404); throw new Error('Record not found'); }
  await DailyPnL.findByIdAndDelete(id);
  res.json({ success: true, message: 'Deleted successfully' });
});

// ────── TEMPLATE EXPORT ──────────────────────────────────

export const exportWithTemplate = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const key = type.replace('-', '_');
  const fileName = excelService.masterFiles[key] || `${type}_template.xlsx`;

  // 1. Try finding local source file if present on server disk
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), '..', fileName),
    path.resolve(__dirname, '../../../', fileName),
  ];

  for (const filePath of candidates) {
    if (await fs.pathExists(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.download(filePath);
    }
  }

  // 2. Dynamic generation with real DB data and template columns
  const workbook = new ExcelJS.Workbook();

  if (key === 'petty_cash') {
    const sheet = workbook.addWorksheet('Petty Cash');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Ref No', key: 'refNo', width: 15 },
      { header: 'Item / Description', key: 'item', width: 25 },
      { header: 'Supplier', key: 'supplier', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Raw Material Nos', key: 'rawMaterial_nos', width: 16 },
      { header: 'Raw Material Rate', key: 'rawMaterial_rate', width: 16 },
      { header: 'Raw Material Cost', key: 'rawMaterial_cost', width: 16 },
      { header: 'Chemicals', key: 'chemicals', width: 14 },
      { header: 'Transport', key: 'transport', width: 14 },
      { header: 'Welfare', key: 'welfare', width: 14 },
      { header: 'Fuel', key: 'fuel', width: 14 },
      { header: 'Maintenance', key: 'maintenance', width: 14 },
      { header: 'Stationary', key: 'stationary', width: 14 },
      { header: 'Misc Wages', key: 'miscWages', width: 14 },
      { header: 'Wood / Firewood', key: 'wood', width: 16 },
      { header: 'Packing Materials', key: 'packingMaterials', width: 16 },
      { header: 'Balance', key: 'balance', width: 15 },
    ];

    const records = await PettyCash.find({ deletedAt: null }).sort({ date: -1 }).limit(1000);
    records.forEach(r => {
      sheet.addRow({
        date: r.date ? r.date.toISOString().split('T')[0] : '',
        refNo: r.refNo || r.voucherCode || '',
        item: r.item || r.description || '',
        supplier: r.supplier || r.paidTo || '',
        amount: r.amount || 0,
        rawMaterial_nos: r.rawMaterial_nos || 0,
        rawMaterial_rate: r.rawMaterial_rate || 0,
        rawMaterial_cost: r.rawMaterial_cost || 0,
        chemicals: r.chemicals || 0,
        transport: r.transport || 0,
        welfare: r.welfare || 0,
        fuel: r.fuel || 0,
        maintenance: r.maintenance || 0,
        stationary: r.stationary || 0,
        miscWages: r.miscWages || 0,
        wood: r.wood || 0,
        packingMaterials: r.packingMaterials || 0,
        balance: r.balance || 0,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (key === 'production') {
    const sheet = workbook.addWorksheet('Production');
    sheet.columns = [
      { header: 'S/N', key: 'sn', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Batch No', key: 'batchNo', width: 16 },
      { header: 'Product', key: 'product', width: 22 },
      { header: 'Staff Day', key: 'staff_day', width: 12 },
      { header: 'Staff Night', key: 'staff_night', width: 12 },
      { header: 'Staff Total', key: 'staff_total', width: 12 },
      { header: 'Input Day', key: 'inputWeight_day', width: 14 },
      { header: 'Input Night', key: 'inputWeight_night', width: 14 },
      { header: 'Input Total (kg)', key: 'inputWeight_total', width: 16 },
      { header: 'Rejects Day', key: 'rejects_day', width: 14 },
      { header: 'Rejects Night', key: 'rejects_night', width: 14 },
      { header: 'Output Day', key: 'outputWeight_day', width: 14 },
      { header: 'Output Night', key: 'outputWeight_night', width: 14 },
      { header: 'Output Total (kg)', key: 'outputWeight_total', width: 16 },
      { header: 'Powder', key: 'powder', width: 12 },
      { header: 'Tea Bag', key: 'teaBag', width: 12 },
      { header: 'Remark', key: 'remark', width: 20 },
    ];

    const records = await ProductionBatch.find({ deletedAt: null }).sort({ date: -1 }).limit(1000);
    records.forEach((r, idx) => {
      sheet.addRow({
        sn: idx + 1,
        date: r.date ? r.date.toISOString().split('T')[0] : '',
        batchNo: r.batchNo || r.batchNumber || '',
        product: r.product || '',
        staff_day: r.staff_day || 0,
        staff_night: r.staff_night || 0,
        staff_total: r.staff_total || 0,
        inputWeight_day: r.inputWeight_day || 0,
        inputWeight_night: r.inputWeight_night || 0,
        inputWeight_total: r.inputWeight_total || 0,
        rejects_day: r.rejects_day || 0,
        rejects_night: r.rejects_night || 0,
        outputWeight_day: r.outputWeight_day || 0,
        outputWeight_night: r.outputWeight_night || 0,
        outputWeight_total: r.outputWeight_total || 0,
        powder: r.powder || 0,
        teaBag: r.teaBag || 0,
        remark: r.remark || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (key === 'pnl') {
    const sheet = workbook.addWorksheet('Daily PnL');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Raw Material', key: 'rawMaterial', width: 15 },
      { header: 'Labour Salary', key: 'labourSalary', width: 15 },
      { header: 'Supervisor QC', key: 'supervisorQC', width: 15 },
      { header: 'Electricity', key: 'electricity', width: 15 },
      { header: 'Firewood', key: 'firewood', width: 15 },
      { header: 'Packing', key: 'packing', width: 15 },
      { header: 'Transport', key: 'transport', width: 15 },
      { header: 'Communication', key: 'communication', width: 15 },
      { header: 'Other', key: 'other', width: 15 },
      { header: 'Total Expenses', key: 'totalExpenses', width: 18 },
      { header: 'Total Revenue', key: 'totalRevenue', width: 18 },
      { header: 'Net Profit', key: 'netProfit', width: 18 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];

    const records = await DailyPnL.find({ deletedAt: null }).sort({ date: -1 }).limit(1000);
    records.forEach(r => {
      sheet.addRow({
        date: r.date ? r.date.toISOString().split('T')[0] : '',
        day: r.day || '',
        rawMaterial: r.rawMaterial || 0,
        labourSalary: r.labourSalary || 0,
        supervisorQC: r.supervisorQC || 0,
        electricity: r.electricity || 0,
        firewood: r.firewood || 0,
        packing: r.packing || 0,
        transport: r.transport || 0,
        communication: r.communication || 0,
        other: r.other || 0,
        totalExpenses: r.totalExpenses || 0,
        totalRevenue: r.totalRevenue || 0,
        netProfit: r.netProfit || 0,
        notes: r.notes || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  res.status(404).json({ message: 'Template not available' });
});
