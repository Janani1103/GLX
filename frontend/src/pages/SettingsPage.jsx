import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building2, DollarSign, Package, Save, Globe,
    Phone, Mail, MapPin, Hash, BadgeCheck, AlertTriangle,
    ChevronRight, CheckCircle2
} from 'lucide-react';

import { useSettings, useUpdateSettings } from '../features/settings/useSettings';

const settingsSchema = z.object({
    companyName: z.string().min(1, 'Company name required'),
    companyAddress: z.string().optional(),
    companyPhone: z.string().optional(),
    companyEmail: z.string().email('Invalid email').optional().or(z.literal('')),
    companyLogo: z.string().optional(),
    taxId: z.string().optional(),
    currency: z.string().min(1, 'Currency required'),
    currencySymbol: z.string().min(1, 'Symbol required'),
    defaultTaxRate: z.coerce.number().min(0),
    lowStockThreshold: z.coerce.number().min(0),
    managerSmsPhone: z.string().optional(),
    bossSignature: z.string().optional(),
    bossTitle: z.string().optional(),
    invoiceCustomTemplateUrl: z.string().optional(),
    quotationCustomTemplateUrl: z.string().optional(),
    activeInvoiceTemplate: z.string().optional(),
    activeQuotationTemplate: z.string().optional(),
});

const TABS = [
    { id: 'company',   label: 'Company Profile',    icon: Building2,  color: 'text-blue-500' },
    { id: 'finance',   label: 'Financial Defaults', icon: DollarSign, color: 'text-emerald-500' },
    { id: 'inventory', label: 'Inventory Settings', icon: Package,    color: 'text-amber-500' },
    { id: 'templates', label: 'Print Templates',    icon: BadgeCheck, color: 'text-purple-500' },
];

function SectionBadge({ icon: Icon, label, accent = 'blue' }) {
    const map = {
        blue:     'bg-blue-50 border-blue-200 text-blue-600',
        emerald:  'bg-emerald-50 border-emerald-200 text-emerald-600',
        amber:    'bg-amber-50 border-amber-200 text-amber-600',
        purple:   'bg-purple-50 border-purple-200 text-purple-600',
    };
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-5 ${map[accent]}`}>
            <Icon size={13} />
            <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
        </div>
    );
}

function StyledInput({ label, icon: Icon, error, type = 'text', step, placeholder, registration, required }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {label}{required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                        <Icon size={15} />
                    </div>
                )}
                <input
                    type={type}
                    step={step}
                    placeholder={placeholder}
                    {...registration}
                    className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 rounded-xl bg-white border text-sm text-gray-800 placeholder-gray-300 outline-none transition-all
                        ${error
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20'
                            : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                        }`}
                />
            </div>
            {error && (
                <p className="text-xs text-rose-500 flex items-center gap-1">
                    <AlertTriangle size={11} /> {error}
                </p>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const { data, isLoading } = useSettings();
    const updateMutation = useUpdateSettings();
    const [activeTab, setActiveTab] = useState('company');
    const [saved, setSaved] = useState(false);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            companyName: 'GLX Industries',
            currency: 'LKR',
            currencySymbol: 'Rs.',
            defaultTaxRate: 0,
            lowStockThreshold: 10,
            managerSmsPhone: '',
            bossTitle: 'Authorized Signature / Managing Director',
        },
    });

    const handleSignatureFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('Signature image file size must be less than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setValue('bossSignature', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (data?.data) reset(data.data);
    }, [data, reset]);

    const onSubmit = async (formData) => {
        await updateMutation.mutateAsync(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-6">

            {/* ── Page Header ─────────────────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-3">
                    <span>Admin</span>
                    <ChevronRight size={12} />
                    <span className="text-emerald-500 font-medium">System Settings</span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">System Settings</h1>
                        <p className="text-gray-400 text-sm mt-1">Configure company profile, financial defaults &amp; inventory behaviour</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        disabled={updateMutation.isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md
                            ${saved
                                ? 'bg-emerald-600 text-white shadow-emerald-200'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200'
                            }`}
                    >
                        {saved ? (
                            <><CheckCircle2 size={16} /> Saved!</>
                        ) : updateMutation.isPending ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                        ) : (
                            <><Save size={16} /> Save Settings</>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Layout ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">

                {/* Sidebar tabs */}
                <div className="w-full sm:w-52 sm:flex-shrink-0">
                    <nav className="flex flex-row sm:flex-col gap-1 overflow-x-auto pb-1 sm:pb-0">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all whitespace-nowrap flex-shrink-0 sm:flex-shrink sm:whitespace-normal
                                        ${isActive
                                            ? 'bg-white border border-gray-200 text-emerald-600 shadow-sm'
                                            : 'text-gray-500 hover:bg-white hover:text-gray-700 border border-transparent'
                                        }`}
                                >
                                    <Icon size={16} className={isActive ? 'text-emerald-500' : tab.color} />
                                    {tab.label}
                                    {isActive && <ChevronRight size={14} className="ml-auto text-emerald-400" />}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Company badge card */}
                    <div className="mt-4 sm:mt-6 p-4 rounded-xl bg-white border border-gray-200 shadow-sm hidden sm:block">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
                            <Building2 size={18} className="text-emerald-500" />
                        </div>
                        <p className="text-xs font-bold text-gray-800">GLX Industries</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Truck Body Engineers</p>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400">v1.0.0 · ERP Platform</p>
                        </div>
                    </div>
                </div>

                {/* Content panel */}
                <div className="flex-1">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-7">

                            {/* ── COMPANY PROFILE ───────────────────────── */}
                            {activeTab === 'company' && (
                                <div>
                                    <SectionBadge icon={Building2} label="Business Identity" accent="blue" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8">
                                        <StyledInput
                                            label="Company Name"
                                            icon={Building2}
                                            required
                                            error={errors.companyName?.message}
                                            registration={register('companyName')}
                                        />
                                        <StyledInput
                                            label="Tax ID / Registration No."
                                            icon={Hash}
                                            error={errors.taxId?.message}
                                            registration={register('taxId')}
                                        />
                                    </div>

                                    <SectionBadge icon={Globe} label="Contact Details" accent="blue" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <StyledInput
                                            label="Email Address"
                                            icon={Mail}
                                            type="email"
                                            placeholder="info@glxindustries.lk"
                                            error={errors.companyEmail?.message}
                                            registration={register('companyEmail')}
                                        />
                                        <StyledInput
                                            label="Phone Number"
                                            icon={Phone}
                                            placeholder="0777 140 680"
                                            error={errors.companyPhone?.message}
                                            registration={register('companyPhone')}
                                        />
                                        <StyledInput
                                            label="Manager SMS Phone"
                                            icon={Phone}
                                            placeholder="+94716666888"
                                            error={errors.managerSmsPhone?.message}
                                            registration={register('managerSmsPhone')}
                                        />
                                        <div className="col-span-2">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Company Address</label>
                                            <div className="relative group mt-1.5">
                                                <MapPin size={15} className="absolute left-3 top-3 text-gray-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                                                <textarea
                                                    rows={3}
                                                    placeholder="No. 123, Negoda Road, Weliweriya, Sri Lanka"
                                                    {...register('companyAddress')}
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-300 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <StyledInput
                                                label="Company Logo URL"
                                                icon={BadgeCheck}
                                                placeholder="https://example.com/logo.png"
                                                error={errors.companyLogo?.message}
                                                registration={register('companyLogo')}
                                            />
                                        </div>

                                        <div className="col-span-2 mt-2 p-4 rounded-xl border border-blue-100 bg-blue-50/40">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                                                <BadgeCheck size={16} className="text-blue-600" /> Authorized Boss / Admin Signature (for Payslips & Payment Sheets)
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                                <div className="space-y-3">
                                                    <StyledInput
                                                        label="Signatory Title / Name"
                                                        placeholder="Authorized Signature / Managing Director"
                                                        error={errors.bossTitle?.message}
                                                        registration={register('bossTitle')}
                                                    />
                                                    <div>
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upload E-Signature / Stamp Image</label>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleSignatureFileUpload}
                                                            className="mt-1 block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                                        />
                                                        <p className="text-[11px] text-gray-400 mt-1">PNG with transparent background or dark ink on white paper recommended (Max 2MB).</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Signature Preview</label>
                                                    <div className="h-28 w-full border border-dashed border-gray-300 rounded-xl bg-white flex items-center justify-center p-2 relative">
                                                        {watch('bossSignature') ? (
                                                            <img src={watch('bossSignature')} alt="Boss Signature Preview" className="max-h-24 max-w-full object-contain" />
                                                        ) : (
                                                            <span className="text-xs text-gray-400 font-medium">No signature uploaded yet</span>
                                                        )}
                                                    </div>
                                                    {watch('bossSignature') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setValue('bossSignature', '')}
                                                            className="mt-1.5 text-xs text-rose-600 hover:underline font-medium"
                                                        >
                                                            Remove Signature
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── FINANCIAL DEFAULTS ────────────────────── */}
                            {activeTab === 'finance' && (
                                <div>
                                    <SectionBadge icon={DollarSign} label="Currency Configuration" accent="emerald" />
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                                        <StyledInput
                                            label="System Currency"
                                            icon={Globe}
                                            placeholder="LKR"
                                            error={errors.currency?.message}
                                            registration={register('currency')}
                                        />
                                        <StyledInput
                                            label="Currency Symbol"
                                            icon={DollarSign}
                                            placeholder="Rs."
                                            error={errors.currencySymbol?.message}
                                            registration={register('currencySymbol')}
                                        />
                                        <StyledInput
                                            label="Default Tax Rate (%)"
                                            icon={Hash}
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            error={errors.defaultTaxRate?.message}
                                            registration={register('defaultTaxRate')}
                                        />
                                    </div>

                                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3">
                                        <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-700">Sri Lanka Rupee (LKR)</p>
                                            <p className="text-xs text-emerald-600/70 mt-0.5">
                                                All quotations, invoices, and cost summaries will use these currency settings system-wide.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── INVENTORY SETTINGS ────────────────────── */}
                            {activeTab === 'inventory' && (
                                <div>
                                    <SectionBadge icon={Package} label="Stock Alert Configuration" accent="amber" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                                        <StyledInput
                                            label="Low Stock Alert Threshold (units)"
                                            icon={AlertTriangle}
                                            type="number"
                                            placeholder="10"
                                            error={errors.lowStockThreshold?.message}
                                            registration={register('lowStockThreshold')}
                                        />
                                    </div>

                                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex gap-3">
                                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-amber-700">Low Stock Notifications</p>
                                            <p className="text-xs text-amber-600/70 mt-0.5">
                                                When any product's stock drops at or below this threshold, the system triggers a real-time alert and highlights it on the dashboard.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── PRINT TEMPLATES ───────────────────────── */}
                            {activeTab === 'templates' && (
                                <div>
                                    <SectionBadge icon={BadgeCheck} label="Custom Quotation & Invoice Templates" accent="purple" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                                        {/* Quotation Template */}
                                        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                                            <h4 className="font-bold text-sm text-gray-800">Quotation Print Template</h4>
                                            <StyledInput
                                                label="Custom Quotation Header/Background Image URL"
                                                icon={Globe}
                                                placeholder="https://example.com/quotation-header.png"
                                                error={errors.quotationCustomTemplateUrl?.message}
                                                registration={register('quotationCustomTemplateUrl')}
                                            />
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                                                    Default Quotation Print Mode
                                                </label>
                                                <select
                                                    {...register('activeQuotationTemplate')}
                                                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium outline-none focus:border-purple-500"
                                                >
                                                    <option value="default">System Default Template</option>
                                                    <option value="custom">Custom Uploaded Template</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Invoice Template */}
                                        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                                            <h4 className="font-bold text-sm text-gray-800">Invoice Print Template</h4>
                                            <StyledInput
                                                label="Custom Invoice Header/Background Image URL"
                                                icon={Globe}
                                                placeholder="https://example.com/invoice-header.png"
                                                error={errors.invoiceCustomTemplateUrl?.message}
                                                registration={register('invoiceCustomTemplateUrl')}
                                            />
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                                                    Default Invoice Print Mode
                                                </label>
                                                <select
                                                    {...register('activeInvoiceTemplate')}
                                                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium outline-none focus:border-purple-500"
                                                >
                                                    <option value="default">System Default Template</option>
                                                    <option value="custom">Custom Uploaded Template</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 flex gap-3">
                                        <CheckCircle2 size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-purple-700">Dynamic Template Selection</p>
                                            <p className="text-xs text-purple-600/70 mt-0.5">
                                                When printing or generating Invoices or Quotations, you can choose on-the-fly whether to use the system default template or your uploaded custom template.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Bottom action bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 px-1">
                            <p className="text-xs text-gray-400">
                                Changes take effect immediately across all users.
                            </p>
                            <button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md
                                    ${saved
                                        ? 'bg-emerald-600 text-white shadow-emerald-200'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200'
                                    }`}
                            >
                                {saved ? (
                                    <><CheckCircle2 size={16} /> Settings Saved!</>
                                ) : updateMutation.isPending ? (
                                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                                ) : (
                                    <><Save size={16} /> Save All Settings</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
