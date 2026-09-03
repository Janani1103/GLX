import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    Calendar, Clock, DollarSign, CheckCircle2, AlertCircle,
    Building2, ChevronLeft, ChevronRight, Check, Search, Download, Filter, Sparkles
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { usePermission } from '../hooks/usePermission';

export default function DailyPayrollPage() {
    const queryClient = useQueryClient();
    const { hasPermission, isAdmin } = usePermission();
    const canManagePayroll = isAdmin || hasPermission('hr.payroll.manage');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'history'

    // Bulk selection state
    const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
    const [bulkProjectId, setBulkProjectId] = useState('');
    const [bulkPaymentMethod, setBulkPaymentMethod] = useState('cash');
    const [bulkBankAccountId, setBulkBankAccountId] = useState('');

    // Modal Payout state for single worker
    const [singlePayoutWorker, setSinglePayoutWorker] = useState(null);
    const [singleNetPaid, setSingleNetPaid] = useState(0);
    const [singleProjectId, setSingleProjectId] = useState('');
    const [singlePaymentMethod, setSinglePaymentMethod] = useState('cash');
    const [singleBankAccountId, setSingleBankAccountId] = useState('');
    const [singleNotes, setSingleNotes] = useState('');

    // History filter
    const [historySearch, setHistorySearch] = useState('');

    // Bi-Monthly Date Cycle Payout State
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const [periodStartDate, setPeriodStartDate] = useState(`${currentYear}-${currentMonthStr}-01`);
    const [periodEndDate, setPeriodEndDate] = useState(`${currentYear}-${currentMonthStr}-15`);
    const [bimonthlyPaymentMethod, setBimonthlyPaymentMethod] = useState('cash');
    const [bimonthlyBankAccountId, setBimonthlyBankAccountId] = useState('');

    const { data: periodSummaryData, isLoading: isPeriodLoading, refetch: refetchPeriodSummary } = useQuery({
        queryKey: ['periodPayrollSummary', periodStartDate, periodEndDate],
        queryFn: async () => {
            const { data } = await api.get(`/payroll/period-summary?startDate=${periodStartDate}&endDate=${periodEndDate}`);
            return data;
        },
        enabled: activeTab === 'bimonthly'
    });

    const handleProcessPeriodBatchSubmit = () => {
        const periodDataList = periodSummaryData?.data || [];
        if (!periodDataList.length) {
            toast.error('No employee work records found for this period');
            return;
        }

        const payload = {
            date: periodEndDate,
            payouts: periodDataList.map(p => ({
                employeeId: p.employeeId,
                employeeCode: p.employeeCode,
                employeeName: p.employeeName,
                payType: 'hourly',
                rate: p.hourlyRate,
                units: p.workedHours,
                overtimeHours: p.overtimeHours,
                allowances: 0,
                deductions: p.totalAdvanceDeduction,
                netPaid: p.netPayable,
                paymentMethod: bimonthlyPaymentMethod,
                bankAccountId: bimonthlyPaymentMethod !== 'cash' ? (bimonthlyBankAccountId || undefined) : undefined,
                notes: `Bi-Monthly Payout (${periodStartDate} to ${periodEndDate}) - Advance Deducted: Rs.${p.totalAdvanceDeduction}`
            }))
        };
        payoutMutation.mutate(payload);
    };

    // ─── FETCH DAILY SUMMARY ───
    const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
        queryKey: ['dailyPayrollSummary', selectedDate],
        queryFn: async () => {
            const { data } = await api.get(`/payroll/daily-summary?date=${selectedDate}`);
            return data;
        }
    });

    // ─── FETCH HISTORY ───
    const { data: historyData, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['dailyPayrollHistory', historySearch],
        queryFn: async () => {
            const { data } = await api.get(`/payroll/daily-history?search=${historySearch}`);
            return data;
        },
        enabled: activeTab === 'history'
    });

    const workers = summaryData?.workers || [];
    const activeProjects = summaryData?.activeProjects || [];
    const bankAccounts = summaryData?.bankAccounts || [];
    const historyList = historyData?.data || [];

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    // Summary calculations
    const totalWorkers = workers.length;
    const totalWagesPayable = workers.reduce((sum, w) => sum + (w.baseWage || 0), 0);
    const totalPaidToday = workers.filter(w => w.alreadyPaid).reduce((sum, w) => sum + (w.paymentDetails?.netPaid || w.baseWage || 0), 0);
    const pendingWorkers = workers.filter(w => !w.alreadyPaid);

    // ─── PAYOUT MUTATION ───
    const payoutMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await api.post('/payroll/daily-payout', payload);
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Daily wage payout processed successfully!');
            setSelectedWorkerIds([]);
            setSinglePayoutWorker(null);
            queryClient.invalidateQueries({ queryKey: ['dailyPayrollSummary'] });
            queryClient.invalidateQueries({ queryKey: ['periodPayrollSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dailyPayrollHistory'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to process daily wage payout');
        }
    });

    // Handle single worker payout
    const handleSinglePayoutSubmit = (e) => {
        e.preventDefault();
        if (!singlePayoutWorker) return;
        const finalPayAmount = Number(singleNetPaid) > 0 ? Number(singleNetPaid) : (singlePayoutWorker.baseWage || singlePayoutWorker.rate || 0);
        if (finalPayAmount <= 0) {
            toast.error('Enter a valid payout amount');
            return;
        }

        const payload = {
            date: selectedDate,
            payouts: [{
                employeeId: singlePayoutWorker.employeeId,
                employeeCode: singlePayoutWorker.employeeCode,
                employeeName: singlePayoutWorker.employeeName,
                payType: singlePayoutWorker.payType,
                rate: singlePayoutWorker.rate,
                units: singlePayoutWorker.units || 1,
                overtimeHours: singlePayoutWorker.overtimeHours,
                overtimeAmount: 0,
                allowances: 0,
                deductions: 0,
                netPaid: finalPayAmount,
                paymentMethod: singlePaymentMethod,
                bankAccountId: singlePaymentMethod !== 'cash' ? (singleBankAccountId || undefined) : undefined,
                projectId: singleProjectId || undefined,
                notes: singleNotes || undefined
            }]
        };
        payoutMutation.mutate(payload);
    };

    // Handle bulk payout
    const handleBulkPayoutSubmit = () => {
        const selectedList = workers.filter(w => selectedWorkerIds.includes(w.employeeId.toString()) && !w.alreadyPaid && w.baseWage > 0);
        if (!selectedList.length) {
            toast.error('No unpaid workers selected');
            return;
        }

        const payload = {
            date: selectedDate,
            payouts: selectedList.map(w => ({
                employeeId: w.employeeId,
                employeeCode: w.employeeCode,
                employeeName: w.employeeName,
                payType: w.payType,
                rate: w.rate,
                units: w.units,
                overtimeHours: w.overtimeHours,
                netPaid: w.baseWage,
                paymentMethod: bulkPaymentMethod,
                bankAccountId: bulkPaymentMethod !== 'cash' ? (bulkBankAccountId || undefined) : undefined,
                projectId: bulkProjectId || undefined,
                notes: `Bulk Daily Wage Payout for ${selectedDate}`
            }))
        };
        payoutMutation.mutate(payload);
    };

    // Quick date changes
    const changeDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <PageHeader
                title="Daily Wages & Attendance Payout"
                description="Process daily and hourly wage payments, link labor costs to active projects, and log cash/bank vouchers."
                actions={
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border shadow-xs">
                        <Button variant="outline" size="sm" onClick={() => changeDate(-1)}><ChevronLeft size={16} /></Button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="text-xs font-bold text-gray-800 bg-transparent outline-none px-2 font-mono cursor-pointer"
                        />
                        <Button variant="outline" size="sm" onClick={() => changeDate(1)}><ChevronRight size={16} /></Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className="text-xs font-bold"
                        >
                            Today
                        </Button>
                    </div>
                }
            />

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 bg-white border border-gray-100 shadow-xs rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Daily Workers Active</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{totalWorkers}</p>
                        </div>
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Clock size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Daily & Hourly wage earners</p>
                </Card>

                <Card className="p-4 bg-white border border-gray-100 shadow-xs rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Wages Payable ({selectedDate})</p>
                            <p className="text-2xl font-black text-amber-600 mt-1">{fmt(totalWagesPayable)}</p>
                        </div>
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Calculated from today's attendance</p>
                </Card>

                <Card className="p-4 bg-white border border-gray-100 shadow-xs rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Paid Today</p>
                            <p className="text-2xl font-black text-emerald-600 mt-1">{fmt(totalPaidToday)}</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
                        ✓ Disbursed & Logged
                    </p>
                </Card>

                <Card className="p-4 bg-white border border-gray-100 shadow-xs rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pending Payouts</p>
                            <p className="text-2xl font-black text-rose-600 mt-1">{pendingWorkers.length}</p>
                        </div>
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-rose-500 mt-2 font-medium">Awaiting disbursement</p>
                </Card>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto no-scrollbar gap-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'daily'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <Calendar size={15} /> Daily Payouts ({selectedDate})
                </button>
                <button
                    onClick={() => setActiveTab('bimonthly')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'bimonthly'
                            ? 'bg-purple-900 text-white shadow-md font-black'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <Clock size={15} /> Bi-Monthly / Period Payout (මාසික පඩි දවස් 2ක එකතුව)
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'history'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <DollarSign size={15} /> Daily Payout History & Vouchers
                </button>
            </div>

            {/* TAB 1: DAILY PAYOUT TABLE */}
            {activeTab === 'daily' && (
                <Card className="p-3 sm:p-5 space-y-4">
                    {/* Bulk Action Controls */}
                    {selectedWorkerIds.length > 0 && (
                        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-fadeIn">
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                                    {selectedWorkerIds.length} Selected
                                </span>
                                <span className="text-xs text-slate-300">
                                    Total Payout: <strong className="text-emerald-400 font-mono">{fmt(
                                        workers.filter(w => selectedWorkerIds.includes(w.employeeId.toString()) && !w.alreadyPaid).reduce((s, w) => s + w.baseWage, 0)
                                    )}</strong>
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <select
                                    value={bulkProjectId}
                                    onChange={(e) => setBulkProjectId(e.target.value)}
                                    className="bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl outline-none"
                                >
                                    <option value="">-- Optional: Assign Project --</option>
                                    {activeProjects.map(p => (
                                        <option key={p._id} value={p._id}>{p.projectNumber} - {p.name}</option>
                                    ))}
                                </select>

                                <select
                                    value={bulkPaymentMethod}
                                    onChange={(e) => setBulkPaymentMethod(e.target.value)}
                                    className="bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl outline-none capitalize"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                </select>

                                {bulkPaymentMethod !== 'cash' && (
                                    <select
                                        value={bulkBankAccountId}
                                        onChange={(e) => setBulkBankAccountId(e.target.value)}
                                        className="bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl outline-none"
                                    >
                                        <option value="">-- Select Bank Account --</option>
                                        {bankAccounts.map(b => (
                                            <option key={b._id} value={b._id}>{b.bankName} ({fmt(b.balance)})</option>
                                        ))}
                                    </select>
                                )}

                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleBulkPayoutSubmit}
                                    loading={payoutMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                >
                                    Confirm Bulk Payout
                                </Button>
                            </div>
                        </div>
                    )}

                    {isSummaryLoading ? (
                        <div className="py-16 text-center text-gray-500 font-medium">Loading daily wage summary...</div>
                    ) : workers.length === 0 ? (
                        <div className="py-16 text-center space-y-2">
                            <Clock className="mx-auto text-gray-300" size={40} />
                            <p className="font-bold text-gray-700">No Daily / Hourly Wage Workers Found</p>
                            <p className="text-xs text-gray-400">Ensure employees have salary frequency set to 'daily' or 'hourly' under Employee Settings.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b">
                                        <th className="p-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedWorkerIds.length === pendingWorkers.length && pendingWorkers.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedWorkerIds(pendingWorkers.map(w => w.employeeId.toString()));
                                                    } else {
                                                        setSelectedWorkerIds([]);
                                                    }
                                                }}
                                                className="rounded"
                                            />
                                        </th>
                                        <th className="p-3">Employee</th>
                                        <th className="p-3">Pay Type</th>
                                        <th className="p-3">Rate</th>
                                        <th className="p-3">Attendance ({selectedDate})</th>
                                        <th className="p-3">Units Worked</th>
                                        <th className="p-3 font-mono">Today's Wage</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                                    {workers.map((w) => {
                                        const isChecked = selectedWorkerIds.includes(w.employeeId.toString());
                                        return (
                                            <tr key={w.employeeId} className={`hover:bg-slate-50 transition ${w.alreadyPaid ? 'bg-emerald-50/30' : ''}`}>
                                                <td className="p-3">
                                                    {!w.alreadyPaid && w.baseWage > 0 && (
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedWorkerIds([...selectedWorkerIds, w.employeeId.toString()]);
                                                                } else {
                                                                    setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== w.employeeId.toString()));
                                                                }
                                                            }}
                                                            className="rounded"
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-900">{w.employeeName}</div>
                                                    <div className="text-[11px] text-gray-500 font-mono">{w.employeeCode} · {w.designation}</div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${w.payType === 'hourly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {w.payType}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono">
                                                    {fmt(w.rate)} / {w.payType === 'hourly' ? 'hr' : 'day'}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        w.attendanceStatus === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                                        w.attendanceStatus === 'half_day' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {w.attendanceStatus.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono font-bold">
                                                    {w.units} {w.payType === 'hourly' ? 'hrs' : 'day(s)'}
                                                </td>
                                                <td className="p-3 font-mono font-bold text-slate-900">
                                                    {fmt(w.baseWage)}
                                                </td>
                                                <td className="p-3">
                                                    {w.alreadyPaid ? (
                                                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-max">
                                                            <Check size={12} /> Paid ({w.paymentDetails?.voucherNumber})
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                            Unpaid
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {!w.alreadyPaid ? (
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSinglePayoutWorker(w);
                                                                setSingleNetPaid(w.baseWage || w.rate || 0);
                                                                setSingleProjectId('');
                                                                setSinglePaymentMethod('cash');
                                                                setSingleBankAccountId('');
                                                                setSingleNotes('');
                                                            }}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                                        >
                                                            Pay Today
                                                        </Button>
                                                    ) : (
                                                        <span className="text-emerald-600 text-xs font-bold">✓ Complete</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* TAB 2: PAYOUT HISTORY */}
            {activeTab === 'history' && (
                <Card className="p-3 sm:p-5 space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-3 sm:gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by voucher # or worker name..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                            />
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                            Total Disbursed: <strong className="text-emerald-600 font-mono text-sm">{fmt(historyData?.totalPaid)}</strong>
                        </span>
                    </div>

                    {isHistoryLoading ? (
                        <div className="py-16 text-center text-gray-500">Loading payout history...</div>
                    ) : historyList.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 font-medium">No historical daily wage payouts logged.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b">
                                        <th className="p-3">Voucher #</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Employee</th>
                                        <th className="p-3">Units</th>
                                        <th className="p-3 font-mono">Net Paid</th>
                                        <th className="p-3">Method</th>
                                        <th className="p-3">Linked Project</th>
                                        <th className="p-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {historyList.map(h => (
                                        <tr key={h._id} className="hover:bg-slate-50 transition">
                                            <td className="p-3 font-mono font-bold text-blue-700">{h.voucherNumber}</td>
                                            <td className="p-3">{new Date(h.date).toLocaleDateString('en-GB')}</td>
                                            <td className="p-3 font-bold text-gray-900">{h.employeeName} ({h.employeeCode})</td>
                                            <td className="p-3 font-mono">{h.units} {h.payType === 'hourly' ? 'hrs' : 'days'}</td>
                                            <td className="p-3 font-mono font-bold text-emerald-700">{fmt(h.netPaid)}</td>
                                            <td className="p-3 uppercase font-bold text-[10px] text-gray-600">{h.paymentMethod}</td>
                                            <td className="p-3">
                                                {h.projectId ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                        {h.projectId.projectNumber} - {h.projectId.name}
                                                    </span>
                                                ) : <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="p-3 text-gray-500">{h.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* TAB 3: BI-MONTHLY / PERIOD PAYOUT SUMMARY */}
            {activeTab === 'bimonthly' && (
                <Card className="p-3 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
                        <div>
                            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-600" />
                                Bi-Monthly & Period Payroll Processing (මාසික පඩි දවස් 2ක එකතුව)
                            </h2>
                            <p className="text-xs text-gray-500">
                                Aggregates employee daily worked hours and wages for 1st-15th or 16th-End payout cycles, and auto-deducts pending employee advances.
                            </p>
                        </div>

                        {/* Date Range Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs">
                                <span className="font-bold text-gray-500 pl-1">From:</span>
                                <input
                                    type="date"
                                    value={periodStartDate}
                                    onChange={(e) => setPeriodStartDate(e.target.value)}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold"
                                />
                                <span className="font-bold text-gray-500">To:</span>
                                <input
                                    type="date"
                                    value={periodEndDate}
                                    onChange={(e) => setPeriodEndDate(e.target.value)}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold"
                                />
                            </div>

                            {/* Preset Buttons */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (periodSummaryData?.systemAttendanceRange?.minDate) {
                                        setPeriodStartDate(periodSummaryData.systemAttendanceRange.minDate);
                                        setPeriodEndDate(periodSummaryData.systemAttendanceRange.maxDate || new Date().toISOString().split('T')[0]);
                                    } else {
                                        setPeriodStartDate('2024-01-01');
                                        setPeriodEndDate(new Date().toISOString().split('T')[0]);
                                    }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1"
                            >
                                <Sparkles size={13} /> ⚡ Auto-Detect All Unpaid Work
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodStartDate(`${currentYear}-${currentMonthStr}-01`);
                                    setPeriodEndDate(`${currentYear}-${currentMonthStr}-15`);
                                }}
                                className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                1st–15th (1st Half)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const lastDay = new Date(currentYear, now.getMonth() + 1, 0).getDate();
                                    setPeriodStartDate(`${currentYear}-${currentMonthStr}-16`);
                                    setPeriodEndDate(`${currentYear}-${currentMonthStr}-${lastDay}`);
                                }}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                16th–End (2nd Half)
                            </button>
                        </div>
                    </div>

                    {periodSummaryData?.systemAttendanceRange && (
                        <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-xs text-purple-900 flex items-center justify-between">
                            <span>📍 <strong>Attendance Records Found in System:</strong> {periodSummaryData.systemAttendanceRange.minDate} to {periodSummaryData.systemAttendanceRange.maxDate}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodStartDate(periodSummaryData.systemAttendanceRange.minDate);
                                    setPeriodEndDate(periodSummaryData.systemAttendanceRange.maxDate);
                                }}
                                className="font-bold underline text-purple-700 hover:text-purple-950"
                            >
                                Select Entire Range
                            </button>
                        </div>
                    )}

                    {isPeriodLoading ? (
                        <div className="text-center py-12 text-gray-400">Loading bi-monthly attendance & advance summary...</div>
                    ) : !periodSummaryData?.data?.length ? (
                        <div className="text-center py-12 text-gray-500 text-sm space-y-3">
                            <p className="font-medium">No attendance records or worked hours found for period <strong>{periodStartDate}</strong> to <strong>{periodEndDate}</strong>.</p>
                            <Button
                                variant="primary"
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                onClick={() => {
                                    if (periodSummaryData?.systemAttendanceRange?.minDate) {
                                        setPeriodStartDate(periodSummaryData.systemAttendanceRange.minDate);
                                        setPeriodEndDate(periodSummaryData.systemAttendanceRange.maxDate);
                                    } else {
                                        setPeriodStartDate('2024-01-01');
                                        setPeriodEndDate(new Date().toISOString().split('T')[0]);
                                    }
                                }}
                            >
                                <Sparkles size={14} className="mr-1.5" /> Auto-Detect Available Work Dates & Load
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100">
                                    <p className="text-[10px] font-bold text-purple-600 uppercase">Active Employees</p>
                                    <p className="text-xl font-black text-purple-900">{periodSummaryData.data.length}</p>
                                </div>
                                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase">Gross Wages Earned</p>
                                    <p className="text-xl font-black text-blue-900 font-mono">
                                        {fmt(periodSummaryData.data.reduce((acc, p) => acc + (p.grossWage || 0), 0))}
                                    </p>
                                </div>
                                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                                    <p className="text-[10px] font-bold text-rose-600 uppercase">Advance Deductions</p>
                                    <p className="text-xl font-black text-rose-900 font-mono">
                                        -{fmt(periodSummaryData.data.reduce((acc, p) => acc + (p.totalAdvanceDeduction || 0), 0))}
                                    </p>
                                </div>
                                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Net Period Payable</p>
                                    <p className="text-xl font-black text-emerald-900 font-mono">
                                        {fmt(periodSummaryData.data.reduce((acc, p) => acc + (p.netPayable || 0), 0))}
                                    </p>
                                </div>
                            </div>

                            {/* Batch Disbursement Controls */}
                            <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
                                <div>
                                    <p className="font-bold text-sm">Disburse Bi-Monthly Period Salary Batch</p>
                                    <p className="text-xs text-slate-400">Process payouts for all {periodSummaryData.data.length} workers & auto-deduct pending advances</p>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <select
                                        value={bimonthlyPaymentMethod}
                                        onChange={(e) => setBimonthlyPaymentMethod(e.target.value)}
                                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white"
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                    </select>

                                    {bimonthlyPaymentMethod !== 'cash' && (
                                        <select
                                            value={bimonthlyBankAccountId}
                                            onChange={(e) => setBimonthlyBankAccountId(e.target.value)}
                                            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white"
                                        >
                                            <option value="">Select Bank Account</option>
                                            {bankAccounts.map(b => (
                                                <option key={b._id} value={b._id}>{b.bankName} - {b.accountNumber}</option>
                                            ))}
                                        </select>
                                    )}

                                    <Button
                                        variant="primary"
                                        size="sm"
                                        loading={payoutMutation.isPending}
                                        onClick={handleProcessPeriodBatchSubmit}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2"
                                    >
                                        Process Batch Payout ({fmt(periodSummaryData.data.reduce((acc, p) => acc + (p.netPayable || 0), 0))})
                                    </Button>
                                </div>
                            </div>

                            {/* Period Summary Table */}
                            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b">
                                        <tr>
                                            <th className="p-3">Employee</th>
                                            <th className="p-3">Department</th>
                                            <th className="p-3 text-center">Days Worked</th>
                                            <th className="p-3 text-right">Worked Hours</th>
                                            <th className="p-3 text-right">Hourly Rate</th>
                                            <th className="p-3 text-right">Gross Wage</th>
                                            <th className="p-3 text-right">Advance Deducted</th>
                                            <th className="p-3 text-right">Net Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {periodSummaryData.data.map(p => (
                                            <tr key={p.employeeId} className="hover:bg-slate-50 transition">
                                                <td className="p-3 font-bold text-gray-900">{p.employeeName} ({p.employeeCode})</td>
                                                <td className="p-3 text-gray-500">{p.department}</td>
                                                <td className="p-3 text-center font-semibold">{p.daysWorked} days</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-700">{p.workedHours} hrs</td>
                                                <td className="p-3 text-right font-mono text-gray-600">Rs. {p.hourlyRate}/hr</td>
                                                <td className="p-3 text-right font-mono font-semibold text-gray-900">{fmt(p.grossWage)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-rose-600">
                                                    {p.totalAdvanceDeduction > 0 ? `-${fmt(p.totalAdvanceDeduction)}` : 'Rs. 0.00'}
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/50">
                                                    {fmt(p.netPayable)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* SINGLE WORKER PAYOUT MODAL */}
            {singlePayoutWorker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
                        <div className="flex justify-between items-center border-b pb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Daily Wage Payout</h3>
                                <p className="text-xs text-gray-500">{singlePayoutWorker.employeeName} ({singlePayoutWorker.employeeCode})</p>
                            </div>
                            <button onClick={() => setSinglePayoutWorker(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                        </div>

                        <form onSubmit={handleSinglePayoutSubmit} className="space-y-4">
                            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-emerald-900 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold uppercase">Base Rate / Calculation</p>
                                    <p className="text-[11px] text-emerald-700">{singlePayoutWorker.units || 1} {singlePayoutWorker.payType === 'hourly' ? 'hours' : 'days'} @ {fmt(singlePayoutWorker.rate)}</p>
                                </div>
                                <span className="text-xl font-black font-mono">{fmt(singlePayoutWorker.baseWage || singlePayoutWorker.rate)}</span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase">Payout Amount (LKR) *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="0.01"
                                    value={singleNetPaid}
                                    onChange={(e) => setSingleNetPaid(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold font-mono bg-white outline-none focus:border-slate-900"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase">Payment Method</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {['cash', 'bank_transfer', 'cheque'].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setSinglePaymentMethod(m)}
                                            className={`py-1.5 px-2 rounded-xl text-xs font-bold border capitalize transition ${
                                                singlePaymentMethod === m
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {m.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {singlePaymentMethod !== 'cash' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Bank Account *</label>
                                    <select
                                        required
                                        value={singleBankAccountId}
                                        onChange={(e) => setSingleBankAccountId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:border-slate-900 outline-none"
                                    >
                                        <option value="">-- Select Bank Account --</option>
                                        {bankAccounts.map((acc) => (
                                            <option key={acc._id} value={acc._id}>
                                                {acc.bankName} - {acc.accountNumber} ({fmt(acc.balance)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase">Link to Project (Labor Expense)</label>
                                <select
                                    value={singleProjectId}
                                    onChange={(e) => setSingleProjectId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:border-slate-900 outline-none"
                                >
                                    <option value="">-- Optional: No Project Assignment --</option>
                                    {activeProjects.map((p) => (
                                        <option key={p._id} value={p._id}>
                                            {p.projectNumber} - {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase">Notes / Voucher Remark</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Daily wage payout for welding work"
                                    value={singleNotes}
                                    onChange={(e) => setSingleNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button type="button" variant="outline" onClick={() => setSinglePayoutWorker(null)}>Cancel</Button>
                                <Button type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" loading={payoutMutation.isPending}>
                                    Confirm Payout
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
