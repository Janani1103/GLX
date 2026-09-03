import { useState, useEffect } from 'react';
import {
  Clock, Shield, Plus, Edit, Trash2, CheckCircle2, UserCheck, Users, AlertCircle, Save
} from 'lucide-react';
import api from '../api/axios';

export default function AttendancePoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shiftStartTime: '09:00',
    shiftEndTime: '17:00',
    standardWorkHours: 8,
    overtimeRatePerHour: 100,
    earlyLeavePenaltyRatePerHour: 100,
    lateArrivalPenaltyRatePerHour: 100,
    leaveDeductionDailyRate: 0,
    applicableScope: 'ALL',
    assignedEmployees: [],
    isDefault: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [policiesRes, empRes] = await Promise.all([
        api.get('/hr/attendance-policies'),
        api.get('/hr/employees')
      ]);

      if (policiesRes.data.success) {
        setPolicies(policiesRes.data.data);
      }
      if (empRes.data.success) {
        setEmployees(empRes.data.data);
      }
    } catch (err) {
      console.error('Error loading attendance policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name || '',
        description: policy.description || '',
        shiftStartTime: policy.shiftStartTime || '09:00',
        shiftEndTime: policy.shiftEndTime || '17:00',
        standardWorkHours: policy.standardWorkHours || 8,
        overtimeRatePerHour: policy.overtimeRatePerHour || 100,
        earlyLeavePenaltyRatePerHour: policy.earlyLeavePenaltyRatePerHour || 100,
        lateArrivalPenaltyRatePerHour: policy.lateArrivalPenaltyRatePerHour || 100,
        leaveDeductionDailyRate: policy.leaveDeductionDailyRate || 0,
        applicableScope: policy.applicableScope || 'ALL',
        assignedEmployees: policy.assignedEmployees?.map(e => typeof e === 'object' ? e._id : e) || [],
        isDefault: policy.isDefault || false,
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        description: '',
        shiftStartTime: '09:00',
        shiftEndTime: '17:00',
        standardWorkHours: 8,
        overtimeRatePerHour: 100,
        earlyLeavePenaltyRatePerHour: 100,
        lateArrivalPenaltyRatePerHour: 100,
        leaveDeductionDailyRate: 0,
        applicableScope: 'ALL',
        assignedEmployees: [],
        isDefault: false,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPolicy) {
        await api.put(`/hr/attendance-policies/${editingPolicy._id}`, formData);
      } else {
        await api.post('/hr/attendance-policies', formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving policy');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return;
    try {
      await api.delete(`/hr/attendance-policies/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting policy');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-7 h-7 text-indigo-500" />
            Attendance & Leave Policy Manager
          </h1>
          <p className="text-sm text-slate-500">
            Define shift rules (e.g. 9 AM to 5 PM), OT rates (Rs. 100/hr), early leave penalty cuts, and assign globally or to specific employees.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Create New Policy
        </button>
      </div>

      {/* Policies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading policies...</div>
        ) : policies.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
            No attendance policies defined yet. Click "Create New Policy" to add one.
          </div>
        ) : (
          policies.map((policy) => (
            <div
              key={policy._id}
              className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 relative ${
                policy.isDefault ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-200'
              }`}
            >
              {policy.isDefault && (
                <span className="absolute top-4 right-4 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Default Policy
                </span>
              )}

              <div>
                <h3 className="font-bold text-lg text-slate-800">{policy.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{policy.description || 'No description provided'}</p>
              </div>

              {/* Policy Settings Grid */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Standard Shift:</span>
                  <span className="font-semibold text-slate-700">
                    {policy.shiftStartTime} - {policy.shiftEndTime} ({policy.standardWorkHours} hrs)
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Overtime Rate:</span>
                  <span className="font-semibold text-emerald-600">
                    + LKR {policy.overtimeRatePerHour} / hr
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Early Departure Cut:</span>
                  <span className="font-semibold text-rose-600">
                    - LKR {policy.earlyLeavePenaltyRatePerHour} / hr
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Late Arrival Cut:</span>
                  <span className="font-semibold text-amber-600">
                    - LKR {policy.lateArrivalPenaltyRatePerHour} / hr
                  </span>
                </div>

                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-500">Target Scope:</span>
                  <span className="font-semibold text-indigo-600 uppercase">
                    {policy.applicableScope}
                  </span>
                </div>
              </div>

              {/* Target Employees info */}
              {policy.applicableScope === 'SPECIFIC_EMPLOYEE' && (
                <div className="text-xs text-slate-500">
                  Assigned to <span className="font-semibold text-slate-700">{policy.assignedEmployees?.length || 0} selected employee(s)</span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleOpenModal(policy)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(policy._id)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Policy Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800">
              {editingPolicy ? 'Edit Attendance Policy' : 'Create New Attendance Policy'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Policy Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Standard Permanent Staff Policy (9 AM - 5 PM)"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief summary of shift hours and rules"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Shift Start</label>
                  <input
                    type="time"
                    required
                    value={formData.shiftStartTime}
                    onChange={(e) => setFormData({ ...formData, shiftStartTime: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Shift End</label>
                  <input
                    type="time"
                    required
                    value={formData.shiftEndTime}
                    onChange={(e) => setFormData({ ...formData, shiftEndTime: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Standard Hours</label>
                  <input
                    type="number"
                    value={formData.standardWorkHours}
                    onChange={(e) => setFormData({ ...formData, standardWorkHours: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">Overtime Rate / hr</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.overtimeRatePerHour}
                      onChange={(e) => setFormData({ ...formData, overtimeRatePerHour: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-700 mb-1">Early Leave Cut / hr</label>
                  <input
                    type="number"
                    value={formData.earlyLeavePenaltyRatePerHour}
                    onChange={(e) => setFormData({ ...formData, earlyLeavePenaltyRatePerHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">Late Arrival Cut / hr</label>
                  <input
                    type="number"
                    value={formData.lateArrivalPenaltyRatePerHour}
                    onChange={(e) => setFormData({ ...formData, lateArrivalPenaltyRatePerHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              {/* Assignment Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Policy Scope (Who does this apply to?)</label>
                <select
                  value={formData.applicableScope}
                  onChange={(e) => setFormData({ ...formData, applicableScope: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="ALL">Global Default (All Employees)</option>
                  <option value="PERMANENT">Permanent Employees Only</option>
                  <option value="SPECIFIC_EMPLOYEE">Specific Individual Employee(s)</option>
                </select>
              </div>

              {/* Specific Employee Selection */}
              {formData.applicableScope === 'SPECIFIC_EMPLOYEE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Employees</label>
                  <select
                    multiple
                    value={formData.assignedEmployees}
                    onChange={(e) => {
                      const options = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData({ ...formData, assignedEmployees: options });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white h-32"
                  >
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.employeeCode} - {emp.firstName} {emp.lastName} ({emp.employeeCategory || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple employees.</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="isDefault" className="text-xs font-medium text-slate-700">
                  Set as default fallback policy for all staff
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  {editingPolicy ? 'Update Policy' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
