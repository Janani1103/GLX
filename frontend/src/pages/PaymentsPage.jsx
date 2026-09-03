import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Eye, Receipt, FileText, ArrowDownLeft, ArrowUpRight,
    Search, Filter, Printer, UserCheck, DollarSign, Truck, ShieldCheck, X
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { usePayments } from '../features/payments/usePayments';
import VoucherFormModal from '../features/payments/VoucherFormModal';
import ReceiptFormModal from '../features/payments/ReceiptFormModal';

export default function PaymentsPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('vouchers'); // 'receipts' | 'vouchers'
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedPrintDoc, setSelectedPrintDoc] = useState(null);

    const [filters, setFilters] = useState({
        voucherType: '',
        method: '',
        search: '',
        page: 1,
        limit: 20
    });

    // Query params based on tab
    const queryFilters = {
        ...filters,
        direction: activeTab === 'receipts' ? 'received' : 'paid',
    };

    const { data, isLoading, refetch } = usePayments(queryFilters);

    const payments = data?.data || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB');

    const getVoucherTypeBadge = (vType) => {
        switch (vType) {
            case 'customer_advance_refund':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    <UserCheck className="w-3 h-3 text-amber-600" /> Advance Refund
                </span>;
            case 'supplier_payment':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300">
                    <DollarSign className="w-3 h-3 text-blue-600" /> Supplier Pay
                </span>;
            case 'transport_hire':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300">
                    <Truck className="w-3 h-3 text-purple-600" /> Transport Hire
                </span>;
            case 'operational_expense':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                    <FileText className="w-3 h-3 text-slate-600" /> Operational
                </span>;
            default:
                return <Badge variant="secondary">Cash OUT</Badge>;
        }
    };

    const columns = [
        {
            key: 'paymentNumber',
            label: 'Ref #',
            width: '130px',
            render: (r) => (
                <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                    r.direction === 'received'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}>
                    {r.paymentNumber}
                </span>
            ),
        },
        {
            key: 'paymentDate',
            label: 'Date',
            render: (r) => <span className="text-xs font-medium">{fmtDate(r.paymentDate)}</span>
        },
        {
            key: 'voucherType',
            label: 'Type / Reason',
            render: (r) => r.direction === 'received' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> Cash IN Receipt
                </span>
            ) : (
                getVoucherTypeBadge(r.voucherType)
            )
        },
        {
            key: 'party',
            label: 'Party / Payee Details',
            render: (r) => (
                <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{r.partyName || r.customerId?.displayName || r.supplierId?.displayName || 'Direct Cash'}</p>
                    <p className="text-xs text-slate-500 font-mono">
                        {r.customerId?.customerCode || r.supplierId?.supplierCode || (r.vehicleNo ? `Vehicle: ${r.vehicleNo}` : '')}
                        {r.hireNoteNumber ? ` | Hire #: ${r.hireNoteNumber}` : ''}
                    </p>
                </div>
            ),
        },
        {
            key: 'method',
            label: 'Method',
            render: (r) => (
                <div className="text-xs capitalize font-medium">
                    {r.method?.replace('_', ' ')}
                    {r.chequeNumber && <span className="block font-mono text-[11px] text-slate-500">Chq: {r.chequeNumber}</span>}
                </div>
            )
        },
        {
            key: 'amount',
            label: 'Amount (LKR)',
            render: (r) => (
                <span className={`font-mono font-black text-sm ${r.direction === 'received' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {r.direction === 'received' ? '+' : '-'}{fmt(r.amount)}
                </span>
            ),
        },
        {
            key: 'signatureNote',
            label: 'Signature / Remarks',
            render: (r) => (
                <span className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-1">
                    {r.signatureNote || r.notes || '-'}
                </span>
            )
        },
        {
            key: 'actions',
            label: '',
            width: '90px',
            render: (r) => (
                <div className="flex flex-wrap items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPrintDoc(r);
                        }}
                        title="Print Voucher / Receipt Slip"
                        className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                    >
                        <Printer size={16} />
                    </button>
                    <button
                        onClick={() => navigate(`/payments/${r._id}`)}
                        title="View Details"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                    >
                        <Eye size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Receipts & Vouchers Module"
                description="Manage customer cash in receipts and cash out payment vouchers"
                actions={
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                        <Button
                            variant="success"
                            onClick={() => setIsReceiptModalOpen(true)}
                            className="shadow-md"
                        >
                            <Plus size={16} className="mr-1.5" />
                            Record Cash IN Receipt
                        </Button>
                        <Button
                            variant="amber"
                            onClick={() => setIsVoucherModalOpen(true)}
                            className="shadow-md"
                        >
                            <Plus size={16} className="mr-1.5" />
                            Issue Cash OUT Voucher
                        </Button>
                    </div>
                }
            />

            {/* Workspace Dual Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-2xl p-2 gap-2">
                <button
                    onClick={() => {
                        setActiveTab('vouchers');
                        setFilters(f => ({ ...f, page: 1 }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'vouchers'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <ArrowUpRight className="w-5 h-5" />
                    Cash OUT Vouchers
                </button>
                <button
                    onClick={() => {
                        setActiveTab('receipts');
                        setFilters(f => ({ ...f, page: 1 }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        activeTab === 'receipts'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <ArrowDownLeft className="w-5 h-5" />
                    Cash IN Receipts
                </button>
            </div>

            <Card>
                {/* Search & Filters */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center justify-between">
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center flex-1 w-full">
                        <div className="relative w-full sm:min-w-[240px] sm:flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by ref #, name, vehicle, hire #..."
                                value={filters.search}
                                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[16px] sm:text-sm min-h-[44px]"
                            />
                        </div>

                        {activeTab === 'vouchers' && (
                            <div className="w-full sm:w-64">
                                <Select
                                    placeholder="All Voucher Types"
                                    options={[
                                        { value: '', label: 'All Voucher Types' },
                                        { value: 'customer_advance_refund', label: 'Customer Advance Refund' },
                                        { value: 'supplier_payment', label: 'Supplier Payment' },
                                        { value: 'labor_advance', label: 'Labor / Salary Advance' },
                                        { value: 'transport_hire', label: 'Transport & Hire Expense' },
                                        { value: 'operational_expense', label: 'Petty Cash / Operational' },
                                    ]}
                                    value={filters.voucherType}
                                    onChange={(e) => setFilters((f) => ({ ...f, voucherType: e.target.value, page: 1 }))}
                                />
                            </div>
                        )}

                        <div className="w-full sm:w-48">
                            <Select
                                placeholder="All Payment Methods"
                                options={[
                                    { value: '', label: 'All Methods' },
                                    { value: 'cash', label: 'Cash' },
                                    { value: 'cheque', label: 'Cheque' },
                                    { value: 'bank_transfer', label: 'Bank Transfer' },
                                ]}
                                value={filters.method}
                                onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value, page: 1 }))}
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center text-slate-500">Loading records...</div>
                ) : payments.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title={activeTab === 'vouchers' ? 'No vouchers found' : 'No receipts found'}
                        description={activeTab === 'vouchers' ? 'Click "Issue Cash OUT Voucher" to record a new voucher' : 'Click "Record Cash IN Receipt" to record a new receipt'}
                        action={
                            activeTab === 'vouchers' ? (
                                <Button variant="amber" onClick={() => setIsVoucherModalOpen(true)}>
                                    <Plus size={16} className="mr-1.5" /> Issue Cash OUT Voucher
                                </Button>
                            ) : (
                                <Button variant="success" onClick={() => setIsReceiptModalOpen(true)}>
                                    <Plus size={16} className="mr-1.5" /> Record Cash IN Receipt
                                </Button>
                            )
                        }
                    />
                ) : (
                    <>
                        <Table columns={columns} data={payments} onRowClick={(r) => navigate(`/payments/${r._id}`)} />
                        <Pagination
                            page={filters.page}
                            totalPages={totalPages}
                            total={total}
                            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
                        />
                    </>
                )}
            </Card>

            {/* Modals */}
            <VoucherFormModal
                isOpen={isVoucherModalOpen}
                onClose={() => setIsVoucherModalOpen(false)}
                onSuccess={() => refetch()}
            />

            <ReceiptFormModal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                onSuccess={() => refetch()}
            />

            {/* Printable Slip Preview Modal */}
            {selectedPrintDoc && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-xl w-full p-6 space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {selectedPrintDoc.direction === 'received' ? 'Cash Receipt Slip' : 'Cash Payment Voucher'}
                            </h3>
                            <button onClick={() => setSelectedPrintDoc(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Slip Printable Body */}
                        <div id="printable-voucher-slip" className="p-6 border border-slate-300 rounded-xl bg-amber-50/20 dark:bg-slate-900 space-y-4">
                            <div className="text-center border-b pb-3">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">GLX INDUSTRIES (PVT) LTD</h2>
                                <p className="text-xs text-slate-500">Ja-Ela Yard & Engineering Head Office | Tel: +94 11 223 4567</p>
                                <span className="inline-block mt-2 font-mono font-bold text-sm bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                                    DOCUMENT #: {selectedPrintDoc.paymentNumber}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500 font-semibold block">Date:</span>
                                    <p className="font-bold">{fmtDate(selectedPrintDoc.paymentDate)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-semibold block">Party / Payee:</span>
                                    <p className="font-bold">{selectedPrintDoc.partyName || 'Cash'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-semibold block">Voucher Type:</span>
                                    <p className="font-bold capitalize">{(selectedPrintDoc.voucherType || selectedPrintDoc.direction).replace(/_/g, ' ')}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-semibold block">Payment Method:</span>
                                    <p className="font-bold capitalize">{selectedPrintDoc.method}</p>
                                </div>
                                {selectedPrintDoc.hireNoteNumber && (
                                    <div>
                                        <span className="text-slate-500 font-semibold block">Hire Note #:</span>
                                        <p className="font-mono font-bold text-amber-700">{selectedPrintDoc.hireNoteNumber}</p>
                                    </div>
                                )}
                                {selectedPrintDoc.vehicleNo && (
                                    <div>
                                        <span className="text-slate-500 font-semibold block">Vehicle #:</span>
                                        <p className="font-bold">{selectedPrintDoc.vehicleNo}</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 text-center">
                                <span className="text-xs text-slate-500 block">Total Amount</span>
                                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    LKR {(selectedPrintDoc.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                </h3>
                            </div>

                            {selectedPrintDoc.notes && (
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="font-bold block">Notes:</span>
                                    <p>{selectedPrintDoc.notes}</p>
                                </div>
                            )}

                            {/* Signatures */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-dashed border-slate-300 text-center text-xs">
                                <div>
                                    <div className="border-b border-slate-400 mb-1 h-8"></div>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">Received By Signature</p>
                                    <p className="text-[10px] text-slate-400">{selectedPrintDoc.signatureNote || 'Receiver Signature'}</p>
                                </div>
                                <div>
                                    <div className="border-b border-slate-400 mb-1 h-8"></div>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">Authorized Manager</p>
                                    <p className="text-[10px] text-slate-400">Authorized Accountant</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setSelectedPrintDoc(null)}>
                                Close
                            </Button>
                            <Button variant="primary" onClick={() => window.print()}>
                                <Printer className="w-4 h-4 mr-1.5" /> Print Slip
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}