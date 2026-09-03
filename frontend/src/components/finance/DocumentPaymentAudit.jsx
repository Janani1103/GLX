import { useState, useEffect } from 'react';
import { ShieldCheck, FileCheck, DollarSign, Clock, UserCheck, AlertCircle } from 'lucide-react';
import { paymentsApi } from '../../features/payments/paymentsApi';

export default function DocumentPaymentAudit({ documentId, title = 'Payment & Voucher Audit Trail' }) {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!documentId) return;
        setIsLoading(true);
        setError(null);

        paymentsApi.getDocumentSummary(documentId)
            .then((res) => {
                setSummary(res);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load document payment audit summary:', err);
                setError('Unable to fetch payment history.');
                setIsLoading(false);
            });
    }, [documentId]);

    if (!documentId) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm my-6">
            {/* Header Banner */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">{title}</h3>
                        <p className="text-xs text-slate-400">Verified system receipts and voucher payments audit log</p>
                    </div>
                </div>
                {summary && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                        <FileCheck className="w-4 h-4" />
                        {summary.count} Record(s)
                    </div>
                )}
            </div>

            <div className="p-6 space-y-4">
                {isLoading ? (
                    <div className="animate-pulse flex items-center gap-3 text-slate-500 text-sm py-4">
                        <Clock className="w-4 h-4 animate-spin" />
                        Verifying payment history...
                    </div>
                ) : error ? (
                    <div className="text-xs text-rose-500 flex items-center gap-2 py-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                ) : summary ? (
                    <>
                        {/* Highlighted Total Paid Banner */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-md">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                                        Total Settled Amount via Vouchers / Receipts
                                    </span>
                                    <h4 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                                        Total amount settled so far for this document: LKR {(summary.totalPaidSoFar || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                    </h4>
                                </div>
                            </div>
                            <div className="text-right hidden sm:block">
                                <span className="text-xs text-slate-500">Net Paid</span>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    LKR {(summary.totalPaidSoFar || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Payment Audit Records Table */}
                        {summary.payments && summary.payments.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 uppercase font-bold">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Ref #</th>
                                            <th className="p-3">Type</th>
                                            <th className="p-3">Method</th>
                                            <th className="p-3 text-right">Amount (LKR)</th>
                                            <th className="p-3">Handled By</th>
                                            <th className="p-3">Signature / Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                                        {summary.payments.map((p) => {
                                            const isVoucher = p.direction === 'paid' || !!p.voucherType;
                                            return (
                                                <tr key={p.paymentId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                    <td className="p-3 whitespace-nowrap font-medium">
                                                        {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                                                    </td>
                                                    <td className="p-3 whitespace-nowrap font-mono font-bold">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                                                            isVoucher
                                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        }`}>
                                                            {p.paymentNumber}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 capitalize font-semibold">
                                                        {p.voucherType ? (
                                                            <span className="text-amber-600 dark:text-amber-400">
                                                                {p.voucherType.replace(/_/g, ' ')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                                Cash IN Receipt
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 capitalize">
                                                        {p.method} {p.chequeNumber ? `(#${p.chequeNumber})` : ''}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                                        LKR {(p.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 font-medium flex items-center gap-1.5">
                                                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                                        {p.handledBy}
                                                    </td>
                                                    <td className="p-3 italic text-slate-600 dark:text-slate-400">
                                                        {p.signatureNote || p.notes || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic py-2">
                                No vouchers or receipts recorded for this document yet.
                            </p>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}
