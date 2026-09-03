import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { productFormSchema } from './productSchemas';
import { useCategories, useBrands, useUoms, useCreateProduct, useUpdateProduct } from './useProducts';
import { productsApi } from './productsApi';

export default function ProductFormModal({ isOpen, onClose, product = null, forceProductType = null }) {
    const isEdit = !!product;

    const { data: categoriesData } = useCategories();
    const { data: brandsData } = useBrands();
    const { data: uomsData } = useUoms();
    const createProduct = useCreateProduct();
    const updateProduct = useUpdateProduct();

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            productCode: '',
            productShortCode: '',
            type: 'trading',
            status: 'inactive',
            taxable: true,
            taxRate: 18,
            sellable: true,
            allowBackorder: false,
            minimumOrderQuantity: 1,
            basePrice: 0,
            cost: 0,
            minPrice: 0,
            initialQuantity: 0,
            brandId: '',
            canBeSold: true,
            canBePurchased: true,
            canBeManufactured: false,
        },
    });

    // When opening in edit mode, populate form
    useEffect(() => {
        if (isOpen && product) {
            reset({
                productCode: product.productCode || '',
                productShortCode: product.productShortCode || '',
                name: product.name || '',
                shortName: product.shortName || '',
                sku: product.sku || '',
                barcode: product.barcode || '',
                productType: product.productType || 'finished_good',
                canBeSold: product.canBeSold ?? true,
                canBePurchased: product.canBePurchased ?? true,
                canBeManufactured: product.canBeManufactured ?? false,
                description: product.description || '',
                categoryId: product.categoryId?._id || product.categoryId || '',
                brandId: product.brandId?._id || product.brandId || '',
                type: product.type || 'trading',
                unitOfMeasure: product.unitOfMeasure || '',
                basePrice: product.basePrice || 0,
                cost: product.costs?.standardCost || 0,
                minPrice: product.minPrice || 0,
                initialQuantity: product.quantities?.onHand || 0,
                mrp: product.mrp || 0,
                taxable: product.tax?.taxable ?? true,
                taxRate: product.tax?.taxRate ?? 18,
                hsCode: product.tax?.hsCode || '',
                minimumLevel: product.stockLevels?.minimumLevel || 0,
                reorderLevel: product.stockLevels?.reorderLevel || 0,
                maximumLevel: product.stockLevels?.maximumLevel || 0,
                unitsPerCarton: product.packaging?.unitsPerCarton || 1,
                cartonsPerPallet: product.packaging?.cartonsPerPallet || 1,
                minimumOrderQuantity: product.salesConfig?.minimumOrderQuantity || 1,
                sellable: product.salesConfig?.sellable ?? true,
                allowBackorder: product.salesConfig?.allowBackorder ?? false,
                status: product.status || 'active',
                notes: product.notes || '',
                brandId: product.brandId?._id || product.brandId || '',
            });
        } else if (isOpen && !product) {
            const rawCat = forceProductType === 'raw_material' && categoriesData?.data
                ? categoriesData.data.find(c => c.code === 'RAW' || c.name === 'Raw Material')
                : null;

            reset({
                productCode: '',
                productShortCode: '',
                type: 'trading',
                status: 'active',
                taxable: true,
                taxRate: 18,
                sellable: forceProductType === 'raw_material' ? false : true,
                allowBackorder: false,
                minimumOrderQuantity: 1,
                productType: forceProductType || 'raw_material',
                categoryId: rawCat ? rawCat._id : '',
                basePrice: 0,
                cost: 0,
                minPrice: 0,
                initialQuantity: 0,
                brandId: '',
                canBeSold: forceProductType === 'raw_material' ? false : true,
                canBePurchased: true,
                canBeManufactured: forceProductType === 'raw_material' ? false : true,
            });
        }
    }, [isOpen, product, reset, forceProductType, categoriesData]);

    const selectedCategoryId = watch('categoryId');
    const selectedProductShortCode = watch('productShortCode');
    const [isLoadingCode, setIsLoadingCode] = useState(false);

    useEffect(() => {
        if (!isEdit && isOpen && selectedCategoryId && selectedProductShortCode && selectedProductShortCode.length === 3) {
            const fetchNextCode = async () => {
                setIsLoadingCode(true);
                try {
                    const response = await productsApi.getNextCode(selectedCategoryId, selectedProductShortCode);
                    if (response?.success && response?.productCode) {
                        setValue('productCode', response.productCode);
                    }
                } catch (err) {
                    console.error('Failed to fetch next product code:', err);
                } finally {
                    setIsLoadingCode(false);
                }
            };
            fetchNextCode();
        } else if (!isEdit && isOpen && (!selectedCategoryId || !selectedProductShortCode || selectedProductShortCode.length !== 3)) {
            setValue('productCode', '');
        }
    }, [selectedCategoryId, selectedProductShortCode, isEdit, isOpen, setValue]);

    const onInvalid = (errors) => {
        console.error('Product validation failed:', errors);
        const errorList = Object.values(errors).map((err) => err.message);
        if (errorList.length > 0) {
            toast.error(`Validation error: ${errorList.join(', ')}`);
        }
    };

    const onSubmit = async (data) => {
        const rawCat = forceProductType === 'raw_material' && categoriesData?.data
            ? categoriesData.data.find(c => c.code === 'RAW' || c.name === 'Raw Material')
            : null;

        // Auto determine business line type
        let determinedType = 'trading';
        if (data.productType === 'finished_good') {
            determinedType = 'manufactured';
        } else if (data.productType === 'service') {
            determinedType = 'service';
        }

        // Transform flat form data back into nested structure for API
        const payload = {
            productCode: data.productCode || undefined,
            productShortCode: data.productShortCode || undefined,
            name: data.name,
            shortName: data.name.substring(0, 100),
            sku: data.sku || undefined,
            barcode: data.barcode || undefined,
            productType: forceProductType || data.productType,
            canBeSold: forceProductType === 'raw_material' ? false : data.canBeSold,
            canBePurchased: data.canBePurchased,
            canBeManufactured: data.canBeManufactured,
            description: data.description || undefined,
            categoryId: rawCat ? rawCat._id : data.categoryId,
            brandId: data.brandId || undefined,
            type: determinedType,
            unitOfMeasure: data.unitOfMeasure,
            basePrice: Number(data.basePrice) || 0,
            minPrice: Number(data.minPrice) || 0,
            initialQuantity: Number(data.initialQuantity) || 0,
            mrp: Number(data.basePrice) || 0,
            costs: {
                standardCost: Number(data.cost) || 0,
                averageCost: Number(data.cost) || 0,
                lastPurchaseCost: Number(data.cost) || 0,
            },
            tax: {
                taxable: true,
                taxRate: 18,
                hsCode: data.hsCode || undefined,
            },
            stockLevels: {
                minimumLevel: data.minimumLevel || 0,
                reorderLevel: data.reorderLevel || 0,
                maximumLevel: data.maximumLevel || 0,
            },
            packaging: {
                unitsPerCarton: 1,
                cartonsPerPallet: 1,
            },
            salesConfig: {
                minimumOrderQuantity: 1,
                sellable: forceProductType === 'raw_material' ? false : true,
                allowBackorder: false,
            },
            status: data.status || 'active',
            notes: data.notes || undefined,
        };

        try {
            if (isEdit) {
                await updateProduct.mutateAsync({ id: product._id, data: payload });
            } else {
                await createProduct.mutateAsync(payload);
            }
            onClose();
        } catch (err) {
            // Already handled in hook
        }
    };

    const categoryOptions = (categoriesData?.data || []).map((c) => ({
        value: c._id,
        label: `${c.name} (${c.code})`,
    }));
    const brandOptions = (brandsData?.data || []).map((b) => ({
        value: b._id,
        label: b.name,
    }));
    const uomOptions = (uomsData?.data || []).map((u) => ({
        value: u.symbol,
        label: `${u.name} (${u.symbol})`,
    }));

    const isLoading = createProduct.isPending || updateProduct.isPending;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? `Edit Product — ${product?.productCode}` : 'Create New Product'}
            size="lg"
        >
            <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Product / Material Name *"
                            required
                            placeholder="e.g. MS Channel 3'', Lorry Corner Bracket"
                            error={errors.name?.message}
                            {...register('name')}
                        />
                        <Select
                            label="Material Category *"
                            required
                            disabled={forceProductType === 'raw_material'}
                            error={errors.categoryId?.message}
                            options={categoryOptions}
                            {...register('categoryId')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="Short Code (e.g. MOR, CLR)"
                            maxLength={3}
                            placeholder="3 letter code"
                            disabled={isEdit}
                            error={errors.productShortCode?.message}
                            {...register('productShortCode')}
                        />
                        <Input
                            label="Product System Code"
                            disabled
                            placeholder={isLoadingCode ? "Generating..." : "Auto-generated after category/short code"}
                            error={errors.productCode?.message}
                            {...register('productCode')}
                        />
                        <Select
                            label="Inventory Product Type *"
                            required
                            disabled={forceProductType === 'raw_material'}
                            options={[
                                { value: 'raw_material', label: 'Raw Material (Extrusion, Steel, etc.)' },
                                { value: 'finished_good', label: 'Finished Lorry Body' },
                                { value: 'consumable', label: 'Consumable & Seals (Bolt, Paint, Beading)' },
                                { value: 'service', label: 'Labor Service' },
                            ]}
                            error={errors.productType?.message}
                            {...register('productType')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select
                            label="Unit of Measure (UOM) *"
                            required
                            error={errors.unitOfMeasure?.message}
                            options={uomOptions}
                            {...register('unitOfMeasure')}
                        />
                        <Select
                            label="Product Brand"
                            options={brandOptions}
                            placeholder="Select Brand"
                            error={errors.brandId?.message}
                            {...register('brandId')}
                        />
                        <Select
                            label="Status *"
                            required
                            error={errors.status?.message}
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                            ]}
                            {...register('status')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="SKU / Internal Code"
                            placeholder="e.g. SKU-1002"
                            error={errors.sku?.message}
                            {...register('sku')}
                        />
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-700">Barcode Number</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const generatedBarcode = 'BC' + Math.floor(100000000000 + Math.random() * 900000000000);
                                        setValue('barcode', generatedBarcode);
                                    }}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                                >
                                    ⚡ Auto-Generate Barcode
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Scan or enter barcode"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                {...register('barcode')}
                            />
                            {errors.barcode?.message && <p className="text-xs text-red-500">{errors.barcode.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Input
                            label="Cost (LKR) *"
                            type="number"
                            step="0.01"
                            required
                            error={errors.cost?.message}
                            {...register('cost')}
                        />
                        <Input
                            label="Selling Price (LKR) *"
                            type="number"
                            step="0.01"
                            required
                            error={errors.basePrice?.message}
                            {...register('basePrice')}
                        />
                        <Input
                            label="Minimum Price (LKR)"
                            type="number"
                            step="0.01"
                            error={errors.minPrice?.message}
                            {...register('minPrice')}
                        />
                        <Input
                            label="Initial Quantity *"
                            type="number"
                            required
                            disabled={isEdit}
                            placeholder={isEdit ? "Adjust via stock ledger" : "e.g. 50"}
                            error={errors.initialQuantity?.message}
                            {...register('initialQuantity')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('canBeSold')} />
                            Can be sold
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('canBePurchased')} />
                            Can be purchased
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('canBeManufactured')} />
                            Can be manufactured
                        </label>
                    </div>

                    <div className="pt-2">
                        <Textarea
                            label="Description"
                            rows={3}
                            placeholder="Optional specifications, dimensions or description..."
                            error={errors.description?.message}
                            {...register('description')}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <Button variant="outline" onClick={onClose} type="button" disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={isLoading}>
                        {isEdit ? 'Update Product' : 'Create Product'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}