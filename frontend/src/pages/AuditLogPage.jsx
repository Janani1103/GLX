import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { format } from 'date-fns';
import {
    Search, Filter, History, User as UserIcon,
    ChevronLeft, ChevronRight, RefreshCw, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const AuditLogPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        module: '',
        action: '',
        userId: '',
    });

    const formatDateSafely = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '—';
            return format(d, 'yyyy-MM-dd HH:mm:ss');
        } catch {
            return '—';
        }
    };

    const getUserName = (performedBy) => {
        if (!performedBy) return 'System';
        if (typeof performedBy === 'object') {
            const name = `${performedBy.firstName || ''} ${performedBy.lastName || ''}`.trim();
            return name || performedBy.email || 'System User';
        }
        return 'System';
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = {
                ...filters,
                page,
                limit: 50
            };
            const res = await api.get('/audit', { params });
            const responseData = res?.data;
            setLogs(Array.isArray(responseData?.data) ? responseData.data : []);
            setTotalPages(responseData?.pages || 1);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            toast.error('Failed to fetch audit logs');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filters]);

    const getActionBadge = (action) => {
        const styles = {
            create: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
            update: 'bg-blue-50 text-blue-700 border border-blue-200',
            delete: 'bg-rose-50 text-rose-700 border border-rose-200',
            export: 'bg-purple-50 text-purple-700 border border-purple-200',
            login: 'bg-slate-100 text-slate-700 border border-slate-200',
            logout: 'bg-slate-100 text-slate-700 border border-slate-200',
        };
        const actKey = (action || '').toLowerCase();
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[actKey] || 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                {action || 'UNKNOWN'}
            </span>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <History className="w-7 h-7 text-indigo-600" />
                        System Audit Logs
                    </h2>
                    <p className="text-sm text-slate-500">Track system activities, data changes, and security events</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700 transition"
                    title="Refresh logs"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Module</label>
                    <select
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filters.module}
                        onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                    >
                        <option value="">All Modules</option>
                        <option value="products">Products & Catalog</option>
                        <option value="customers">Customers & CRM</option>
                        <option value="export">Exports & Reports</option>
                        <option value="auth">Authentication</option>
                        <option value="inventory">Inventory & Stock</option>
                        <option value="finance">Finance & Petty Cash</option>
                        <option value="hr">HR & Payroll</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
                    <select
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                    >
                        <option value="">All Actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="export">Export</option>
                        <option value="login">Login</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Module / Action</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-4">
                                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">No audit logs found matching criteria</td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => (
                                    <tr key={log._id || idx} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                                            {formatDateSafely(log.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
                                                    <UserIcon size={12} className="text-indigo-600" />
                                                </div>
                                                <span className="text-sm font-medium text-slate-800">
                                                    {getUserName(log.performedBy)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-500 capitalize">{log.module || 'System'}</span>
                                                {getActionBadge(log.action)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate" title={log.description}>
                                            {log.description || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                                {log.ipAddress || '127.0.0.1'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <p className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogPage;
