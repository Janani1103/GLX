import { useState, useEffect } from 'react';
import { X, Search, FileText, DollarSign, Truck, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import CustomerAutocompleteSelect from '../../components/ui/CustomerAutocompleteSelect';
import { paymentsApi } from './paymentsApi';
import api from '../../api/axios';

const VOUCHER_REASON_TYPES = [
    {
        id: 'customer_advance_refund',
        label: 'Customer Advance Refund',
        icon: UserCheck,
        description: 'Refunding partial or full advance payment previously made by a customer.',
    },
    {
        id: 'supplier_payment',
        label: 'Supplier Payment',
        icon: DollarSign,
        description: 'Payment made to suppliers or vendors for goods/materials supplied.',
    },
    {
        id: 'labor_advance',
        label: 'Labor / Salary Advance',
        icon: UserCheck,
        description: 'Cash advance given to workers/staff. Automatically deducted during monthly payroll.',
    },
    {
        id: 'transport_hire',
        label: 'Transport & Hire Expense',
        icon: Truck,
        description: 'Hire payments for lorries, vehicles, and drivers (e.g. Jayanthi / driver hire notes).',
    },
    {
        id: 'operational_expense',
        label: 'Petty Cash / Operational Expense',
        icon: FileText,
        description: 'Daily yard operations or general company operational cash expenses.',
    },
];

export default function VoucherFormModal({ isOpen, onClose, onSuccess }) {
    const [voucherType, setVoucherType] = useState('customer_advance_refund');
    const [customerId, setCustomerId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [partyName, setPartyName] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [bankAccountId, setBankAccountId] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [chequeDate, setChequeDate] = useState('');
    const [bankName, setBankName] = useState('');
    const [hireNoteNumber, setHireNoteNumber] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [transportDriver, setTransportDriver] = useState('');
    const [notes, setNotes] = useState('');
    const [signatureNote, setSignatureNote] = useState('');

    // Document linking state
    const [linkableDocs, setLinkableDocs] = useState([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [isSearchingDocs, setIsSearchingDocs] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch suppliers, employees and bank accounts
    useEffect(() => {
        if (!isOpen) return;
        api.get('/suppliers?limit=300')
            .then(res => setSuppliers(res.data?.data || []))
            .catch(() => setSuppliers([]));

        api.get('/hr/employees?limit=300')
            .then(res => setEmployees(res.data?.data || []))
            .catch(() => setEmployees([]));

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

    // Auto-fetch linkable documents when customer or supplier changes
    useEffect(() => {
        if (!isOpen) return;
        setIsSearchingDocs(true);

        const params = {};
        if (voucherType === 'customer_advance_refund' && customerId) {
            params.customerId = customerId;
        } else if (voucherType === 'supplier_payment' && supplierId) {
            params.supplierId = supplierId;
        } else {
            params.type = voucherType.includes('customer') ? 'customer' : 'supplier';
        }

        paymentsApi.getLinkableDocuments(params)
            .then(res => {
                setLinkableDocs(res.data || []);
                setIsSearchingDocs(false);
            })
            .catch(() => {
                setLinkableDocs([]);
                setIsSearchingDocs(false);
            });
    }, [isOpen, voucherType, customerId, supplierId]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numAmt = parseFloat(amount);
        if (!numAmt || numAmt <= 0) {
            toast.error('Please enter a valid positive voucher amount');
            return;
        }

        if (voucherType === 'customer_advance_refund' && !customerId) {
            toast.error('Please select a customer for Advance Refund');
            return;
        }
        if (voucherType === 'supplier_payment' && !supplierId) {
            toast.error('Please select a supplier for Supplier Payment');
            return;
        }
        if ((voucherType === 'labor_advance' || voucherType === 'salary_advance') && !employeeId) {
            toast.error('Please select an employee for Labor Advance');
            return;
        }

        // Selected document allocation
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
                voucherType,
                customerId: voucherType === 'customer_advance_refund' ? customerId : undefined,
                supplierId: voucherType === 'supplier_payment' ? supplierId : undefined,
                employeeId: (voucherType === 'labor_advance' || voucherType === 'salary_advance') ? employeeId : undefined,
                partyName: partyName || (voucherType === 'transport_hire' ? transportDriver : 'Operational Cash'),
                amount: numAmt,
                method,
                bankAccountId: method !== 'cash' ? bankAccountId : undefined,
                chequeNumber: method === 'cheque' ? chequeNumber : undefined,
                chequeDate: method === 'cheque' ? chequeDate : undefined,
                bankName: method === 'cheque' ? bankName : undefined,
                hireNoteNumber,
                vehicleNo,
                transportDriver,
                notes,
                signatureNote,
                allocations,
            };

            const response = await paymentsApi.createVoucher(payload);
            toast.success(`Voucher issued successfully! (${response.data?.paymentNumber})`);
            if (onSuccess) onSuccess(response.data);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to issue voucher.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                            V
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Issue Cash Out Voucher</h2>
                            <p className="text-xs text-amber-100">Record cash out-payments, advance refunds, transport and operational expenses</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Reason Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                            Voucher Reason Type <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {VOUCHER_REASON_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = voucherType === type.id;
                                return (
                                    <div
                                        key={type.id}
                                        onClick={() => {
                                            setVoucherType(type.id);
                                            setSelectedDocId('');
                                        }}
                                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold">{type.label}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{type.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700" />

                    {/* Party Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {voucherType === 'customer_advance_refund' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Customer <span className="text-rose-500">*</span>
                                </label>
                                <CustomerAutocompleteSelect
                                    value={customerId}
                                    onChange={(id, custObj) => {
                                        setCustomerId(id);
                                        if (custObj) {
                                            setPartyName(custObj.displayName || custObj.companyName || `${custObj.firstName || ''} ${custObj.lastName || ''}`.trim());
                                        }
                                    }}
                                    placeholder="Search customer..."
                                />
                            </div>
                        )}

                        {voucherType === 'supplier_payment' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Supplier <span className="text-rose-500">*</span>
                                </label>
                                <Select
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    options={[
                                        { value: '', label: '-- Select Supplier --' },
                                        ...suppliers.map((s) => ({
                                            value: s._id,
                                            label: `${s.displayName || s.companyName} (${s.supplierCode || ''})`,
                                        })),
                                    ]}
                                />
                            </div>
                        )}

                        {(voucherType === 'labor_advance' || voucherType === 'salary_advance') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Employee / Worker <span className="text-rose-500">*</span>
                                </label>
                                <Select
                                    value={employeeId}
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        setEmployeeId(empId);
                                        const found = employees.find(emp => emp._id === empId);
                                        if (found) {
                                            setPartyName(`${found.firstName || ''} ${found.lastName || ''}`.trim() || found.employeeCode);
                                        }
                                    }}
                                    options={[
                                        { value: '', label: '-- Select Employee --' },
                                        ...employees.map((emp) => ({
                                            value: emp._id,
                                            label: `${emp.firstName || ''} ${emp.lastName || ''} (${emp.employeeCode || ''})`,
                                        })),
                                    ]}
                                />
                            </div>
                        )}

                        {voucherType === 'transport_hire' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Lorry / Vehicle No.
                                    </label>
                                    <input
                                        type="text"
                                        value={vehicleNo}
                                        onChange={(e) => setVehicleNo(e.target.value)}
                                        placeholder="e.g. WP DAA-4589"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Hire Note / Transport Bill No.
                                    </label>
                                    <input
                                        type="text"
                                        value={hireNoteNumber}
                                        onChange={(e) => setHireNoteNumber(e.target.value)}
                                        placeholder="e.g. HN-2026-081"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Driver / Carrier Name
                                    </label>
                                    <input
                                        type="text"
                                        value={transportDriver}
                                        onChange={(e) => setTransportDriver(e.target.value)}
                                        placeholder="e.g. Jayanthi / Driver Kamal"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {voucherType === 'operational_expense' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Paid To / Purpose
                                </label>
                                <input
                                    type="text"
                                    value={partyName}
                                    onChange={(e) => setPartyName(e.target.value)}
                                    placeholder="e.g. Yard operational expense"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Voucher Amount (LKR) <span className="text-rose-500">*</span>
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
                                    className="w-full pl-12 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-base font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Document Linking & Reference Lookup Section */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Search className="w-4 h-4 text-amber-600" />
                                Linked Document Reference (Invoice / Quotation / Estimate / Bill / GRN)
                            </h4>
                            <span className="text-xs text-slate-500">Auto Lookup</span>
                        </div>

                        {isSearchingDocs ? (
                            <p className="text-xs text-slate-500 italic py-2">Searching linkable documents...</p>
                        ) : linkableDocs.length > 0 ? (
                            <div>
                                <select
                                    value={selectedDocId}
                                    onChange={(e) => setSelectedDocId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                >
                                    <option value="">-- Select Optional Linked Document --</option>
                                    {linkableDocs.map((doc) => (
                                        <option key={doc.documentId} value={doc.documentId}>
                                            {doc.label} [Balance Due: LKR {(doc.balanceDue || 0).toLocaleString()}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic py-1">
                                {customerId || supplierId
                                    ? 'No linkable documents found for this party.'
                                    : 'Select a customer or supplier to view matching open Invoices, Quotations, or Bills.'}
                            </p>
                        )}
                    </div>

                    {/* Payment Method Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                        label: `${acc.bankName} - ${acc.accountNumber} (${acc.accountName})`,
                                    }))}
                                />
                            </div>
                        )}

                        {method === 'cheque' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Cheque Number
                                    </label>
                                    <input
                                        type="text"
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                        placeholder="CHQ-00123"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Cheque Date
                                    </label>
                                    <input
                                        type="date"
                                        value={chequeDate}
                                        onChange={(e) => setChequeDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Notes & Signature Remark */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Voucher Remarks / Purpose
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Additional voucher notes or purpose details..."
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
                                placeholder="e.g. Received & Signed by Driver Kamal / Approved by Manager"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="amber" disabled={isSubmitting}>
                            {isSubmitting ? 'Issuing Voucher...' : 'Issue Voucher'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
