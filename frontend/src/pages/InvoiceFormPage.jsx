import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, Save, Image as ImageIcon, X } from 'lucide-react';

import PageHeader from '../components/ui/PageHeader';
import { translateText, detectLanguage } from '../utils/translationService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';

import { customersApi } from '../features/customers/customersApi';
import { productsApi } from '../features/products/productsApi';
import { useCreateInvoice } from '../features/invoices/useInvoices';
import api from '../api/axios';

export default function InvoiceFormPage() {
    const navigate = useNavigate();
    const createMutation = useCreateInvoice();

    const [customerId, setCustomerId] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [invoiceType, setInvoiceType] = useState('standard');
    const [notes, setNotes] = useState('');
    const [paymentInstructions, setPaymentInstructions] = useState('');
    const [shippingCost, setShippingCost] = useState(0);
    const [items, setItems] = useState([{ productName: '', quantity: 1, unitPrice: 0, taxRate: 18, taxable: true }]);

    const [introducer, setIntroducer] = useState('');
    const [introducerName, setIntroducerName] = useState('');
    const [biller, setBiller] = useState('');
    const [billerName, setBillerName] = useState('');
    const [numberPlateImage, setNumberPlateImage] = useState('');
    const [lorryBodyImage, setLorryBodyImage] = useState('');

    const { data: customersData } = useQuery({
        queryKey: ['customers', 'active'],
        queryFn: () => customersApi.list({ status: 'active', limit: 500 }),
    });
    const { data: productsData } = useQuery({
        queryKey: ['products', 'active'],
        queryFn: () => productsApi.list({ status: 'active', limit: 500 }),
    });
    const { data: employeesData } = useQuery({
        queryKey: ['employees', 'active'],
        queryFn: async () => {
            const { data } = await api.get('/hr/employees?limit=500&status=active');
            return data.data || [];
        }
    });
    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { data } = await api.get('/users?limit=500');
            return data.data || [];
        }
    });

    const customerOptions = (customersData?.data || []).map((c) => ({
        value: c._id, label: `${c.displayName} (${c.customerCode})`,
    }));
    const NON_SELLABLE_TYPES = ['raw_material', 'packaging', 'consumable', 'service'];
    const productOptions = (productsData?.data || [])
        .filter((p) => p.canBeSold !== false && !NON_SELLABLE_TYPES.includes(p.productType))
        .map((p) => ({
            value: p._id, label: `${p.name} — ${p.productCode}`,
        }));

    const addItem = () => setItems([...items, { productName: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, taxable: true }]);
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, field, value) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        if (field === 'productId' && value) {
            const p = productsData?.data?.find((x) => x._id === value);
            if (p) {
                newItems[idx].productName = p.name;
                newItems[idx].productCode = p.productCode;
                newItems[idx].description = p.description || '';
                newItems[idx].unitPrice = p.basePrice || p.costs?.lastPurchaseCost || p.costs?.averageCost || 0;
                newItems[idx].taxRate = p.tax?.taxRate || 0;
                newItems[idx].taxable = p.tax?.taxable ?? true;
                newItems[idx].unitOfMeasure = p.unitOfMeasure;
            }
        }
        setItems(newItems);
    };

    const totals = useMemo(() => {
        let sub = 0, tax = 0;
        items.forEach((i) => {
            const q = +i.quantity || 0;
            const p = +i.unitPrice || 0;
            const lSub = q * p;
            const lTax = i.taxable ? lSub * (+i.taxRate || 0) / 100 : 0;
            sub += lSub; tax += lTax;
        });
        const grand = sub + tax + (+shippingCost || 0);
        return { sub: +sub.toFixed(2), tax: +tax.toFixed(2), grand: +grand.toFixed(2) };
    }, [items, shippingCost]);

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    const submit = async () => {
        if (!customerId) { toast.error('Select customer'); return; }
        if (items.length === 0 || items.some((i) => !i.productName || !i.quantity)) {
            toast.error('All items need a name and quantity');
            return;
        }

        try {
            const result = await createMutation.mutateAsync({
                customerId,
                invoiceType,
                invoiceDate,
                dueDate: dueDate || undefined,
                introducer: introducer || undefined,
                introducerName: introducerName || undefined,
                biller: biller || undefined,
                billerName: billerName || undefined,
                numberPlateImage: numberPlateImage || undefined,
                lorryBodyImage: lorryBodyImage || undefined,
                items: items.map((i) => ({
                    productId: i.productId || undefined,
                    productCode: i.productCode || undefined,
                    productName: i.productName,
                    productTranslation: i.productTranslation || undefined,
                    description: i.description || undefined,
                    quantity: +i.quantity,
                    unitOfMeasure: i.unitOfMeasure || undefined,
                    unitPrice: +i.unitPrice,
                    taxRate: +i.taxRate || 0,
                    taxable: i.taxable,
                })),
                shippingCost: +shippingCost || 0,
                notes: notes || undefined,
                paymentInstructions: paymentInstructions || undefined,
                status: 'approved',
            });
            navigate(`/invoices/${result.data._id}`);
        } catch { }
    };

    return (
        <div>
            <PageHeader title="Manual Invoice"
                description="Create an invoice without a sales order (services, miscellaneous)"
                actions={<Button variant="outline" onClick={() => navigate('/invoices')}>
                    <ArrowLeft size={16} className="mr-1.5" /> Back
                </Button>} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="col-span-2 space-y-6">
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer & Dates</h3>
                        <div className="space-y-4">
                            <Select label="Customer" required placeholder="Select customer..."
                                options={customerOptions} value={customerId} onChange={(e) => {
                                    setCustomerId(e.target.value);
                                    const cust = (customersData?.data || []).find((c) => c._id === e.target.value);
                                    if (cust && cust.introducer) {
                                        setIntroducer(cust.introducer);
                                        setIntroducerName(cust.introducerName || '');
                                    } else {
                                        setIntroducer('');
                                        setIntroducerName('');
                                    }
                                }} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                                <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                <Select label="Type"
                                    options={[
                                        { value: 'standard', label: 'Standard' },
                                        { value: 'proforma', label: 'Proforma' },
                                        { value: 'service', label: 'Service' },
                                    ]}
                                    value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} />
                            </div>

                            {/* Introducer and Biller dropdowns */}
                            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Introducer (Employee)</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={introducer || ''}
                                        onChange={(e) => {
                                            const empId = e.target.value;
                                            const emp = (employeesData || []).find(x => x._id === empId);
                                            setIntroducer(empId);
                                            setIntroducerName(emp ? `${emp.firstName} ${emp.lastName}` : '');
                                        }}
                                    >
                                        <option value="">-- Select Introducer --</option>
                                        {(employeesData || []).map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Biller (User)</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={biller || ''}
                                        onChange={(e) => {
                                            const userId = e.target.value;
                                            const usr = (usersData || []).find(x => x._id === userId);
                                            setBiller(userId);
                                            setBillerName(usr ? `${usr.firstName} ${usr.lastName}` : '');
                                        }}
                                    >
                                        <option value="">-- Select Biller --</option>
                                        {(usersData || []).map(u => (
                                            <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Image uploads for Number Plate & Lorry Body */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
                            <ImageIcon size={16} /> Photo Attachments (Displayed on Print & PDF)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Number Plate Photo */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase">Number Plate Photo</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="text-xs text-gray-500 w-full file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const r = new FileReader();
                                            r.onloadend = () => setNumberPlateImage(r.result);
                                            r.readAsDataURL(file);
                                        }
                                    }}
                                />
                                {numberPlateImage && (
                                    <div className="relative border rounded p-1 bg-white">
                                        <img src={numberPlateImage} alt="Plate Preview" className="h-24 object-contain mx-auto" />
                                        <button type="button" onClick={() => setNumberPlateImage('')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X size={12} /></button>
                                    </div>
                                )}
                            </div>

                            {/* Lorry Body Photo */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase">Lorry Body Photo</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="text-xs text-gray-500 w-full file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const r = new FileReader();
                                            r.onloadend = () => setLorryBodyImage(r.result);
                                            r.readAsDataURL(file);
                                        }
                                    }}
                                />
                                {lorryBodyImage && (
                                    <div className="relative border rounded p-1 bg-white">
                                        <img src={lorryBodyImage} alt="Body Preview" className="h-24 object-contain mx-auto" />
                                        <button type="button" onClick={() => setLorryBodyImage('')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X size={12} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                <Plus size={14} className="mr-1" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {items.map((item, idx) => {
                                const lSub = (+item.quantity || 0) * (+item.unitPrice || 0);
                                const lTax = item.taxable ? lSub * (+item.taxRate || 0) / 100 : 0;
                                const lTot = lSub + lTax;
                                return (
                                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                                        <div className="flex gap-2">
                                            <span className="text-xs text-gray-500 mt-2 w-6">{idx + 1}</span>
                                            <div className="flex-1">
                                                <Select placeholder="Product (or type below for service)..." options={productOptions}
                                                    value={item.productId || ''} onChange={(e) => updateItem(idx, 'productId', e.target.value)} />
                                            </div>
                                            <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:bg-red-50 p-2 rounded mt-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <Input label="Item Name / Title *" required
                                                value={item.productName} onChange={(e) => updateItem(idx, 'productName', e.target.value)} />
                                            <Input label="Detailed Description / Work Specs" placeholder="Custom work specs, alloy welding details..."
                                                value={item.description || ''} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <Input label="Qty" type="number" step="0.01" min="0.01"
                                                value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                                            <Input label="Unit Price" type="number" step="0.01" min="0"
                                                value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
                                            <Input label="Tax %" type="number" step="0.01" min="0"
                                                value={item.taxRate} onChange={(e) => updateItem(idx, 'taxRate', e.target.value)} />
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                                                <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium">{fmt(lTot)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Notes</h3>
                        <div className="space-y-4">
                            <Textarea label="Invoice Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                            <Textarea label="Payment Instructions" rows={2} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
                        </div>
                    </Card>
                </div>

                <div>
                    <Card className="p-6 sticky top-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(totals.sub)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(totals.tax)}</span></div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-600">Shipping</span>
                                <input type="number" step="0.01" min="0" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)}
                                    className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right" />
                            </div>
                            <div className="flex justify-between pt-3 border-t font-bold">
                                <span>Total</span><span className="text-primary-600">{fmt(totals.grand)}</span>
                            </div>
                        </div>
                        <Button variant="primary" fullWidth className="mt-6" onClick={submit} loading={createMutation.isPending}
                            disabled={!customerId || items.length === 0}>
                            <Save size={16} className="mr-1.5" /> Create Invoice
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}