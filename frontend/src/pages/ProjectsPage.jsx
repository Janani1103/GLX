import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, ClipboardList, Briefcase, MapPin, DollarSign, BarChart2, Activity, User } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import CustomerAutocompleteSelect from '../components/ui/CustomerAutocompleteSelect';
import { useEmployees } from '../features/hr/useHr';
import api from '../api/axios';

const statusVariants = {
    active: 'info',
    delivered: 'success',
    cancelled: 'danger',
};

export default function ProjectsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    
    // Modal states
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [yard, setYard] = useState('');
    const [details, setDetails] = useState('');
    const [quotedPrice, setQuotedPrice] = useState(0);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    
    const { data: empData } = useEmployees({ status: 'active' });
    const employees = empData?.data || [];

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/projects?search=${search}&status=${status}`);
            setProjects(res.data?.data || []);
        } catch (err) {
            toast.error('Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [search, status]);

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!name || !customerId) {
            toast.error('Name and Customer are required');
            return;
        }

        try {
            const payload = {
                name,
                customer: customerId,
                yard,
                details,
                quotedPrice: Number(quotedPrice) || 0,
                assignedEmployees: selectedEmployees
            };
            await api.post('/projects', payload);
            toast.success('Project created successfully');
            setIsOpen(false);
            // Reset form
            setName('');
            setCustomerId('');
            setYard('');
            setDetails('');
            setQuotedPrice(0);
            setSelectedEmployees([]);
            fetchProjects();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create project');
        }
    };

    const handleEmployeeToggle = (empId) => {
        if (selectedEmployees.includes(empId)) {
            setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
        } else {
            setSelectedEmployees([...selectedEmployees, empId]);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    // Calculate aggregated metrics
    const totalActive = projects.filter(p => p.status === 'active').length;
    const totalQuoted = projects.reduce((s, p) => s + (p.quotedPrice || 0), 0);
    const totalMaterials = projects.reduce((s, p) => s + (p.materialCost || 0), 0);
    const totalLabor = projects.reduce((s, p) => s + (p.laborCost || 0), 0);
    const totalExpenses = projects.reduce((s, p) => s + (p.otherExpenses || 0), 0);
    const totalNetProfit = projects.reduce((s, p) => s + (p.netProfit || 0), 0);
    const avgProfitMargin = totalQuoted > 0 ? (totalNetProfit / totalQuoted) * 100 : 0;

    const columns = [
        {
            key: 'projectNumber', label: 'Project #', width: '120px',
            render: (r) => <span className="font-mono text-xs font-bold text-gray-800">{r.projectNumber}</span>,
        },
        {
            key: 'name', label: 'Project Name',
            render: (r) => (
                <div>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-gray-500 flex items-center mt-1">
                        <MapPin size={12} className="mr-1" /> {r.yard || 'No Yard'}
                    </p>
                </div>
            ),
        },
        { key: 'customer', label: 'Customer', render: (r) => r.customer?.displayName || '—' },
        { key: 'quotedPrice', label: 'Quoted Price', render: (r) => <span className="font-semibold text-slate-800">{fmt(r.quotedPrice)}</span> },
        {
            key: 'netProfit', label: 'Net Profit',
            render: (r) => (
                <span className={`font-semibold ${r.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(r.netProfit)}
                </span>
            ),
        },
        {
            key: 'progress', label: 'Progress', width: '150px',
            render: (r) => (
                <div className="w-full">
                    <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-medium text-slate-700">{r.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-primary-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${r.progress}%` }}></div>
                    </div>
                </div>
            ),
        },
        {
            key: 'status', label: 'Status',
            render: (r) => <Badge variant={statusVariants[r.status]}>{r.status.toUpperCase()}</Badge>,
        },
        {
            key: 'actions', label: '', width: '50px',
            render: (r) => (
                <button onClick={() => navigate(`/crm/projects/${r._id}`)}
                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all">
                    <Eye size={16} />
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Project Management"
                description="Monitor project progress, yards, material consumption, and profitability"
                actions={
                    <Button variant="primary" onClick={() => setIsOpen(true)}>
                        <Plus size={16} className="mr-1.5" /> New Project
                    </Button>
                }
            />

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-100 flex items-center space-x-4">
                    <div className="p-3 bg-blue-500 text-white rounded-xl shadow-md">
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Projects</p>
                        <p className="text-2xl font-bold text-slate-800">{totalActive}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Total projects: {projects.length}</p>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-md">
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quoted Amount</p>
                        <p className="text-2xl font-bold text-slate-800">{fmt(totalQuoted)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Project sales values</p>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-red-50 to-white border-red-100 flex items-center space-x-4">
                    <div className="p-3 bg-red-500 text-white rounded-xl shadow-md">
                        <Activity size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenses</p>
                        <p className="text-2xl font-bold text-slate-800">{fmt(totalMaterials + totalLabor + totalExpenses)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Materials + Labor + Cash expenses</p>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
                        <BarChart2 size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Net Profit</p>
                        <p className="text-2xl font-bold text-slate-800">{fmt(totalNetProfit)}</p>
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Margin: {avgProfitMargin.toFixed(1)}%</p>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search projects by name, code, yard..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-48">
                        <Select placeholder="All Statuses"
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'delivered', label: 'Delivered' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)} />
                    </div>
                </div>

                <Table columns={columns} data={projects} loading={isLoading}
                    emptyState={<ClipboardList size={40} className="mx-auto text-gray-300" />} />
            </Card>

            {/* New Project Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-xl shadow-2xl p-6 bg-white overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Add New Project</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">×</button>
                        </div>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <Input label="Project Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lorry Body Customisation - WP-1234" />
                            
                            <CustomerAutocompleteSelect
                                label="Customer"
                                required
                                value={customerId}
                                onChange={(val) => setCustomerId(val)}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Yard / Worksite" value={yard} onChange={(e) => setYard(e.target.value)} placeholder="e.g. Yard 1 - Ja-Ela" />
                                <Input label="Estimated Budget / Price (LKR)" type="number" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} min="0" />
                            </div>

                            <Textarea label="Project Details / Description" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Enter details about body dimensions, warranty conditions, paint options..." />

                            {/* Assigned Employees */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign Employees</label>
                                <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                                    {employees.map(emp => (
                                        <label key={emp._id} className="flex items-center space-x-2 text-sm p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                            <input type="checkbox" checked={selectedEmployees.includes(emp._id)}
                                                onChange={() => handleEmployeeToggle(emp._id)}
                                                className="rounded text-primary-600 focus:ring-primary-500 border-gray-300" />
                                            <span>{emp.fullName || emp.displayName}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit">Create Project</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
