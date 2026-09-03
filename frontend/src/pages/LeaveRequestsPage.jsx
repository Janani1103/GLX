import { useState } from 'react';
import { Plus, CheckCircle, XCircle, Ban, Plane, DollarSign, AlertTriangle, Percent, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import {
    useLeaves, useCreateLeave, useLeaveActions, useEmployees,
    useSalaryAdvances, useCreateSalaryAdvance, useAdvanceActions,
} from '../features/hr/useHr';
import { useAuthStore } from '../store/authStore';

const leaveStatusVariant = {
    pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'default',
};

const advanceStatusVariant = {
    pending: 'warning', approved: 'success', rejected: 'danger',
};

export default function LeaveRequestsPage() {
    const { user } = useAuthStore();
    const canApprove = ['admin', 'manager', 'superadmin', 'hr_manager'].includes(user?.role);

    const [activeTab, setActiveTab] = useState('leaves'); // 'leaves' | 'advances'
    const [filters, setFilters] = useState({ status: '', page: 1, limit: 20 });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
    const [actionModal, setActionModal] = useState(null);
    const [advanceActionModal, setAdvanceActionModal] = useState(null);
    const [actionReason, setActionReason] = useState('');

    // Leave Form State
    const [leaveForm, setLeaveForm] = useState({
        employeeId: '', leaveType: 'annual', fromDate: '', toDate: '',
        isHalfDay: false, isUninformed: false, reason: '', uninformedNotes: '',
    });

    // Advance Form State
    const [advanceForm, setAdvanceForm] = useState({
        employeeId: '', advanceType: 'amount', requestedPercentage: 25, amount: 0, reason: '',
    });

    const { data: leavesData } = useLeaves(filters);
    const { data: advancesData } = useSalaryAdvances();
    const { data: empData } = useEmployees({ status: 'active', limit: 500 });

    const createLeaveM = useCreateLeave();
    const leaveActions = useLeaveActions();
    const createAdvanceM = useCreateSalaryAdvance();
    const advanceActions = useAdvanceActions();

    const leaves = leavesData?.data || [];
    const advances = advancesData?.data || [];
    const empList = empData?.data || [];

    const empOptions = empList.map((e) => ({ value: e._id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }));

    // Selected Employee details for advance calculation
    const selectedEmpForAdvance = empList.find(e => e._id === advanceForm.employeeId);
    const calculatedAdvancePreview = () => {
        if (!selectedEmpForAdvance) return 0;
        const base = selectedEmpForAdvance.basicSalary || (selectedEmpForAdvance.labourRate ? (selectedEmpForAdvance.paymentType === 'per_day' ? selectedEmpForAdvance.labourRate * 26 : selectedEmpForAdvance.labourRate * 200) : 0);
        if (advanceForm.advanceType === 'percentage') {
            return +((base * Number(advanceForm.requestedPercentage)) / 100).toFixed(2);
        }
        return Number(advanceForm.amount) || 0;
    };

    const computeDays = () => {
        if (!leaveForm.fromDate || !leaveForm.toDate) return 0;
        if (leaveForm.isHalfDay) return 0.5;
        const from = new Date(leaveForm.fromDate); const to = new Date(leaveForm.toDate);
        return Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
    };

    const submitLeave = async () => {
        if (!leaveForm.employeeId || !leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason) {
            toast.error('All required fields must be filled'); return;
        }
        try {
            await createLeaveM.mutateAsync(leaveForm);
            setIsFormOpen(false);
            setLeaveForm({ employeeId: '', leaveType: 'annual', fromDate: '', toDate: '', isHalfDay: false, isUninformed: false, reason: '', uninformedNotes: '' });
        } catch { }
    };

    const submitAdvance = async () => {
        if (!advanceForm.employeeId) {
            toast.error('Please select an employee'); return;
        }
        const amt = calculatedAdvancePreview();
        if (amt <= 0) {
            toast.error('Advance amount must be greater than 0'); return;
        }
        try {
            await createAdvanceM.mutateAsync({
                ...advanceForm,
                amount: amt,
            });
            setIsAdvanceFormOpen(false);
            setAdvanceForm({ employeeId: '', advanceType: 'amount', requestedPercentage: 25, amount: 0, reason: '' });
        } catch { }
    };

    const handleLeaveAction = async () => {
        const { type, leave } = actionModal;
        try {
            if (type === 'approve') await leaveActions.approve.mutateAsync(leave._id);
            else if (type === 'reject') await leaveActions.reject.mutateAsync({ id: leave._id, reason: actionReason });
            else if (type === 'cancel') await leaveActions.cancel.mutateAsync(leave._id);
            setActionModal(null); setActionReason('');
        } catch { }
    };

    const handleAdvanceAction = async () => {
        const { type, advance } = advanceActionModal;
        try {
            if (type === 'approve') await advanceActions.approve.mutateAsync({ id: advance._id, approvalNotes: actionReason });
            else if (type === 'decline') await advanceActions.decline.mutateAsync({ id: advance._id, rejectedReason: actionReason });
            setAdvanceActionModal(null); setActionReason('');
        } catch { }
    };

    const fmtMoney = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    const leaveColumns = [
        { key: 'leaveNumber', label: 'Ref', render: (r) => <span className="font-mono text-xs">{r.leaveNumber}</span> },
        {
            key: 'employee', label: 'Employee', render: (r) => (
                <div>
                    <p className="font-medium text-sm">{r.employeeName}</p>
                    <p className="text-xs text-gray-500 font-mono">{r.employeeCode}</p>
                </div>
            )
        },
        {
            key: 'type', label: 'Type', render: (r) => (
                <div className="flex items-center gap-1.5">
                    <Badge variant={r.isUninformed ? 'danger' : 'info'}>
                        {r.isUninformed ? '⚠️ Uninformed' : r.leaveType}
                    </Badge>
                </div>
            )
        },
        {
            key: 'dates', label: 'Dates', render: (r) => (
                <div>
                    <p className="text-sm">{new Date(r.fromDate).toLocaleDateString('en-LK')} — {new Date(r.toDate).toLocaleDateString('en-LK')}</p>
                    <p className="text-xs text-gray-500">{r.numberOfDays} day{r.numberOfDays > 1 ? 's' : ''}{r.isHalfDay ? ' (half)' : ''}</p>
                </div>
            )
        },
        { key: 'reason', label: 'Reason & Notes', render: (r) => <span className="text-sm truncate max-w-xs block">{r.reason}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge variant={leaveStatusVariant[r.status]}>{r.status}</Badge> },
        {
            key: 'actions', label: 'Actions', width: '120px', render: (r) => (
                <div className="flex gap-1">
                    {r.status === 'pending' && canApprove && (
                        <>
                            <button onClick={() => setActionModal({ type: 'approve', leave: r })}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded" title="Approve"><CheckCircle size={16} /></button>
                            <button onClick={() => setActionModal({ type: 'reject', leave: r })}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded" title="Reject"><XCircle size={16} /></button>
                        </>
                    )}
                    {['pending', 'approved'].includes(r.status) && (
                        <button onClick={() => setActionModal({ type: 'cancel', leave: r })}
                            className="p-1.5 hover:bg-gray-100 rounded" title="Cancel"><Ban size={16} /></button>
                    )}
                </div>
            )
        },
    ];

    const advanceColumns = [
        {
            key: 'employee', label: 'Employee', render: (r) => (
                <div>
                    <p className="font-medium text-sm">{r.employeeId?.firstName} {r.employeeId?.lastName}</p>
                    <p className="text-xs text-gray-500 font-mono">{r.employeeId?.employeeCode}</p>
                </div>
            )
        },
        { key: 'date', label: 'Requested Date', render: (r) => <span className="text-sm">{new Date(r.date).toLocaleDateString('en-LK')}</span> },
        {
            key: 'type', label: 'Request Type', render: (r) => (
                <Badge variant={r.advanceType === 'percentage' ? 'info' : 'default'}>
                    {r.advanceType === 'percentage' ? `${r.requestedPercentage}% Share` : 'Fixed Amount'}
                </Badge>
            )
        },
        { key: 'amount', label: 'Amount (LKR)', render: (r) => <span className="font-bold text-gray-900">{fmtMoney(r.amount)}</span> },
        { key: 'reason', label: 'Reason', render: (r) => <span className="text-sm text-gray-600">{r.reason || '—'}</span> },
        { key: 'status', label: 'Approval Status', render: (r) => <Badge variant={advanceStatusVariant[r.status]}>{r.status}</Badge> },
        {
            key: 'deduction', label: 'Salary Deduction', render: (r) => (
                <Badge variant={r.isDeducted ? 'success' : 'warning'}>
                    {r.isDeducted ? 'Minus from Salary (Deducted)' : 'Pending Deduction'}
                </Badge>
            )
        },
        {
            key: 'actions', label: 'Actions', width: '120px', render: (r) => (
                <div className="flex gap-1">
                    {r.status === 'pending' && canApprove && (
                        <>
                            <button onClick={() => setAdvanceActionModal({ type: 'approve', advance: r })}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded" title="Approve Advance"><CheckCircle size={16} /></button>
                            <button onClick={() => setAdvanceActionModal({ type: 'decline', advance: r })}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded" title="Decline Advance"><XCircle size={16} /></button>
                        </>
                    )}
                </div>
            )
        },
    ];

    const uninformedLeavesCount = leaves.filter(l => l.isUninformed).length;
    const pendingAdvancesCount = advances.filter(a => a.status === 'pending').length;

    return (
        <div>
            <PageHeader title="Leave & Advance Management (නිවාඩු සහ අත්පිට මුදල් කළමනාකරණය)"
                description="Manage employee leave requests, uninformed absences, and salary advance approvals"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsAdvanceFormOpen(true)}>
                            <DollarSign size={16} className="mr-1.5" /> Request Advance
                        </Button>
                        <Button variant="primary" onClick={() => setIsFormOpen(true)}>
                            <Plus size={16} className="mr-1.5" /> Request Leave
                        </Button>
                    </div>
                } />

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 border-l-4 border-amber-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase">Uninformed Leaves (පූර්ව දැනුම්දීමකින් තොරව ගත්)</p>
                        <p className="text-2xl font-bold text-gray-900">{uninformedLeavesCount}</p>
                    </div>
                    <AlertTriangle className="text-amber-500" size={28} />
                </Card>
                <Card className="p-4 border-l-4 border-blue-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-blue-700 uppercase">Pending Advances (Admin Approval)</p>
                        <p className="text-2xl font-bold text-gray-900">{pendingAdvancesCount}</p>
                    </div>
                    <DollarSign className="text-blue-500" size={28} />
                </Card>
                <Card className="p-4 border-l-4 border-emerald-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase">Total Leave Applications</p>
                        <p className="text-2xl font-bold text-gray-900">{leaves.length}</p>
                    </div>
                    <Plane className="text-emerald-500" size={28} />
                </Card>
            </div>

            <Card>
                <div className="border-b flex gap-2 px-4 overflow-x-auto bg-gray-50/50">
                    <button onClick={() => setActiveTab('leaves')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'leaves' ? 'border-primary-600 text-primary-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}>
                        <Plane size={16} /> Leave Applications (නිවාඩු ඉල්ලීම්)
                    </button>
                    <button onClick={() => setActiveTab('advances')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'advances' ? 'border-primary-600 text-primary-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}>
                        <DollarSign size={16} /> Advance Requests & Approvals (අත්පිට මුදල් ඉල්ලීම්)
                        {pendingAdvancesCount > 0 && <Badge variant="warning" className="ml-1">{pendingAdvancesCount}</Badge>}
                    </button>
                </div>

                {activeTab === 'leaves' && (
                    <>
                        <div className="p-4 border-b flex gap-3">
                            <div className="w-48">
                                <Select placeholder="All Statuses"
                                    options={[
                                        { value: 'pending', label: 'Pending' },
                                        { value: 'approved', label: 'Approved' },
                                        { value: 'rejected', label: 'Rejected' },
                                        { value: 'cancelled', label: 'Cancelled' },
                                    ]}
                                    value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))} />
                            </div>
                        </div>
                        {leaves.length === 0
                            ? <EmptyState icon={Plane} title="No leave requests" description="Submit a leave request" />
                            : <>
                                <Table columns={leaveColumns} data={leaves} />
                                <Pagination page={filters.page} totalPages={leavesData?.totalPages || 1} total={leavesData?.total || 0}
                                    onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
                            </>}
                    </>
                )}

                {activeTab === 'advances' && (
                    <>
                        {advances.length === 0
                            ? <EmptyState icon={DollarSign} title="No advance requests" description="Submit an advance request for an employee" />
                            : <Table columns={advanceColumns} data={advances} />}
                    </>
                )}
            </Card>

            {/* Leave Request Modal */}
            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="New Leave Application (නිවාඩු ඉල්ලුම්පත්‍රය)" size="md">
                <div className="p-6 space-y-4">
                    <Select label="Employee" required placeholder="Select employee..."
                        options={empOptions} value={leaveForm.employeeId}
                        onChange={(e) => setLeaveForm((f) => ({ ...f, employeeId: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Leave Type"
                            options={[
                                { value: 'annual', label: 'Annual (වාර්ෂික)' },
                                { value: 'sick', label: 'Sick (ගිලන්)' },
                                { value: 'casual', label: 'Casual (අනපේක්ෂිත)' },
                                { value: 'uninformed', label: 'Uninformed Leave (පූර්ව දැනුම්දීමකින් තොරව)' },
                                { value: 'maternity', label: 'Maternity' },
                                { value: 'paternity', label: 'Paternity' },
                                { value: 'unpaid', label: 'Unpaid (නොගෙවන)' },
                            ]}
                            value={leaveForm.leaveType} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value }))} />
                        <div className="flex items-end pb-2 gap-4">
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input type="checkbox" checked={leaveForm.isHalfDay}
                                    onChange={(e) => setLeaveForm((f) => ({ ...f, isHalfDay: e.target.checked }))} />
                                Half day
                            </label>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
                        <input type="checkbox" id="uninformedCheck" checked={leaveForm.isUninformed}
                            onChange={(e) => setLeaveForm((f) => ({ ...f, isUninformed: e.target.checked, leaveType: e.target.checked ? 'uninformed' : f.leaveType }))} className="mt-0.5" />
                        <label htmlFor="uninformedCheck" className="cursor-pointer">
                            <strong>Uninformed Leave (පූර්ව දැනුම්දීමකින් තොරව ගත් නිවාඩුවක් ලෙස Track කරන්න):</strong> සේවකයා කල්තියා දැනුම්දීමකින් තොරව ලබාගත් නිවාඩුවක් නම් මෙහි සලකුණු කරන්න.
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="From Date" required type="date" value={leaveForm.fromDate}
                            onChange={(e) => setLeaveForm((f) => ({ ...f, fromDate: e.target.value }))} />
                        <Input label="To Date" required type="date" value={leaveForm.toDate}
                            onChange={(e) => setLeaveForm((f) => ({ ...f, toDate: e.target.value }))} />
                    </div>
                    <p className="text-sm">Total days: <strong>{computeDays()}</strong></p>
                    <Textarea label="Reason / Notes" required rows={3} value={leaveForm.reason}
                        onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={submitLeave} loading={createLeaveM.isPending}>Submit Request</Button>
                </div>
            </Modal>

            {/* Advance Request Modal */}
            <Modal isOpen={isAdvanceFormOpen} onClose={() => setIsAdvanceFormOpen(false)} title="Salary Advance Request (අත්පිට මුදල් ඉල්ලුම්පත්‍රය)" size="md">
                <div className="p-6 space-y-4">
                    <Select label="Employee" required placeholder="Select employee..."
                        options={empOptions} value={advanceForm.employeeId}
                        onChange={(e) => setAdvanceForm((f) => ({ ...f, employeeId: e.target.value }))} />

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Advance Request Mode"
                            options={[
                                { value: 'amount', label: 'Fixed Amount (නියමිත ගණනක්)' },
                                { value: 'percentage', label: 'Percentage / Share % (ප්‍රතිශතයක් ලෙස)' },
                            ]}
                            value={advanceForm.advanceType}
                            onChange={(e) => setAdvanceForm((f) => ({ ...f, advanceType: e.target.value }))} />

                        {advanceForm.advanceType === 'percentage' ? (
                            <Select label="Requested Share (%)"
                                options={[
                                    { value: '10', label: '10% Share' },
                                    { value: '25', label: '25% Share' },
                                    { value: '50', label: '50% Share (Half Salary)' },
                                    { value: '75', label: '75% Share' },
                                ]}
                                value={String(advanceForm.requestedPercentage)}
                                onChange={(e) => setAdvanceForm((f) => ({ ...f, requestedPercentage: Number(e.target.value) }))} />
                        ) : (
                            <Input label="Advance Amount (LKR)" type="number" step="100" min="0" value={advanceForm.amount}
                                onChange={(e) => setAdvanceForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
                        )}
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-900 flex justify-between items-center font-medium">
                        <span>Calculated Advance Payable:</span>
                        <span className="text-lg font-bold text-emerald-700">{fmtMoney(calculatedAdvancePreview())}</span>
                    </div>

                    <Textarea label="Reason / Notes" rows={2} placeholder="Emergency advance request..." value={advanceForm.reason}
                        onChange={(e) => setAdvanceForm((f) => ({ ...f, reason: e.target.value }))} />
                    <div className="text-xs text-gray-500">
                        ℹ️ Admin approval threshold applies. Approved advance will be auto-deducted from ongoing salary during payroll run.
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => setIsAdvanceFormOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={submitAdvance} loading={createAdvanceM.isPending}>Submit Advance Request</Button>
                </div>
            </Modal>

            {/* Action Modal for Leave */}
            <Modal isOpen={!!actionModal} onClose={() => { setActionModal(null); setActionReason(''); }}
                title={actionModal?.type === 'approve' ? 'Approve Leave' : actionModal?.type === 'reject' ? 'Reject Leave' : 'Cancel Leave'} size="md">
                <div className="p-6 space-y-4">
                    {actionModal?.type === 'reject' ? (
                        <Textarea label="Rejection Reason" required rows={3} value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)} />
                    ) : (
                        <p>{actionModal?.type === 'approve'
                            ? `Approve ${actionModal?.leave?.numberOfDays} day(s) of ${actionModal?.leave?.leaveType} leave for ${actionModal?.leave?.employeeName}?`
                            : `Cancel this leave request?`}</p>
                    )}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => { setActionModal(null); setActionReason(''); }}>Close</Button>
                    <Button variant={actionModal?.type === 'reject' ? 'danger' : 'primary'} onClick={handleLeaveAction}
                        loading={leaveActions.approve.isPending || leaveActions.reject.isPending || leaveActions.cancel.isPending}>
                        Confirm
                    </Button>
                </div>
            </Modal>

            {/* Action Modal for Advance */}
            <Modal isOpen={!!advanceActionModal} onClose={() => { setAdvanceActionModal(null); setActionReason(''); }}
                title={advanceActionModal?.type === 'approve' ? 'Approve Advance Request' : 'Decline Advance Request'} size="md">
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-700">
                        {advanceActionModal?.type === 'approve'
                            ? `Approve advance of ${fmtMoney(advanceActionModal?.advance?.amount)} for ${advanceActionModal?.advance?.employeeId?.firstName}?`
                            : `Decline advance request of ${fmtMoney(advanceActionModal?.advance?.amount)}?`}
                    </p>
                    <Textarea label="Admin Notes / Reason" rows={2} placeholder="Optional notes..." value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => { setAdvanceActionModal(null); setActionReason(''); }}>Close</Button>
                    <Button variant={advanceActionModal?.type === 'decline' ? 'danger' : 'primary'} onClick={handleAdvanceAction}
                        loading={advanceActions.approve.isPending || advanceActions.decline.isPending}>
                        Confirm {advanceActionModal?.type === 'approve' ? 'Approval' : 'Decline'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}