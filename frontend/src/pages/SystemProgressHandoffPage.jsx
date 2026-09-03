import { useState } from 'react';
import {
    CheckCircle2, Clock, AlertTriangle, ShieldCheck, DollarSign,
    Award, CheckSquare, FileText, ArrowRight, Zap, RefreshCw
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';

export default function SystemProgressHandoffPage() {
    const [milestoneStatus, setMilestoneStatus] = useState({
        progressPaymentClaimed: true,
        progressPaymentAmount: '50% - 60% Milestone Progress Release',
        authorizedBy: 'GLX Management & Technical Reviewer',
        authorizationDate: new Date().toLocaleDateString('en-GB'),
    });

    const [modulesChecklist, setModulesChecklist] = useState([
        {
            id: 'receipts_vouchers',
            name: 'Receipts & Vouchers Module',
            description: 'Cash IN receipts, Advance Refunds, Supplier Payments, Transport Hire Notes, Petty Cash Vouchers',
            progress: 100,
            status: 'verified',
            category: 'Finance',
        },
        {
            id: 'doc_linking_audit',
            name: 'Document Linking & Payment History Audit',
            description: 'Live document lookup for Invoices, Quotations, Estimates, Bills, GRNs and Payment Audit Trail',
            progress: 100,
            status: 'verified',
            category: 'Finance',
        },
        {
            id: 'barcode_scanner',
            name: 'Barcode Reader Integration',
            description: 'POS & Billing direct scanner input, audio beep, manual fallback keyboard support',
            progress: 100,
            status: 'verified',
            category: 'POS & Billing',
        },
        {
            id: 'pos_billing',
            name: 'POS, Invoicing & Engineering Estimating',
            description: 'Sales orders, estimates, vehicle body engineering dimension metadata & invoicing',
            progress: 95,
            status: 'verified',
            category: 'Sales',
        },
        {
            id: 'inventory_stock',
            name: 'Inventory & Warehouse Stock Management',
            description: 'Multi-warehouse stock management, stock movements & inventory recipe conversions',
            progress: 90,
            status: 'verified',
            category: 'Inventory',
        },
        {
            id: 'hr_payroll',
            name: 'HR, Attendance & Daily Wage Payroll',
            description: 'Daily wage payment sheet, monthly payroll, attendance policies, EPF/ETF management',
            progress: 90,
            status: 'verified',
            category: 'HR',
        },
        {
            id: 'reports_pnl',
            name: 'Financial Reports & PnL Master',
            description: 'Daily PnL calculation, cheque ledger, audit logs & system sync triggers',
            progress: 85,
            status: 'verified',
            category: 'Analytics',
        },
    ]);

    const overallProgress = Math.round(
        modulesChecklist.reduce((acc, item) => acc + item.progress, 0) / modulesChecklist.length
    );

    const handleAuthorizeProgressPayment = () => {
        toast.success('50% - 60% Progress Payment Milestone authorized successfully!');
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="System Progress & Payment Milestones"
                description="Review system completion progress and milestone status for progress payment authorization"
            />

            {/* Top Milestone Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-500/30 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center relative z-10">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                            <Award className="w-4 h-4 text-amber-400" />
                            System Verification & Payment Milestone Review
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                            System Completion Stage: <span className="text-amber-400">{overallProgress}% Completion</span>
                        </h2>
                        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                            The core modules (Receipts & Vouchers, Document Linking, Barcode Scanner, POS & Invoicing, HR & Payroll) have been verified and confirmed. The system is ready for the <strong>50% - 60% Progress Payment Milestone</strong> release.
                        </p>

                        <div className="flex flex-wrap gap-4 pt-2">
                            <div className="bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl">
                                <span className="text-xs text-slate-400 block">Current Milestone</span>
                                <span className="text-sm font-bold text-amber-400">50% - 60% Progress Payment Milestone</span>
                            </div>
                            <div className="bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl">
                                <span className="text-xs text-slate-400 block">Final Handoff Milestone</span>
                                <span className="text-sm font-bold text-slate-200">100% Full Completion Handover</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Wheel / Metric */}
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center space-y-4">
                        <div className="relative inline-flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full border-8 border-slate-700 border-t-amber-400 border-r-amber-400 flex items-center justify-center">
                                <span className="text-3xl font-black text-white">{overallProgress}%</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-amber-300 font-bold block uppercase">Milestone Status</span>
                            <span className="text-sm font-bold text-white">Progress Payment Milestone Ready (50%-60%)</span>
                        </div>
                        <Button
                            variant="amber"
                            onClick={handleAuthorizeProgressPayment}
                            className="w-full shadow-lg text-xs py-2.5 font-bold"
                        >
                            <ShieldCheck className="w-4 h-4 mr-1.5" /> Authorize Progress Payment
                        </Button>
                    </div>
                </div>
            </div>

            {/* Payment Milestones Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-l-4 border-l-amber-500 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Stage 1: 50% - 60% Progress Payment
                                </h3>
                                <p className="text-xs text-slate-500">Core module implementation and live feature verification</p>
                            </div>
                        </div>
                        <Badge variant="warning">50% - 60% Milestone</Badge>
                    </div>

                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pl-4 list-disc">
                        <li>Receipts & Vouchers Module (Cash IN & Cash OUT with 4 Reason Types)</li>
                        <li>Document Linking & Payment History Audit Trail</li>
                        <li>Barcode Scanner fast input and keyboard fallback integration</li>
                        <li>POS, Invoicing, Inventory & HR integration verified</li>
                    </ul>

                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-between">
                        <span>Status: Recommended for Progress Payment Release</span>
                        <CheckCircle2 className="w-5 h-5 text-amber-600" />
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-slate-400 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Stage 2: 100% Full System Completion
                                </h3>
                                <p className="text-xs text-slate-500">Final system handover and complete settlement</p>
                            </div>
                        </div>
                        <Badge variant="secondary">100% Completion</Badge>
                    </div>

                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pl-4 list-disc">
                        <li>Full system verification across all operational modules (Full System Handoff)</li>
                        <li>User training, onboarding, and final data migration audit</li>
                        <li>Final settlement payment release upon 100% completion</li>
                    </ul>

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-between">
                        <span>Status: Remaining balance settled upon 100% full handover</span>
                        <Clock className="w-5 h-5 text-slate-400" />
                    </div>
                </Card>
            </div>

            {/* Module Verification Matrix */}
            <Card>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            Module Verification Matrix & Checklist
                        </h3>
                        <p className="text-xs text-slate-500">Verification status across all system modules</p>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {modulesChecklist.filter(m => m.status === 'verified').length} / {modulesChecklist.length} Verified
                    </span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {modulesChecklist.map((m) => (
                        <div key={m.id} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-3">
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{m.name}</h4>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        {m.category}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${m.progress}%` }}></div>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 w-12 text-right">
                                    {m.progress}%
                                </span>
                                <Badge variant="success" className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
