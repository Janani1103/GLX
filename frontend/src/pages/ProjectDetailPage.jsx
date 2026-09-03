import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, CheckCircle2, User, Hammer, Package, Wallet, DollarSign, Award, Clock, Plus, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Textarea from '../components/ui/Textarea';
import api from '../api/axios';

const statusVariants = {
    active: 'info',
    delivered: 'success',
    cancelled: 'danger',
};

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState('overview');
    
    // Edit/update states
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('active');
    const [isUpdating, setIsUpdating] = useState(false);

    // Expenses linked to project
    const [projectExpenses, setProjectExpenses] = useState([]);
    
    // Add Expense Modal
    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [expTitle, setExpTitle] = useState('');
    const [expCategory, setExpCategory] = useState('Raw Materials');
    const [expAmount, setExpAmount] = useState(0);
    const [expPaymentMethod, setExpPaymentMethod] = useState('Cash');
    const [expNotes, setExpNotes] = useState('');
    const [isSavingExpense, setIsSavingExpense] = useState(false);

    // Labor logs state
    const [laborLogs, setLaborLogs] = useState([]);

    // Edit Employees Modal
    const [isEditEmployeesOpen, setIsEditEmployeesOpen] = useState(false);
    const [editSelectedEmployees, setEditSelectedEmployees] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);

    const fetchProjectDetails = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/projects/${id}`);
            const proj = res.data?.data;
            setProject(proj);
            setProgress(proj?.progress || 0);
            setStatus(proj?.status || 'active');

            // Fetch expenses linked to project
            const expRes = await api.get(`/expenses?projectId=${id}`);
            setProjectExpenses(expRes.data?.data || []);

            // Calculate labor log breakdown dynamically
            if (proj?.assignedEmployees && proj?.assignedEmployees.length > 0) {
                const startDate = proj.createdAt;
                const endDate = proj.status === 'delivered' ? proj.deliveryDate : new Date().toISOString();
                
                const empIds = proj.assignedEmployees.map(e => e._id);
                // Fetch attendance logs for assigned employees during the project period
                const attRes = await api.get(`/hr/attendance?employeeIds=${empIds.join(',')}&startDate=${startDate}&endDate=${endDate}`);
                const logs = attRes.data?.data || [];
                
                // Group attendance by employee
                const breakdown = proj.assignedEmployees.map(emp => {
                    const empLogs = logs.filter(l => (l.employeeId?._id || l.employeeId) === emp._id);
                    const totalMins = empLogs.reduce((sum, l) => sum + (l.totalWorkedMinutes || 0), 0);
                    const workedHours = +(totalMins / 60).toFixed(2);
                    
                    let cost = 0;
                    let rateText = '';
                    if (emp.basicWageRate && emp.basicWageRate > 0) {
                        cost = workedHours * emp.basicWageRate;
                        rateText = `LKR ${emp.basicWageRate}/hr (Hourly)`;
                    } else if (emp.basicSalary && emp.basicSalary > 0) {
                        const hourlyRate = emp.basicSalary / (26 * 8);
                        cost = workedHours * hourlyRate;
                        rateText = `LKR ${hourlyRate.toFixed(2)}/hr (Monthly Fixed)`;
                    } else {
                        rateText = 'No rate configured';
                    }

                    return {
                        employeeCode: emp.employeeCode,
                        employeeName: `${emp.firstName} ${emp.lastName}`,
                        rateText,
                        workedHours,
                        calculatedCost: +cost.toFixed(2),
                        logs: empLogs
                    };
                });
                setLaborLogs(breakdown);
            }
            // Fetch all active employees
            try {
                const allEmpRes = await api.get('/hr/employees?status=active');
                setAllEmployees(allEmpRes.data?.data || []);
                setEditSelectedEmployees(proj?.assignedEmployees?.map(e => e._id) || []);
            } catch (e) {}
        } catch (err) {
            toast.error('Failed to load project details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjectDetails();
    }, [id]);

    const handleUpdateProject = async () => {
        setIsUpdating(true);
        try {
            await api.put(`/projects/${id}`, { progress: Number(progress), status });
            toast.success('Project status and progress updated');
            fetchProjectDetails();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update project');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeliverProject = async () => {
        if (!window.confirm('Are you sure you want to deliver this project? This will finalize progress to 100% and recalculate final profits.')) return;
        setIsUpdating(true);
        try {
            await api.post(`/projects/${id}/deliver`);
            toast.success('Project delivered successfully!');
            fetchProjectDetails();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to deliver project');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expTitle || expAmount <= 0) {
            toast.error('Please enter expense title and valid amount');
            return;
        }

        setIsSavingExpense(true);
        try {
            const payload = {
                title: expTitle,
                category: expCategory,
                amount: Number(expAmount),
                paymentMethod: expPaymentMethod,
                notes: expNotes,
                projectId: id,
                paymentStatus: 'Paid',
                date: new Date()
            };
            await api.post('/expenses', payload);
            toast.success('Expense logged successfully');
            setIsExpenseOpen(false);
            // Reset
            setExpTitle('');
            setExpAmount(0);
            setExpNotes('');
            fetchProjectDetails();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to log expense');
        } finally {
            setIsSavingExpense(false);
        }
    };

    const handleEditEmployees = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            await api.put(`/projects/${id}`, { assignedEmployees: editSelectedEmployees });
            toast.success('Assigned employees updated successfully');
            setIsEditEmployeesOpen(false);
            fetchProjectDetails();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update employees');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEmployeeCheckboxToggle = (empId) => {
        if (editSelectedEmployees.includes(empId)) {
            setEditSelectedEmployees(editSelectedEmployees.filter(id => id !== empId));
        } else {
            setEditSelectedEmployees([...editSelectedEmployees, empId]);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-LK') : '—';

    if (isLoading || !project) {
        return <div className="text-center py-20 text-gray-500">Loading project details...</div>;
    }

    // Material, labor and expense totals
    const totalMaterialsCost = project.materialCost || 0;
    const totalLaborCost = project.laborCost || 0;
    const totalCashExpenses = project.otherExpenses || 0;
    const totalExpenses = totalMaterialsCost + totalLaborCost + totalCashExpenses;
    const netProfit = project.netProfit || 0;
    const profitMargin = project.quotedPrice > 0 ? (netProfit / project.quotedPrice) * 100 : 0;
    const expensesPercent = project.quotedPrice > 0 ? (totalExpenses / project.quotedPrice) * 100 : 0;

    const materialsColumns = [
        {
            key: 'productCode', label: 'Item Code',
            render: (r) => <span className="font-mono text-xs">{r.product?.productCode || '—'}</span>
        },
        { key: 'productName', label: 'Item Name', render: (r) => r.productName || r.product?.name || '—' },
        { key: 'qty', label: 'Quantity', render: (r) => `${r.qty} ${r.product?.unitOfMeasure || 'pcs'}` },
        { key: 'buyingPrice', label: 'Buying Cost (Unit)', render: (r) => fmt(r.buyingPrice) },
        { key: 'totalCost', label: 'Total Buying Cost', render: (r) => <span className="font-medium text-slate-800">{fmt((r.buyingPrice || 0) * (r.qty || 0))}</span> },
        { key: 'issuedBy', label: 'Issued To', render: (r) => r.issuedBy?.firstName ? `${r.issuedBy.firstName} ${r.issuedBy.lastName}` : '—' },
        { key: 'issuedDate', label: 'Date Issued', render: (r) => fmtDate(r.issuedDate) },
    ];

    const expensesColumns = [
        { key: 'expenseNumber', label: 'Expense #', render: (r) => <span className="font-mono text-xs font-bold">{r.expenseNumber}</span> },
        { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount', render: (r) => <span className="font-semibold text-red-600">{fmt(r.amount)}</span> },
        { key: 'paymentMethod', label: 'Paid via' },
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    ];

    const laborColumns = [
        { key: 'employeeCode', label: 'EMP Code', render: (r) => <span className="font-mono text-xs">{r.employeeCode}</span> },
        { key: 'employeeName', label: 'Employee Name', render: (r) => <span className="font-medium">{r.employeeName}</span> },
        { key: 'rateText', label: 'Wage Rate' },
        { key: 'workedHours', label: 'Hours Worked', render: (r) => `${r.workedHours} hrs` },
        { key: 'calculatedCost', label: 'Labor Cost', render: (r) => <span className="font-semibold text-slate-800">{fmt(r.calculatedCost)}</span> }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Project: ${project.name}`}
                description={`Project Code: ${project.projectNumber} | Customer: ${project.customer?.displayName || 'Walk-in'}`}
                actions={
                    <Button variant="outline" onClick={() => navigate('/crm/projects')}>
                        <ArrowLeft size={16} className="mr-1.5" /> Back
                    </Button>
                }
            />

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <Card className="p-4 bg-slate-50 border flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quoted Price</span>
                    <span className="text-xl font-bold text-slate-800">{fmt(project.quotedPrice)}</span>
                    <span className="text-[10px] text-slate-400 mt-1">Price agreed with customer</span>
                </Card>

                <Card className="p-4 bg-slate-50 border flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Materials (Buying Cost)</span>
                    <span className="text-xl font-bold text-amber-600">{fmt(totalMaterialsCost)}</span>
                    <span className="text-[10px] text-slate-400 mt-1">POS Issued Cost</span>
                </Card>

                <Card className="p-4 bg-slate-50 border flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Labor Cost</span>
                    <span className="text-xl font-bold text-indigo-600">{fmt(totalLaborCost)}</span>
                    <span className="text-[10px] text-slate-400 mt-1">Logs calculated from shifts</span>
                </Card>

                <Card className="p-4 bg-slate-50 border flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cash/Other Expenses</span>
                    <span className="text-xl font-bold text-red-500">{fmt(totalCashExpenses)}</span>
                    <span className="text-[10px] text-slate-400 mt-1">Directly logged expenses</span>
                </Card>

                <Card className={`p-4 border flex flex-col justify-between ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
                    <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(netProfit)}</span>
                    <span className={`text-[10px] font-medium ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} mt-1`}>
                        Margin: {profitMargin.toFixed(1)}%
                    </span>
                </Card>
            </div>

            {/* Progress and status update panel */}
            <Card className="p-3 sm:p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <BarChart2 className="mr-2 text-primary-500" size={18} /> Project Management & Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Project Progress ({progress}%)</label>
                        <div className="flex items-center space-x-4">
                            <input type="range" min="0" max="100" value={progress}
                                onChange={(e) => setProgress(e.target.value)}
                                disabled={project.status === 'delivered'}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Project Status</label>
                        <Select
                            disabled={project.status === 'delivered'}
                            options={[
                                { value: 'active', label: 'Active / In Progress' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {project.status !== 'delivered' && (
                            <>
                                <Button variant="outline" onClick={handleUpdateProject} loading={isUpdating}>
                                    Save Changes
                                </Button>
                                <Button variant="primary" onClick={handleDeliverProject} loading={isUpdating} className="w-full">
                                    <CheckCircle2 size={16} className="mr-1.5" /> Deliver Project
                                </Button>
                            </>
                        )}
                        {project.status === 'delivered' && (
                            <div className="w-full text-center bg-green-50 border border-green-200 text-green-800 rounded-xl py-2 px-4 text-sm font-semibold flex items-center justify-center">
                                <CheckCircle2 size={16} className="mr-1.5" /> Project Fully Delivered & Closed
                            </div>
                        )}
                    </div>
                </div>

                {/* Expenses visual indicator */}
                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-semibold text-slate-600">Expenses vs Quoted Price ({expensesPercent.toFixed(1)}% consumed)</span>
                        <span className="font-bold text-slate-800">{fmt(totalExpenses)} / {fmt(project.quotedPrice)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className={`h-3 rounded-full transition-all ${expensesPercent > 90 ? 'bg-red-500' : expensesPercent > 70 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, expensesPercent)}%` }}></div>
                    </div>
                </div>
            </Card>

            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto">
                {[
                    { id: 'overview', label: 'Overview & Employees', icon: User },
                    { id: 'materials', label: `Materials Issued (${project.materialsIssued?.length || 0})`, icon: Package },
                    { id: 'expenses', label: `Direct Expenses (${projectExpenses.length})`, icon: Wallet },
                    { id: 'labor', label: 'Labor Logs', icon: Hammer },
                ].map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 sm:px-6 py-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-primary-600 text-primary-600 bg-slate-50' : 'border-transparent text-gray-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            <Card className="rounded-t-none p-3 sm:p-6">
                {tab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Project Details</h4>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1 bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px]">
                                    {project.details || 'No description provided.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Yard / Site</span>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{project.yard || '—'}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Delivery Date</span>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{project.deliveryDate ? fmtDate(project.deliveryDate) : 'Pending Delivery'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Assigned Employees */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Assigned Employees</h4>
                                {project.status !== 'delivered' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditSelectedEmployees(project.assignedEmployees?.map(e => e._id) || []);
                                            setIsEditEmployeesOpen(true);
                                        }}
                                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="border rounded-xl p-3 bg-slate-50 divide-y space-y-2">
                                {project.assignedEmployees && project.assignedEmployees.length > 0 ? (
                                    project.assignedEmployees.map(emp => (
                                        <div key={emp._id} className="flex items-center justify-between pt-2 first:pt-0">
                                            <div className="flex items-center space-x-2">
                                                {emp.photoUrl ? (
                                                    <img src={emp.photoUrl} alt="" className="w-8 h-8 rounded-full border" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                                    <p className="text-xs text-gray-500">{emp.employeeCode}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 border rounded-lg">
                                                LKR {emp.basicWageRate || emp.hourlyRate || 0}/hr
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 text-center py-4">No employees assigned.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'materials' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-700">Issued Materials</h4>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">Total Cost: {fmt(totalMaterialsCost)}</span>
                        </div>
                        <Table columns={materialsColumns} data={project.materialsIssued || []}
                            emptyState={<Package size={36} className="mx-auto text-gray-300" />} />
                    </div>
                )}

                {tab === 'expenses' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-700">Direct Cash/Bank Expenses</h4>
                            {project.status !== 'delivered' && (
                                <Button variant="primary" size="sm" onClick={() => setIsExpenseOpen(true)}>
                                    <Plus size={14} className="mr-1" /> Log Expense
                                </Button>
                            )}
                        </div>
                        <Table columns={expensesColumns} data={projectExpenses}
                            emptyState={<Wallet size={36} className="mx-auto text-gray-300" />} />
                    </div>
                )}

                {tab === 'labor' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center">
                                <Clock size={16} className="mr-2 text-indigo-500" /> Labor Summary
                            </h4>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">Total Labor Cost: {fmt(totalLaborCost)}</span>
                        </div>
                        
                        <Table columns={laborColumns} data={laborLogs}
                            emptyState={<Hammer size={36} className="mx-auto text-gray-300" />} />
                    </div>
                )}
            </Card>

            {/* Add Expense Modal */}
            {isExpenseOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl p-6 bg-white">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Log Project Expense</h3>
                            <button onClick={() => setIsExpenseOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">×</button>
                        </div>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <Input label="Expense Title" required value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Transporter payment, lunch allowance" />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select label="Category"
                                    options={[
                                        { value: 'Raw Materials', label: 'Raw Materials' },
                                        { value: 'Transport & Freight', label: 'Transport & Freight' },
                                        { value: 'Fuel & Vehicles', label: 'Fuel & Vehicles' },
                                        { value: 'Welfare & Food', label: 'Welfare & Food' },
                                        { value: 'Miscellaneous', label: 'Miscellaneous' }
                                    ]}
                                    value={expCategory}
                                    onChange={(e) => setExpCategory(e.target.value)}
                                />
                                <Select label="Payment Method"
                                    options={[
                                        { value: 'Cash', label: 'Cash' },
                                        { value: 'Bank Transfer', label: 'Bank Transfer' },
                                        { value: 'Petty Cash', label: 'Petty Cash' }
                                    ]}
                                    value={expPaymentMethod}
                                    onChange={(e) => setExpPaymentMethod(e.target.value)}
                                />
                            </div>

                            <Input label="Amount (LKR)" type="number" required value={expAmount} onChange={(e) => setExpAmount(e.target.value)} min="0.01" step="0.01" />

                            <Textarea label="Notes" rows={2} value={expNotes} onChange={(e) => setExpNotes(e.target.value)} placeholder="Enter details..." />

                            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsExpenseOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={isSavingExpense}>Save Expense</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Edit Employees Modal */}
            {isEditEmployeesOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl p-6 bg-white">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Assign / Edit Employees</h3>
                            <button onClick={() => setIsEditEmployeesOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">×</button>
                        </div>
                        <form onSubmit={handleEditEmployees} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Employees</label>
                                <div className="border border-gray-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-2">
                                    {allEmployees.length > 0 ? (
                                        allEmployees.map(emp => (
                                            <label key={emp._id} className="flex items-center space-x-2 text-sm p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                <input type="checkbox" checked={editSelectedEmployees.includes(emp._id)}
                                                    onChange={() => handleEmployeeCheckboxToggle(emp._id)}
                                                    className="rounded text-primary-600 focus:ring-primary-500 border-gray-300" />
                                                <span>{emp.fullName || `${emp.firstName} ${emp.lastName}`} ({emp.employeeCode})</span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-400 text-center py-4">No active employees found.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsEditEmployeesOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={isUpdating}>Save Changes</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
