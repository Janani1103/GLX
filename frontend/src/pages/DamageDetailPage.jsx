import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useDamage, useDeleteDamage, useWriteOffDamage } from '../features/returns/useReturns';

const statusVariant = {
    pending: 'default',
    scrap: 'danger',
    repair: 'warning',
    return_to_supplier: 'info',
    write_off: 'danger',
};

export default function DamageDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading } = useDamage(id);
    const deleteMutation = useDeleteDamage();
    const writeOffMutation = useWriteOffDamage();

    const damage = data?.data;

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-LK');

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this damage record? This action cannot be undone.')) return;
        try {
            await deleteMutation.mutateAsync(id);
            navigate('/damages');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete damage');
        }
    };

    const handleWriteOff = async () => {
        if (!confirm('Are you sure you want to write off this damage?')) return;
        try {
            await writeOffMutation.mutateAsync(id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to write off damage');
        }
    };

    if (isLoading) return <div className="py-16 text-center text-gray-500">Loading...</div>;
    if (!damage) return <div className="py-16 text-center text-gray-500">Damage not found</div>;

    return (
        <div>
            <PageHeader
                title={
                    <>
                        Damage {damage.damageNumber}
                        <Badge variant={statusVariant[damage.disposition]} className="ml-2">
                            {damage.disposition.replace(/_/g, ' ')}
                        </Badge>
                    </>
                }
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => navigate('/damages')}>
                            <ArrowLeft size={16} className="mr-1.5" /> Back
                        </Button>
                        {!damage.writtenOff && (
                            <Button variant="outline" onClick={handleWriteOff} loading={writeOffMutation.isPending}>
                                Write Off
                            </Button>
                        )}
                        <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
                            <Trash2 size={16} className="mr-1.5" /> Delete
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Damage Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Reference #</p>
                                <p className="font-mono font-semibold">{damage.damageNumber}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Date Recorded</p>
                                <p className="font-semibold">{fmtDate(damage.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Product</p>
                                <p className="font-semibold">{damage.productName}</p>
                                <p className="font-mono text-xs text-gray-400">{damage.productCode}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Quantity</p>
                                <p className="font-semibold">{damage.quantity} {damage.unitOfMeasure || ''}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Source</p>
                                <Badge>{damage.source.replace(/_/g, ' ')}</Badge>
                            </div>
                            <div>
                                <p className="text-gray-500">Disposition</p>
                                <p className="font-semibold">{damage.disposition.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Written Off</p>
                                {damage.writtenOff ? (
                                    <Badge variant="danger">Yes</Badge>
                                ) : (
                                    <Badge>No</Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-gray-500">Warehouse</p>
                                <p className="font-semibold">{damage.warehouseName || '—'}</p>
                            </div>
                        </div>
                        {damage.description && (
                            <div className="mt-4">
                                <p className="text-gray-500 text-sm mb-1">Description</p>
                                <p className="text-sm">{damage.description}</p>
                            </div>
                        )}
                    </Card>
                </div>

                <div>
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Financial Impact</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Cost per Unit</span>
                                <span className="font-semibold">{fmt(damage.costPerUnit)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Quantity</span>
                                <span className="font-semibold">{damage.quantity}</span>
                            </div>
                            <div className="flex justify-between pt-3 border-t font-bold text-lg">
                                <span>Total Value Lost</span>
                                <span className="text-red-600">{fmt(damage.totalValue)}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
