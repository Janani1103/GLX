import { useState, useEffect } from 'react';
import {
  DollarSign, Plus, Search, Filter, Calendar, Tag, CreditCard,
  Building2, Trash2, Edit, CheckCircle, FileText, TrendingUp, AlertCircle
} from 'lucide-react';
import api from '../api/axios';

const EXPENSE_CATEGORIES = [
  'Raw Materials',
  'Transport & Freight',
  'Salaries & Wages',
  'Utilities & Electricity',
  'Fuel & Vehicles',
  'Rent & Rates',
  'Maintenance & Repairs',
  'Stationery & Office',
  'Welfare & Food',
  'Marketing & Sales',
  'Tax & Legal',
  'Miscellaneous'
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Miscellaneous',
    amount: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    chequeNumber: '',
    chequeDate: '',
    payeeName: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    notes: '',
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (paymentMethodFilter) params.paymentMethod = paymentMethodFilter;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/expenses', { params }),
        api.get('/expenses/summary')
      ]);

      if (listRes.data.success) {
        setExpenses(listRes.data.data);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [prodRes, whRes] = await Promise.all([
        api.get('/products?limit=1000&status=active'),
        api.get('/warehouses?isActive=true')
      ]);
      setProducts(prodRes.data.data || []);
      setWarehouses(whRes.data.data || []);
    } catch (err) {
      console.error('Failed to load products/warehouses in expenses page', err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchLookups();
  }, [search, categoryFilter, paymentMethodFilter]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'productId') {
      const p = products.find(x => x._id === value);
      if (p) {
        newItems[index].productCode = p.productCode;
        newItems[index].productName = p.name;
        newItems[index].costPerUnit = p.costs?.averageCost || p.costs?.lastPurchaseCost || p.basePrice || 0;
      }
    }
    
    newItems[index].subtotal = Number(newItems[index].quantity || 0) * Number(newItems[index].costPerUnit || 0);
    const totalAmount = newItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    setFormData(prev => ({ 
      ...prev, 
      items: newItems,
      amount: totalAmount
    }));
  };

  const addItem = () => {
    const defaultWh = warehouses[0]?._id || '';
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { productId: '', productCode: '', productName: '', warehouseId: defaultWh, quantity: 1, costPerUnit: 0, subtotal: 0 }]
    }));
  };

  const removeItem = (idx) => {
    const newItems = (formData.items || []).filter((_, i) => i !== idx);
    const totalAmount = newItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    setFormData(prev => ({
      ...prev,
      items: newItems,
      amount: totalAmount
    }));
  };

  const handleOpenModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        title: expense.title || '',
        category: expense.category || 'Miscellaneous',
        amount: expense.amount || '',
        paymentMethod: expense.paymentMethod || 'Cash',
        paymentStatus: expense.paymentStatus || 'Paid',
        chequeNumber: expense.chequeNumber || '',
        chequeDate: expense.chequeDate ? new Date(expense.chequeDate).toISOString().split('T')[0] : '',
        payeeName: expense.payeeName || '',
        date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        referenceNo: expense.referenceNo || '',
        notes: expense.notes || '',
        isStockConsumption: expense.isStockConsumption || false,
        items: expense.items || []
      });
    } else {
      setEditingExpense(null);
      setFormData({
        title: '',
        category: 'Miscellaneous',
        amount: '',
        paymentMethod: 'Cash',
        paymentStatus: 'Paid',
        chequeNumber: '',
        chequeDate: '',
        payeeName: '',
        date: new Date().toISOString().split('T')[0],
        referenceNo: '',
        notes: '',
        isStockConsumption: false,
        items: []
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }
      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting expense');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-500" />
            Company Expense Management
          </h1>
          <p className="text-sm text-slate-500">
            Dedicated expense tracking, category breakdowns, and financial P&L integration
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Expense Record
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grand Total Expenses</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-2">
              LKR {summary.grandTotal?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Category</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Tag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-800 mt-2 truncate">
              {summary.byCategory?.[0]?._id || 'N/A'}
            </p>
            <span className="text-xs text-slate-500">
              LKR {summary.byCategory?.[0]?.total?.toLocaleString() || 0}
            </span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash / Petty Outflow</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800 mt-2">
              LKR {(summary.byPaymentMethod?.find(m => m._id === 'Cash')?.total || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bank / Cheque Outflow</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800 mt-2">
              LKR {((summary.byPaymentMethod?.find(m => m._id === 'Cheque')?.total || 0) + (summary.byPaymentMethod?.find(m => m._id === 'Bank Transfer')?.total || 0)).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, number, payee, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="">All Payment Methods</option>
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Cheque">Cheque</option>
          <option value="Petty Cash">Petty Cash</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Expense #</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Title / Description</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Payee / Vendor</th>
                <th className="py-3.5 px-4 font-semibold">Method</th>
                <th className="py-3.5 px-4 font-semibold text-right">Amount (LKR)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">Loading expenses...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">No expense records found.</td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-emerald-600">
                      {expense.expenseNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {expense.title}
                      {expense.referenceNo && (
                        <span className="block text-xs text-slate-400">Ref: {expense.referenceNo}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {expense.payeeName || expense.supplierId?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {expense.paymentMethod}
                        {expense.chequeNumber && ` (${expense.chequeNumber})`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {expense.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenModal(expense)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800">
              {editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Office Electricity Bill, Factory Maintenance"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    disabled={formData.isStockConsumption}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white disabled:opacity-75"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    readOnly={formData.isStockConsumption}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white read-only:bg-gray-100"
                  />
                </div>
              </div>

              {/* Internal Stock Consumption Switch */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isStockConsumption"
                  checked={formData.isStockConsumption || false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      isStockConsumption: checked,
                      category: checked ? 'Raw Materials' : prev.category,
                      amount: checked ? 0 : prev.amount,
                      items: checked ? [{ productId: '', productCode: '', productName: '', warehouseId: warehouses[0]?._id || '', quantity: 1, costPerUnit: 0, subtotal: 0 }] : []
                    }));
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isStockConsumption" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Internal Stock Consumption (Raw Materials used for lorry body)
                </label>
              </div>

              {/* Items grid if internal stock consumption checked */}
              {formData.isStockConsumption && (
                <div className="space-y-3 p-3 border border-dashed rounded-lg bg-white">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase">Raw Materials & Quantities</span>
                    <button
                      type="button"
                      onClick={addItem}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded text-primary-600"
                    >
                      + Add Raw Material
                    </button>
                  </div>
                  
                  {formData.items?.map((item, idx) => (
                    <div key={idx} className="space-y-2 border-b pb-2 last:border-b-0 last:pb-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold uppercase">Material *</label>
                          <select
                            value={item.productId || ''}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                            className="w-full text-xs p-1.5 border rounded bg-white"
                            required
                          >
                            <option value="">-- Select Material --</option>
                            {products.map(p => (
                              <option key={p._id} value={p._id}>{p.name} ({p.productCode})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold uppercase">Warehouse *</label>
                          <select
                            value={item.warehouseId || ''}
                            onChange={(e) => handleItemChange(idx, 'warehouseId', e.target.value)}
                            className="w-full text-xs p-1.5 border rounded bg-white"
                            required
                          >
                            <option value="">-- Select Wh --</option>
                            {warehouses.map(w => (
                              <option key={w._id} value={w._id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold uppercase">Cost per Unit</label>
                          <input
                            type="number"
                            value={item.costPerUnit || 0}
                            readOnly
                            className="w-full text-xs p-1 bg-gray-50 border rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold uppercase">Qty *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity || 0}
                            onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                            className="w-full text-xs p-1 border rounded font-mono bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold uppercase">Subtotal</label>
                          <span className="text-xs font-mono block text-gray-700 mt-1">
                            {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(item.subtotal || 0)}
                          </span>
                        </div>
                        <div className="text-right pt-4">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method *</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Petty Cash">Petty Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              {formData.paymentMethod === 'Cheque' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={formData.chequeNumber}
                      onChange={(e) => setFormData({ ...formData, chequeNumber: e.target.value })}
                      placeholder="e.g. CHQ-98214"
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Cheque Date</label>
                    <input
                      type="date"
                      value={formData.chequeDate}
                      onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payee / Vendor Name</label>
                  <input
                    type="text"
                    value={formData.payeeName}
                    onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                    placeholder="e.g. CEB / Sri Lanka Telecom"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reference / Voucher No</label>
                  <input
                    type="text"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    placeholder="e.g. INV-10029"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
