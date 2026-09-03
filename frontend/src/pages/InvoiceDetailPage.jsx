import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Ban, Printer, Receipt, Download, CheckCircle, RefreshCw, Briefcase, FileCheck, FileText, RotateCcw } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useInvoice, useChangeInvoiceStatus } from '../features/invoices/useInvoices';
import { useAuthStore } from '../store/authStore';

import { useRef } from 'react';
import PrintableInvoice from '../components/print/PrintableInvoice';
import ShareDocumentSmsModal from '../components/ShareDocumentSmsModal';
import { exportDocumentToPDF, exportElementToPDF, printElementAsPDF } from '../utils/dataExport';
import { getApiUrl } from '../api/config';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../features/payments/paymentsApi';
import DocumentPaymentAudit from '../components/finance/DocumentPaymentAudit';

const paymentStatusVariant = {
    unpaid: 'warning', partially_paid: 'info', paid: 'success',
    overdue: 'danger', cancelled: 'default', written_off: 'default',
};

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [action, setAction] = useState(null);
    const [reason, setReason] = useState('');

    const { data, isLoading } = useInvoice(id);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const changeStatus = useChangeInvoiceStatus();
    const inv = data?.data;

    const printRef = useRef();
    const [isConverting, setIsConverting] = useState(false);

    // Conversion Modal State
    const [isConvertOpen, setIsConvertOpen] = useState(false);
    const [convertStep, setConvertStep] = useState('choose');
    const [convertYard, setConvertYard] = useState('');
    const [convertDetails, setConvertDetails] = useState('');
    const [convertAdvance, setConvertAdvance] = useState('');
    const [isSubmittingConvert, setIsSubmittingConvert] = useState(false);

    // Quick Payment States
    const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
    const [quickPayAmount, setQuickPayAmount] = useState('');
    const [quickPayMethod, setQuickPayMethod] = useState('cash');
    const [quickPayBankAccountId, setQuickPayBankAccountId] = useState('');
    const [quickPayReference, setQuickPayReference] = useState('');
    const [quickPayNotes, setQuickPayNotes] = useState('');
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // Revert Modal State
    const [isRevertOpen, setIsRevertOpen] = useState(false);
    const [revertAdminPassword, setRevertAdminPassword] = useState('');
    const [isReverting, setIsReverting] = useState(false);

    const { data: bankAccountsData } = useQuery({
        queryKey: ['bankAccounts'],
        queryFn: async () => {
            const { data } = await api.get('/finance/bank-accounts');
            return data.data || [];
        },
        enabled: isQuickPayOpen
    });
    const bankAccounts = bankAccountsData || [];

    const handleConvertToProforma = async () => {
        setIsSubmittingConvert(true);
        try {
            await api.post(`/invoices/${inv._id}/convert-to-proforma`);
            toast.success(`Invoice ${inv.invoiceNumber} converted to Proforma Invoice!`);
            setIsConvertOpen(false);
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to convert invoice');
        } finally {
            setIsSubmittingConvert(false);
        }
    };

    const handleConvertToCommercial = async () => {
        setIsSubmittingConvert(true);
        try {
            await api.post(`/invoices/${inv._id}/convert-to-commercial`);
            toast.success(`Invoice ${inv.invoiceNumber} converted to Commercial Invoice!`);
            setIsConvertOpen(false);
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to convert invoice');
        } finally {
            setIsSubmittingConvert(false);
        }
    };

    const handleConvertToProjectSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingConvert(true);
        try {
            const payload = {
                yard: convertYard,
                details: convertDetails,
                assignedEmployees: [],
                advancePaymentAmount: convertAdvance ? Number(convertAdvance) : 0
            };
            const { data: res } = await api.post(`/invoices/${inv._id}/convert-to-project`, payload);
            toast.success(`Converted to Project successfully!`);
            setIsConvertOpen(false);
            if (res.data?._id) {
                navigate(`/crm/projects/${res.data._id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to convert invoice to project');
        } finally {
            setIsSubmittingConvert(false);
        }
    };

    const handleQuickPaymentSubmit = async (e) => {
        e.preventDefault();
        const payVal = Number(quickPayAmount) > 0 ? Number(quickPayAmount) : inv.balanceDue;
        if (payVal <= 0) {
            toast.error('Payment amount must be greater than 0');
            return;
        }
        setIsSavingPayment(true);
        try {
            const payload = {
                direction: 'received',
                customerId: inv.customerId?._id || inv.customerId,
                amount: payVal,
                method: quickPayMethod,
                bankAccountId: (quickPayMethod === 'cheque' || quickPayMethod === 'bank_transfer') ? quickPayBankAccountId : undefined,
                paymentDate: new Date().toISOString().split('T')[0],
                allocations: [{
                    documentType: 'invoice',
                    documentId: inv._id,
                    amount: payVal
                }],
                notes: quickPayNotes || `Payment for Invoice ${inv.invoiceNumber}`,
                transactionReference: quickPayReference || undefined
            };

            await api.post('/payments', payload);
            toast.success(payVal >= inv.balanceDue ? 'Payment recorded and Invoice marked as Paid!' : `Partial Payment of LKR ${payVal.toLocaleString()} recorded!`);
            setIsQuickPayOpen(false);
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setIsSavingPayment(false);
        }
    };

    const handleRevertInvoiceSubmit = async (e) => {
        e.preventDefault();
        if (!revertAdminPassword) {
            toast.error('Please enter Admin Password');
            return;
        }
        setIsReverting(true);
        try {
            const { data: res } = await api.post(`/invoices/${inv._id}/revert-conversion`, {
                adminPassword: revertAdminPassword
            });
            toast.success('Successfully reverted Invoice back to Quotation Draft!');
            setIsRevertOpen(false);
            if (res.data?._id) {
                navigate(`/crm/quotations`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to revert invoice');
        } finally {
            setIsReverting(false);
        }
    };

    // Fetch payments allocated to this invoice
    const { data: paymentsData } = useQuery({
        queryKey: ['paymentsForInvoice', inv?._id],
        queryFn: () => paymentsApi.list({
            documentId: inv?._id,
            limit: 50,
        }),
        enabled: !!inv?._id,
    });

    const payments = paymentsData?.data || [];

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-LK') : '—';

    if (isLoading || !inv) return <div className="py-16 text-center text-gray-500">Loading...</div>;

    const canCancel = ['admin', 'manager', 'accountant'].includes(user.role);
    const canSend = ['admin', 'manager', 'accountant', 'sales_manager'].includes(user.role);

    const actions = [];
    if (inv.status === 'approved' && canSend) {
        actions.push({ label: 'Mark Sent', icon: Send, variant: 'primary', status: 'sent' });
    }
    if (['approved', 'sent'].includes(inv.status) && inv.paymentStatus !== 'paid' && canCancel) {
        actions.push({ label: 'Cancel', icon: Ban, variant: 'danger', status: 'cancelled', needsReason: true });
    }

    const handleAction = async () => {
        await changeStatus.mutateAsync({ id: inv._id, status: action.status, reason });
        setAction(null); setReason('');
    };

    const handlePrint = () => {
        if (printRef.current) {
            printElementAsPDF(printRef.current);
        } else {
            window.print();
        }
    };

    // Hard-code your company info for now (we'll move to settings later)
    const companyInfo = {
        name: 'Your Company Name',
        address: 'Your Street, City',
        taxNumber: 'TAX-12345',
        phone: '+94 11 XXX XXXX',
        email: 'info@yourcompany.lk',
    };

    return (
        <div>
            <PageHeader
                title={<span className="flex items-center gap-3">
                    Invoice {inv.invoiceNumber}
                    <Badge variant={paymentStatusVariant[inv.paymentStatus]}>{inv.paymentStatus.replace('_', ' ')}</Badge>
                    {inv.daysPastDue > 0 && <Badge variant="danger">{inv.daysPastDue}d overdue</Badge>}
                </span>}
                description={`Issued ${fmtDate(inv.invoiceDate)} · Due ${fmtDate(inv.dueDate)}`}
                actions={
                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                            <ArrowLeft size={14} className="mr-1" /> Back
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer size={14} className="mr-1" /> Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}>
                            <Send size={14} className="mr-1" /> SMS
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportElementToPDF(printRef.current, `invoice_${(inv.invoiceNumber || 'document').replace(/[\/\\:]/g, '_')}.pdf`)}>
                            <Download size={14} className="mr-1" /> PDF
                        </Button>
                        {inv.balanceDue > 0 && inv.paymentStatus !== 'cancelled' && (
                            <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => {
                                setQuickPayAmount(inv.balanceDue || '');
                                setQuickPayMethod('cash');
                                setQuickPayBankAccountId('');
                                setQuickPayReference('');
                                setQuickPayNotes('');
                                setIsQuickPayOpen(true);
                            }}>
                                <CheckCircle size={14} className="mr-1" /> Pay / Record Payment
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold"
                            onClick={() => {
                                setConvertStep('choose');
                                setConvertYard('');
                                setConvertDetails('');
                                setConvertAdvance('');
                                setIsConvertOpen(true);
                            }}
                        >
                            <RefreshCw size={14} className="mr-1" /> Convert
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold"
                            onClick={() => {
                                setRevertAdminPassword('');
                                setIsRevertOpen(true);
                            }}
                            title="Revert Invoice back to Quotation Draft format (Admin Password Required)"
                        >
                            <RotateCcw size={14} className="mr-1" /> Revert (Admin)
                        </Button>
                        {actions.map((a) => (
                            <Button key={a.label} variant={a.variant} size="sm" onClick={() => setAction(a)}>
                                <a.icon size={14} className="mr-1" /> {a.label}
                            </Button>
                        ))}
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-3 sm:p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer & Vehicle Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Bill To / Owner</p>
                                <p className="font-medium">{inv.vehicleOwner || inv.customerSnapshot?.name}</p>
                                {inv.customerSnapshot?.code && <p className="text-sm text-gray-600">{inv.customerSnapshot?.code}</p>}
                                {inv.insuranceCompany && (
                                    <p className="text-sm text-gray-600 font-semibold mt-1">Insurance: {inv.insuranceCompany}</p>
                                )}
                                {inv.billingAddress?.line1 && (
                                    <div className="text-sm text-gray-600 mt-2">
                                        {inv.billingAddress.line1}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Vehicle Metadata</p>
                                {inv.vehicleNo && (
                                    <p className="text-sm text-blue-700 font-bold font-mono">Vehicle No: {inv.vehicleNo}</p>
                                )}
                                {inv.vehicleModel && <p className="text-sm text-gray-600">Model: {inv.vehicleModel}</p>}
                                {inv.jobCaption && <p className="text-sm text-gray-600">Job: {inv.jobCaption}</p>}
                                {inv.sourceDocumentCode && (
                                    <p className="text-xs text-purple-700 font-bold mt-2">
                                        Source: {inv.sourceDocumentType?.toUpperCase()} ({inv.sourceDocumentCode})
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Vehicle Photos */}
                        {(inv.numberPlateImage || inv.lorryBodyImage) && (
                            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Number Plate Photo</p>
                                    {inv.numberPlateImage ? (
                                        <img src={inv.numberPlateImage} alt="Number Plate" className="h-32 object-contain rounded border bg-gray-50 p-1" />
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">No photo attached</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Lorry Body Photo</p>
                                    {inv.lorryBodyImage ? (
                                        <img src={inv.lorryBodyImage} alt="Lorry Body" className="h-32 object-contain rounded border bg-gray-50 p-1" />
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">No photo attached</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div className="px-3 sm:px-6 py-4 border-b">
                            <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Tax</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {inv.items.map((item) => (
                                    <tr key={item._id || item.lineNumber}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-sm">{item.productName}</p>
                                            {item.productCode && <p className="text-xs text-gray-500 font-mono">{item.productCode}</p>}
                                            {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">{item.quantity} {item.unitOfMeasure}</td>
                                        <td className="px-4 py-3 text-right text-sm">{fmt(item.unitPrice)}</td>
                                        <td className="px-4 py-3 text-right text-sm">{fmt(item.lineTax)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-medium">{fmt(item.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </Card>

                    {/* Payment Audit & History */}
                    <DocumentPaymentAudit documentId={inv._id} />

                    {(inv.notes || inv.paymentInstructions) && (
                        <Card className="p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                            {inv.notes && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
                                    <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
                                </div>
                            )}
                            {inv.paymentInstructions && (
                                <div>
                                    <p className="text-xs text-gray-500 uppercase mb-1">Payment Instructions</p>
                                    <p className="text-sm whitespace-pre-wrap bg-blue-50 p-2 rounded">{inv.paymentInstructions}</p>
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="p-3 sm:p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(inv.subtotal)}</span></div>
                            {inv.totalDiscount > 0 && (
                                <div className="flex justify-between"><span className="text-gray-600">Discount</span><span className="text-red-600">-{fmt(inv.totalDiscount)}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(inv.totalTax)}</span></div>
                            {inv.shippingCost > 0 && (
                                <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span>{fmt(inv.shippingCost)}</span></div>
                            )}
                            <div className="flex justify-between pt-3 border-t">
                                <span className="font-semibold">Total</span>
                                <span className="font-bold">{fmt(inv.grandTotal)}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-gray-600">Paid</span>
                                <span className="text-green-600">-{fmt(inv.amountPaid)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-semibold">Balance Due</span>
                                <span className={`font-bold text-lg ${inv.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {fmt(inv.balanceDue)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-3 sm:p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Invoice Date</span><span>{fmtDate(inv.invoiceDate)}</span></div>
                            {inv.dueDate && <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span>{fmtDate(inv.dueDate)}</span></div>}
                            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize">{inv.invoiceType}</span></div>
                            {inv.daysOutstanding > 0 && (
                                <div className="flex justify-between"><span className="text-gray-500">Days outstanding</span><span>{inv.daysOutstanding}</span></div>
                            )}
                            {inv.salesRepId && (
                                <div className="flex justify-between"><span className="text-gray-500">Sales Rep</span>
                                    <span>{inv.salesRepId.firstName} {inv.salesRepId.lastName}</span>
                                </div>
                            )}
                        </div>
                    </Card>

                    {inv.lastPaymentDate && (
                        <Card className="p-3 sm:p-6 border-l-4 border-l-green-500">
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Last Payment</h3>
                            <p className="text-sm">{fmtDate(inv.lastPaymentDate)}</p>
                            {inv.fullyPaidAt && <p className="text-xs text-green-600 mt-1">Fully paid on {fmtDate(inv.fullyPaidAt)}</p>}
                        </Card>
                    )}

                    {inv.cancelledAt && (
                        <Card className="p-3 sm:p-6 border-l-4 border-l-red-500 bg-red-50">
                            <h3 className="text-sm font-semibold text-red-800 mb-1">Cancelled</h3>
                            <p className="text-sm text-red-700">{inv.cancellationReason}</p>
                            <p className="text-xs text-red-600 mt-1">By {inv.cancelledBy?.firstName} on {fmtDate(inv.cancelledAt)}</p>
                        </Card>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!action}
                onClose={() => { setAction(null); setReason(''); }}
                onConfirm={handleAction}
                title={action?.label}
                message={
                    action?.needsReason ? (
                        <div>
                            <p className="mb-3">Please provide a reason:</p>
                            <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                value={reason} onChange={(e) => setReason(e.target.value)} />
                        </div>
                    ) : `${action?.label} this invoice?`
                }
                confirmText={action?.label}
                variant={action?.variant === 'danger' ? 'danger' : 'primary'}
                loading={changeStatus.isPending}
            />

            <div className="print-only-container">
                <PrintableInvoice
                    ref={printRef}
                    companyInfo={companyInfo}
                    invoice={inv}
                    payments={payments}
                />
            </div>
            {inv && (
                <ShareDocumentSmsModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    documentId={inv._id}
                    documentType="invoice"
                    defaultPhone={inv.customerSnapshot?.phone || ''}
                />
            )}

            {/* Quick Payment Modal */}
            {isQuickPayOpen && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-[slideUp_0.2s_ease-out]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Record Payment</h3>
                            <button onClick={() => setIsQuickPayOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">✕</button>
                        </div>
                        <form onSubmit={handleQuickPaymentSubmit} className="space-y-4">
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-gray-500">Current Balance Due</span>
                                    <p className="text-xl font-bold text-blue-900">LKR {inv.balanceDue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-gray-500">Grand Total</span>
                                    <p className="text-xs font-mono text-gray-700">LKR {inv.grandTotal?.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Payment Amount (LKR) *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={inv.balanceDue}
                                    step="0.01"
                                    required
                                    value={quickPayAmount}
                                    onChange={(e) => setQuickPayAmount(e.target.value)}
                                    placeholder={`Max LKR ${inv.balanceDue?.toLocaleString()}`}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold font-mono bg-white"
                                />
                                <p className="text-[11px] text-gray-500">Enter full amount (LKR {inv.balanceDue?.toLocaleString()}) or a partial payment amount.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Payment Method</label>
                                <select
                                    value={quickPayMethod}
                                    onChange={(e) => setQuickPayMethod(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="card">Card</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            {(quickPayMethod === 'cheque' || quickPayMethod === 'bank_transfer') && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase">Company Bank Account</label>
                                    <select
                                        required
                                        value={quickPayBankAccountId}
                                        onChange={(e) => setQuickPayBankAccountId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    >
                                        <option value="">-- Select Account --</option>
                                        {bankAccounts.map(acc => (
                                            <option key={acc._id} value={acc._id}>
                                                {acc.bankName} - {acc.accountNumber} (LKR {acc.balance?.toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Reference / Notes (optional)</label>
                                <input
                                    type="text"
                                    value={quickPayReference}
                                    onChange={(e) => setQuickPayReference(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    placeholder="e.g. Txn Ref, Cheque No, etc."
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsQuickPayOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={isSavingPayment}>Confirm Payment</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Revert Modal */}
            {isRevertOpen && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-[slideUp_0.2s_ease-out]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                                <RotateCcw size={18} /> Revert Invoice to Quotation
                            </h3>
                            <button onClick={() => setIsRevertOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">✕</button>
                        </div>
                        <form onSubmit={handleRevertInvoiceSubmit} className="space-y-4">
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                                <p className="font-bold uppercase">⚠️ Admin Authorization Required</p>
                                <p>Reverting <strong>{inv.invoiceNumber}</strong> will cancel this invoice and restore/create a Quotation document in <strong>Draft</strong> status.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Admin Password *</label>
                                <input
                                    type="password"
                                    required
                                    value={revertAdminPassword}
                                    onChange={(e) => setRevertAdminPassword(e.target.value)}
                                    placeholder="Enter Admin Password to verify"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsRevertOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={isReverting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                                    Confirm Revert
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONVERT INVOICE MODAL */}
            {isConvertOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
                        <div className="flex justify-between items-center border-b pb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Convert Document</h3>
                                <p className="text-xs text-gray-500 font-mono">{inv.invoiceNumber} · Total: {inv.grandTotal?.toLocaleString()} LKR</p>
                            </div>
                            <button onClick={() => setIsConvertOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                        </div>

                        {convertStep === 'choose' ? (
                            <div className="space-y-3 pt-2">
                                <p className="text-xs text-gray-600 font-medium">Select target conversion format:</p>

                                {inv.invoiceType === 'proforma' ? (
                                    <button
                                        type="button"
                                        onClick={handleConvertToCommercial}
                                        disabled={isSubmittingConvert}
                                        className="w-full p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 transition text-left flex items-start gap-3 group"
                                    >
                                        <div className="p-2.5 bg-blue-600 text-white rounded-xl group-hover:scale-105 transition">
                                            <FileCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">Convert to Commercial Invoice</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">Convert Proforma Invoice into standard tax/commercial invoice & deduct inventory</p>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleConvertToProforma}
                                        disabled={isSubmittingConvert}
                                        className="w-full p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 transition text-left flex items-start gap-3 group"
                                    >
                                        <div className="p-2.5 bg-amber-500 text-white rounded-xl group-hover:scale-105 transition">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">Convert to Proforma Invoice (PI)</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">Change invoice format into a Proforma Estimate for client review</p>
                                        </div>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setConvertStep('project')}
                                    className="w-full p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 transition text-left flex items-start gap-3 group"
                                >
                                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">Convert to Project (Yard Job)</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Create a Project to track materials, labor cost, and progress at the yard</p>
                                    </div>
                                </button>

                                <div className="pt-2 flex justify-end">
                                    <Button variant="outline" size="sm" onClick={() => setIsConvertOpen(false)}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleConvertToProjectSubmit} className="space-y-4">
                                <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 text-indigo-900">
                                    <p className="text-xs font-bold uppercase">Target Project Summary</p>
                                    <p className="text-xs text-indigo-700 mt-0.5 font-medium">Customer: {inv.customerSnapshot?.name || inv.vehicleOwner || 'Customer'}</p>
                                    <p className="text-xs text-indigo-700 font-mono font-bold">Quoted Value: {inv.grandTotal?.toLocaleString()} LKR</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Select Yard Location</label>
                                    <select
                                        value={convertYard}
                                        onChange={(e) => setConvertYard(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white outline-none focus:border-slate-900"
                                    >
                                        <option value="">-- Select Yard Location --</option>
                                        <option value="Ja-Ela Yard 1">Ja-Ela Yard 1</option>
                                        <option value="Ja-Ela Yard 2">Ja-Ela Yard 2</option>
                                        <option value="Ekala Yard">Ekala Yard</option>
                                        <option value="Main Yard">Main Yard</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Project Notes / Work Details</label>
                                    <textarea
                                        rows={2}
                                        value={convertDetails}
                                        onChange={(e) => setConvertDetails(e.target.value)}
                                        placeholder="Add work scope, vehicle details or instructions..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white outline-none focus:border-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase">Advance Payment Amount (Optional)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g. 50000"
                                        value={convertAdvance}
                                        onChange={(e) => setConvertAdvance(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold font-mono bg-white outline-none focus:border-slate-900"
                                    />
                                </div>

                                <div className="flex justify-between items-center pt-3 border-t">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setConvertStep('choose')}>← Back</Button>
                                    <Button type="submit" variant="primary" size="sm" loading={isSubmittingConvert} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                        Create Project
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}