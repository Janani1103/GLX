import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';

import { productsApi } from '../features/products/productsApi';
import { useCreateRepair } from '../features/returns/useReturns';
import { useWarehouses } from '../features/warehouses/useWarehouses';

export default function RepairFormPage() {
    const navigate = useNavigate();
    const createMutation = useCreateRepair();

    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [warehouseId, setWarehouseId] = useState('');
    const [issueDescription, setIssueDescription] = useState('');
    const [priority, setPriority] = useState('normal');
    const [estimatedCost, setEstimatedCost] = useState(0);

    const { data: productsData } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => productsApi.list({ limit: 500 }),
    });
    const { data: warehousesData } = useWarehouses({ isActive: true });

    const products = productsData?.data || [];
    const warehouses = warehousesData?.data || [];

    const productOptions = products.map((p) => ({
        value: p._id,
        label: `${p.name} (${p.productCode})`,
    }));
    const warehouseOptions = warehouses.map((w) => ({
        value: w._id,
        label: `${w.name} (${w.warehouseCode})`,
    }));

    const submit = async () => {
        if (!productId) { toast.error('Please select a product'); return; }
        if (!quantity || quantity <= 0) { toast.error('Please enter a valid quantity'); return; }
        if (!warehouseId) { toast.error('Please select a warehouse'); return; }
        if (!issueDescription.trim()) { toast.error('Please describe the issue'); return; }

        try {
            const result = await createMutation.mutateAsync({
                productId,
                quantity: +quantity,
                warehouseId,
                issueDescription,
                priority,
                estimatedCost: +estimatedCost || 0,
            });
            toast.success('Repair created successfully!');
            navigate(`/repairs/${result.data._id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create repair');
        }
    };

    return (
        <div>
            <PageHeader
                title="New Repair Entry"
                subtitle="Create a new repair record for damaged or defective items"
                actions={
                    <Button variant="outline" onClick={() => navigate('/repairs')}>
                        <ArrowLeft size={16} className="mr-1.5" /> Back
                    </Button>
                }
            />

            <div className="max-w-2xl">
                <Card className="p-6">
                    <div className="space-y-4">
                        <Select
                            label="Product"
                            required
                            placeholder="Select product..."
                            options={productOptions}
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Quantity"
                                required
                                type="number"
                                step="1"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                            <Select
                                label="Warehouse"
                                required
                                placeholder="Select warehouse..."
                                options={warehouseOptions}
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                            />
                        </div>

                        <Textarea
                            label="Issue Description"
                            required
                            rows={4}
                            placeholder="Describe the issue or damage that needs repair..."
                            value={issueDescription}
                            onChange={(e) => setIssueDescription(e.target.value)}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Select
                                label="Priority"
                                options={[
                                    { value: 'low', label: 'Low' },
                                    { value: 'normal', label: 'Normal' },
                                    { value: 'high', label: 'High' },
                                    { value: 'urgent', label: 'Urgent' },
                                ]}
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                            />
                            <Input
                                label="Estimated Cost (LKR)"
                                type="number"
                                step="0.01"
                                min="0"
                                value={estimatedCost}
                                onChange={(e) => setEstimatedCost(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => navigate('/repairs')}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={submit}
                                loading={createMutation.isPending}
                            >
                                <Save size={16} className="mr-1.5" /> Create Repair
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
