import { useState, useEffect } from 'react';
import { X, Search, DollarSign, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import CustomerAutocompleteSelect from '../../components/ui/CustomerAutocompleteSelect';
import { paymentsApi } from './paymentsApi';
import api from '../../api/axios';

export default function ReceiptFormModal({ isOpen, onClose, onSuccess }) {
    const [customerId, setCustomerId] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [bankAccountId, setBankAccountId] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [chequeDate, setChequeDate] = useState('');
    const [bankName, setBankName] = useState('');
    const [notes, setNotes] = useState('');
    const [signatureNote, setSignatureNote] = useState('');

    const [linkableDocs, setLinkableDocs] = useState([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [isSearchingDocs, setIsSearchingDocs] = useState(false);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        api.get('/finance/bank-accounts')
            .then(res => {
                const list = res.data?.data || [];
                setBankAccounts(list);
                if (list.length > 0 && !bankAccountId) {
                    setBankAccountId(list[0]._id);
                }
            })
            .catch(() => setBankAccounts([]));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !customerId) {
            setLinkableDocs([]);
            return;
        }
        setIsSearchingDocs(true);
        paymentsApi.getLinkableDocuments({ customerId })
            .then(res => {
                setLinkableDocs(res.data || []);
                setIsSearchingDocs(false);
            })
            .catch(() => {
                setLinkableDocs([]);
                setIsSearchingDocs(false);
            });
    }, [isOpen, customerId]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numAmt = parseFloat(amount);
        if (!numAmt || numAmt <= 0) {
            toast.error('Please enter a valid positive amount');
            return;
        }
        if (!customerId) {
            toast.error('Please select a customer');
            return;
        }

        const allocations = [];
        if (selectedDocId) {
            const foundDoc = linkableDocs.find(d => d.documentId === selectedDocId);
            if (foundDoc) {
                allocations.push({
                    documentType: foundDoc.documentType,
                    documentId: foundDoc.documentId,
                    documentNumber: foundDoc.documentNumber,
                    amount: Math.min(numAmt, foundDoc.balanceDue || numAmt),
                });
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                direction: 'received',
                customerId,
                amount: numAmt,
                method,
                bankAccountId: method !== 'cash' ? bankAccountId : undefined,
                chequeNumber: method === 'cheque' ? chequeNumber : undefined,
                chequeDate: method === 'cheque' ? chequeDate : undefined,
                bankName: method === 'cheque' ? bankName : undefined,
                notes,
                signatureNote,
                allocations,
            };

            const response = await paymentsApi.create(payload);
            toast.success(`Receipt recorded successfully! (${response.data?.paymentNumber})`);
            if (onSuccess) onSuccess(response.data);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to record receipt.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                            R
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Record Cash IN Receipt</h2>
                            <p className="text-xs text-emerald-100">Customer payments received (Advance / Final Payments)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Customer <span className="text-rose-500">*</span>
                        </label>
                        <CustomerAutocompleteSelect
                            value={customerId}
                            onChange={(id) => setCustomerId(id)}
                            placeholder="Search customer..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Amount Received (LKR) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">LKR</span>
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                                className="w-full pl-12 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Document Link */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Search className="w-4 h-4 text-emerald-600" />
                            Linked Invoice / Quotation / Estimate
                        </h4>
                        {isSearchingDocs ? (
                            <p className="text-xs text-slate-500 italic">Searching linkable documents...</p>
                        ) : linkableDocs.length > 0 ? (
                            <select
                                value={selectedDocId}
                                onChange={(e) => setSelectedDocId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="">-- Select Optional Document Link --</option>
                                {linkableDocs.map((doc) => (
                                    <option key={doc.documentId} value={doc.documentId}>
                                        {doc.label} [Balance Due: LKR {(doc.balanceDue || 0).toLocaleString()}]
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs text-slate-500 italic">
                                {customerId ? 'No open documents found for this customer (will be credited as direct customer advance).' : 'Select a customer to view matching open Invoices or Quotations.'}
                            </p>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Payment Method
                            </label>
                            <Select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                options={[
                                    { value: 'cash', label: 'Cash' },
                                    { value: 'cheque', label: 'Cheque' },
                                    { value: 'bank_transfer', label: 'Bank Transfer' },
                                    { value: 'online', label: 'Online / Card' },
                                ]}
                            />
                        </div>

                        {method !== 'cash' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Company Bank Account
                                </label>
                                <Select
                                    value={bankAccountId}
                                    onChange={(e) => setBankAccountId(e.target.value)}
                                    options={bankAccounts.map((acc) => ({
                                        value: acc._id,
                                        label: `${acc.bankName} - ${acc.accountNumber}`,
                                    }))}
                                />
                            </div>
                        )}
                    </div>

                    {method === 'cheque' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Cheque Number
                                </label>
                                <input
                                    type="text"
                                    value={chequeNumber}
                                    onChange={(e) => setChequeNumber(e.target.value)}
                                    placeholder="CHQ-12345"
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Cheque Date
                                </label>
                                <input
                                    type="date"
                                    value={chequeDate}
                                    onChange={(e) => setChequeDate(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Notes
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Advance payment for lorry body engineering"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Received By / Signature Note
                            </label>
                            <input
                                type="text"
                                value={signatureNote}
                                onChange={(e) => setSignatureNote(e.target.value)}
                                placeholder="e.g. Received by Cashier / Manager Signed"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="success" disabled={isSubmitting}>
                            {isSubmitting ? 'Recording...' : 'Record Receipt'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
