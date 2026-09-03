import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Wrench, Plus } from 'lucide-react';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { useRepairs } from '../features/returns/useReturns';
import { useAuthStore } from '../store/authStore';

const statusVariant = {
    pending: 'default', in_progress: 'warning', awaiting_parts: 'warning',
    completed_fixed: 'success', completed_unfixable: 'danger', cancelled: 'default',
};

export default function RepairsPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const canCreate = ['admin', 'manager', 'warehouse_manager', 'technician'].includes(user?.role);

    const [filters, setFilters] = useState({ status: '', page: 1, limit: 15 });
    const { data, isLoading } = useRepairs(filters);
    const repairs = data?.data || [];

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-LK');

    const columns = [
        { key: 'repairNumber', label: 'Ref #', render: (r) => <span className="font-mono text-xs">{r.repairNumber}</span> },
        { key: 'createdAt', label: 'Date', render: (r) => fmtDate(r.createdAt) },
        { key: 'product', label: 'Product', render: (r) => r.productName },
        { key: 'quantity', label: 'Qty', render: (r) => r.quantity },
        { key: 'issue', label: 'Issue', render: (r) => <span className="text-sm truncate max-w-xs block">{r.issueDescription}</span> },
        { key: 'cost', label: 'Total Cost', render: (r) => fmt(r.totalActualCost) },
        { key: 'status', label: 'Status', render: (r) => <Badge variant={statusVariant[r.status]}>{r.status.replace(/_/g, ' ')}</Badge> },
        {
            key: 'actions', label: '', width: '50px', render: (r) => (
                <button onClick={() => navigate(`/repairs/${r._id}`)} className="p-1.5 hover:bg-gray-100 rounded"><Eye size={16} /></button>
            )
        },
    ];

    return (
        <div>
            <PageHeader title="Repairs Workshop" description="Track items being repaired"
                actions={canCreate && (
                    <Button variant="primary" onClick={() => navigate('/repairs/new')}>
                        <Plus size={16} className="mr-1.5" /> Add Repair
                    </Button>
                )} />
            <Card>
                <div className="p-4 border-b flex gap-3">
                    <div className="w-48">
                        <Select placeholder="All Statuses"
                            options={[
                                { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' },
                                { value: 'awaiting_parts', label: 'Awaiting Parts' }, { value: 'completed_fixed', label: 'Fixed' },
                                { value: 'completed_unfixable', label: 'Unfixable' },
                            ]}
                            value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))} />
                    </div>
                </div>
                {isLoading ? <div className="py-16 text-center text-gray-500">Loading...</div>
                    : repairs.length === 0 ? <EmptyState icon={Wrench} title="No repairs" description="Repairs are created when damages or returns have disposition 'Send to repair'" />
                        : <><Table columns={columns} data={repairs} onRowClick={(r) => navigate(`/repairs/${r._id}`)} />
                            <Pagination page={filters.page} totalPages={data?.totalPages || 1} total={data?.total || 0}
                                onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} /></>}
            </Card>
        </div>
    );
}