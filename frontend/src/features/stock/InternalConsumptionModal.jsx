import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldAlert, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import api from '../../api/axios';
import { useWarehouses } from '../warehouses/useWarehouses';

export default function InternalConsumptionModal({ isOpen, onClose }) {
    const queryClient = useQueryClient();
    const { data: warehousesData } = useWarehouses();
    const warehouses = warehousesData?.data || [];

    const [warehouseId, setWarehouseId] = useState('');
    const [category, setCategory] = useState('Row materials');
    const [description, setDescription] = useState('Lorry Body Building / Internal Stock Consumption');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Selected items in table
    const [items, setItems] = useState([
        { productId: '', quantity: 1, costPerUnit: 0, productName: '', availableStock: 0 }
    ]);

    // Set default warehouse
    if (!warehouseId && warehouses.length > 0) {
        const defaultWh = warehouses.find(w => w.isDefault) || warehouses[0];
        if (defaultWh) setWarehouseId(defaultWh._id);
    }

    // Fetch stock items for selected warehouse
    const { data: stockData, isLoading: stockLoading } = useQuery({
        queryKey: ['stockForConsumption', warehouseId],
        queryFn: async () => {
            if (!warehouseId) return [];
            const res = await api.get('/stock', { params: { warehouseId, limit: 500 } });
            return res.data?.data || [];
        },
        enabled: !!warehouseId && isOpen,
    });

    const stockList = stockData || [];

    // Map stock items for select dropdown
    const productOptions = useMemo(() => {
        return stockList.map(s => ({
            value: s.productId?._id || s.productId,
            label: `${s.productName} (${s.productCode}) — Stock: ${s.quantities?.openStock || 0} ${s.unitOfMeasure || 'units'} @ Rs ${s.costPerUnit || 0}`,
            costPerUnit: s.costPerUnit || 0,
            productName: s.productName,
            availableStock: s.quantities?.openStock || 0,
        }));
    }, [stockList]);

    const handleProductChange = (index, prodId) => {
        const selectedOpt = productOptions.find(o => o.value === prodId);
        setItems(prev => prev.map((item, idx) => {
            if (idx !== index) return item;
            return {
                ...item,
                productId: prodId,
                productName: selectedOpt ? selectedOpt.productName : '',
                costPerUnit: selectedOpt ? selectedOpt.costPerUnit : 0,
                availableStock: selectedOpt ? selectedOpt.availableStock : 0,
            };
        }));
    };

    const handleItemChange = (index, field, value) => {
        setItems(prev => prev.map((item, idx) => {
            if (idx !== index) return item;
            return { ...item, [field]: value };
        }));
    };

    const addItemRow = () => {
        setItems(prev => [...prev, { productId: '', quantity: 1, costPerUnit: 0, productName: '', availableStock: 0 }]);
    };

    const removeItemRow = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, idx) => idx !== index));
    };

    // Calculate total cost
    const grandTotalCost = useMemo(() => {
        return items.reduce((sum, item) => {
            const q = Number(item.quantity) || 0;
            const c = Number(item.costPerUnit) || 0;
            return sum + (q * c);
        }, 0);
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!warehouseId) {
            toast.error('Please select a warehouse');
            return;
        }

        const validItems = items.filter(i => i.productId && Number(i.quantity) > 0);
        if (validItems.length === 0) {
            toast.error('Please add at least one valid stock item and quantity');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                warehouseId,
                category,
                description,
                notes,
                items: validItems.map(i => ({
                    productId: i.productId,
                    quantity: Number(i.quantity),
                    costPerUnit: Number(i.costPerUnit),
                })),
            };

            const res = await api.post('/stock/internal-consumption', payload);
            toast.success(`Recorded Internal Consumption & Expense of LKR ${grandTotalCost.toLocaleString('en-LK')}`);

            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['pettyCash'] });
            queryClient.invalidateQueries({ queryKey: ['dailyPnL'] });

            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record internal stock consumption');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Internal Stock Consumption (Company Expense)"
            size="xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-800">
                    <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                        <strong className="font-semibold block mb-0.5">Company Expense Dispatch</strong>
                        Selecting items used internally (e.g. rivets, aluminum profiles for body building) will decrease stock quantity, calculate total expense, and automatically log it in Company Expenses / P&L.
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                        label="Warehouse"
                        required
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        options={warehouses.map(w => ({ value: w._id, label: w.name }))}
                    />

                    <Select
                        label="Expense Category"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        options={[
                            { value: 'Row materials', label: 'Row materials / Hardware (Body Building)' },
                            { value: 'Chemicals', label: 'Chemicals / Paints' },
                            { value: 'Maintenance', label: 'Maintenance & Repairs' },
                            { value: 'Stationery', label: 'Stationery / Consumables' },
                            { value: 'Welfare', label: 'Welfare / Project Support' },
                        ]}
                    />

                    <Input
                        label="Description / Purpose"
                        required
                        placeholder="e.g. Rivets used for Lorry Body Building"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                {/* Items Table */}
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Stock Items to Consume</h4>
                        <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                            <Plus size={14} className="mr-1" /> Add Stock Item
                        </Button>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="p-2.5">Stock Item</th>
                                    <th className="p-2.5 w-24 text-right">Available</th>
                                    <th className="p-2.5 w-28 text-right">Qty to Use</th>
                                    <th className="p-2.5 w-32 text-right">Cost/Unit (LKR)</th>
                                    <th className="p-2.5 w-32 text-right">Line Total (LKR)</th>
                                    <th className="p-2.5 w-12 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {items.map((item, idx) => {
                                    const subtotal = (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-2">
                                                <select
                                                    value={item.productId}
                                                    onChange={(e) => handleProductChange(idx, e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    required
                                                >
                                                    <option value="">-- Select Item --</option>
                                                    {productOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-2 text-right font-medium text-gray-600">
                                                {item.availableStock || 0}
                                            </td>
                                            <td className="p-2 text-right">
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-500 font-bold"
                                                    required
                                                />
                                            </td>
                                            <td className="p-2 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={item.costPerUnit}
                                                    onChange={(e) => handleItemChange(idx, 'costPerUnit', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                                                    required
                                                />
                                            </td>
                                            <td className="p-2 text-right font-bold text-gray-900">
                                                {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-2 text-center">
                                                {items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItemRow(idx)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Total Cost Display Card */}
                <div className="bg-primary-950 text-white rounded-xl p-4 flex items-center justify-between shadow-md">
                    <div>
                        <span className="text-[10px] font-bold text-primary-300 uppercase tracking-widest block">Total Company Expense Amount</span>
                        <span className="text-xs text-primary-200">Will automatically post to Petty Cash Expenses & PnL</span>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-white">LKR {grandTotalCost.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <Textarea
                    label="Notes (Optional)"
                    rows={2}
                    placeholder="Additional context about this stock dispatch..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />

                <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={submitting}>
                        <DollarSign size={16} className="mr-1" /> Record Internal Expense
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
