import { useState } from 'react';
import { 
    Download, FileSpreadsheet, FileText, CheckCircle, 
    AlertCircle, RefreshCw, Calendar, ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const EXPORT_MODULES = [
    {
        id: 'pnl',
        title: 'Daily P&L Master',
        description: 'Complete Profit & Loss report, including revenue totals, inventory costs, and operating overheads.',
        endpoint: '/export/pnl',
        filename: 'profit_and_loss_report.xlsx'
    },
    {
        id: 'petty-cash',
        title: 'Petty Cash Ledger',
        description: 'Comprehensive cash disbursements logs, category-wise breakdowns, and approvals audit trail.',
        endpoint: '/export/petty-cash',
        filename: 'petty_cash_ledger.xlsx'
    },
    {
        id: 'production',
        title: 'Production & Yield',
        description: 'Manufacturing summaries, batch runs status, raw materials consumption rates, and scrap tally.',
        endpoint: '/export/production',
        filename: 'production_summary.xlsx'
    },
    {
        id: 'monthly-performance',
        title: 'Monthly Performance Scorecard',
        description: 'Overall operational performance, sales indicators, conversion summaries, and compliance ratings.',
        endpoint: '/export/monthly-performance',
        filename: 'monthly_scorecard.xlsx'
    },
    {
        id: 'inventory',
        title: 'Stock Valuation & Levels',
        description: 'Active warehouse assets, opening balances, adjustment registers, and stock movement logs.',
        endpoint: '/export/inventory/excel',
        filename: 'inventory_valuation.xlsx'
    },
    {
        id: 'sales',
        title: 'Sales & Invoices List',
        description: 'Customer invoices tracker, payments received, pending balances, and cheque clearance dates.',
        endpoint: '/export/sales/excel',
        filename: 'sales_performance.xlsx'
    }
];

export default function ExportCentrePage() {
    const [downloadingId, setDownloadingId] = useState(null);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const handleDownload = async (mod) => {
        setDownloadingId(mod.id);
        try {
            const { data } = await api.get(mod.endpoint, {
                params: { 
                    startDate, 
                    endDate, 
                    month: startDate ? startDate.slice(0, 7) : new Date().toISOString().slice(0, 7) 
                },
                responseType: 'blob'
            });

            // Create download link
            const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', mod.filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`${mod.title} downloaded successfully!`);
        } catch (err) {
            console.error('Export error:', err);
            toast.error(`Failed to export ${mod.title}`);
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-7 h-7 text-emerald-500" />
                        Export & Reporting Centre
                    </h1>
                    <p className="text-sm text-slate-500">
                        Export raw database records, ledger logs, and compliance journals directly into formatted Microsoft Excel files
                    </p>
                </div>
            </div>

            {/* Date range filter card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase">Export Data Range</span>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                    <div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none"
                        />
                    </div>
                    <div>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {EXPORT_MODULES.map((mod) => (
                    <div key={mod.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-slate-800 text-sm">{mod.title}</h3>
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-6">
                                {mod.description}
                            </p>
                        </div>

                        <button
                            onClick={() => handleDownload(mod)}
                            disabled={downloadingId !== null}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs shadow-sm"
                        >
                            {downloadingId === mod.id ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Compiling Excel...
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    Download Excel (XLSX)
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Info notice */}
            <div className="flex gap-3 bg-blue-50/50 border border-blue-100 p-4 rounded-xl items-start">
                <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-600">
                    <p className="font-bold text-slate-700">Secure Export & Auditing</p>
                    <p className="mt-0.5">All export actions are logged under the **Log Centre**. Financial spreadsheets include computed tallies, invoice logs, and are fully aligned with the central general ledger.</p>
                </div>
            </div>
        </div>
    );
}
