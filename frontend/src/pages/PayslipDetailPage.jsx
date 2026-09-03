import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Share2, Copy, Eye, EyeOff, ShieldCheck, Download, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { usePayslip, usePublicPayslip } from '../features/hr/useHr';
import { useAuthStore } from '../store/authStore';
import { useSettings } from '../features/settings/useSettings';
import ProtectedView from '../components/security/ProtectedView';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayslipDetailPage({ isPublicView = false }) {
    const { payrollId, employeeId, token } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // Mode state: 'full' (Company Details) or 'short' (Without Company Name for Mobile/External Privacy)
    const [payslipMode, setPayslipMode] = useState('full'); // 'full' | 'short'
    const [watermarkEnabled, setWatermarkEnabled] = useState(false);
    const [hideHeaderAndSignature, setHideHeaderAndSignature] = useState(false);

    // Queries
    const { data: settingsData } = useSettings();
    const systemSettings = settingsData?.data || {};
    const bossSignatureUrl = systemSettings.bossSignature || '';
    const bossTitle = systemSettings.bossTitle || 'Authorized Signature / Managing Director';

    const internalQuery = usePayslip(payrollId, employeeId);
    const publicQuery = usePublicPayslip(token);

    const data = isPublicView ? publicQuery.data : internalQuery.data;
    const isLoading = isPublicView ? publicQuery.isLoading : internalQuery.isLoading;

    useEffect(() => {
        if (user?.role === 'employee' || isPublicView) {
            const handleKeyDown = (e) => {
                if (e.key === 'PrintScreen') {
                    toast.error('Screenshot attempt detected. Watermark active.', { icon: '🛡️' });
                    setWatermarkEnabled(true);
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [user, isPublicView]);

    const d = data?.data;
    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    if (isLoading) return <div className="py-16 text-center text-gray-500">Loading Payslip Details...</div>;
    if (!d) return <div className="py-16 text-center text-red-500 font-semibold">Payslip not found or invalid link.</div>;

    const { payslip: ps, payroll, employee } = d;
    const shareUrl = `${window.location.origin}/payslip/share/${ps?.payslipShareToken || token || ''}`;

    const copyShareLink = () => {
        navigator.clipboard.writeText(shareUrl);
        toast.success('Direct Payslip link copied to clipboard!');
    };

    return (
        <div className="space-y-6">
            {!isPublicView && (
                <div className="no-print">
                    <PageHeader title="Salary PaySlip Management"
                        description="View, export PDF, generate direct link, or switch view privacy mode"
                        actions={
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => {
                                    if (user?.role === 'employee') navigate('/dashboard');
                                    else navigate(`/payroll/${payrollId}`);
                                }}>
                                    <ArrowLeft size={16} className="mr-1.5" /> Back
                                </Button>
                                <Button variant="outline" onClick={copyShareLink}>
                                    <Share2 size={16} className="mr-1.5" /> Share Link
                                </Button>
                                <Button variant="primary" onClick={() => window.print()}>
                                    <Printer size={16} className="mr-1.5" /> PDF / Print
                                </Button>
                            </div>
                        } />
                </div>
            )}

            {/* PaySlip Mode Controls */}
            <div className="no-print bg-white p-4 rounded-xl border shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">PaySlip View Format:</span>
                    <div className="inline-flex rounded-lg border p-1 bg-gray-50">
                        <button onClick={() => setPayslipMode('full')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${payslipMode === 'full' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                            Full Pay Slip (ආයතනික - Company Details)
                        </button>
                        <button onClick={() => setPayslipMode('short')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${payslipMode === 'short' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                            Short Pay Slip (මොබයිල්/බාහිර - Without Company Name)
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-gray-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition">
                        <input
                            type="checkbox"
                            checked={hideHeaderAndSignature}
                            onChange={(e) => setHideHeaderAndSignature(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Print/Export WITHOUT Logo &amp; Boss Signature (ලෝගෝ හා අත්සන නොමැතිව)</span>
                    </label>

                    <button onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium">
                        <ShieldCheck size={14} className={watermarkEnabled ? "text-green-600" : "text-gray-400"} />
                        {watermarkEnabled ? 'Security Watermark ON' : 'Toggle Watermark'}
                    </button>
                    {ps?.payslipShareToken && (
                        <button onClick={copyShareLink} className="flex items-center gap-1 text-primary-600 hover:underline font-semibold">
                            <Copy size={13} /> Copy Direct Link
                        </button>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print, header, nav, aside { display: none !important; }
                    html, body, #root, main, .space-y-6 {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .card-print {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 auto !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        width: 100% !important;
                    }
                    .card-print * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .protected-shield-overlay, .security-watermark-overlay {
                        display: none !important;
                    }
                }
            `}} />

            {/* Main Payslip Container */}
            <ProtectedView title="Salary PaySlip" enableWatermark={false}>
                <Card className={`p-8 max-w-3xl mx-auto relative overflow-hidden card-print bg-white`}>
                    {watermarkEnabled && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center rotate-[-30deg] opacity-10 select-none text-red-600 font-extrabold text-5xl tracking-widest uppercase">
                            CONFIDENTIAL · GLX ERP SECURITY
                        </div>
                    )}

                    {/* Header Section */}
                    <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-start">
                        <div>
                            {(!hideHeaderAndSignature && payslipMode === 'full') ? (
                                <>
                                    {systemSettings.companyLogo && (
                                        <img src={systemSettings.companyLogo} alt="Logo" className="h-10 mb-1 object-contain" />
                                    )}
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{systemSettings.companyName || 'GLX INDUSTRIES (PVT) LTD'}</h1>
                                    <p className="text-xs font-semibold text-gray-600">No. 124, Heavy Industrial Zone, Sri Lanka · Reg No: PV-98741</p>
                                    <p className="text-xs text-gray-500 font-medium mt-1">Official Corporate Salary Statement</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">SALARY PAY SLIP</h1>
                                    <p className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded inline-block mt-1 border border-amber-200">
                                        Confidential Pay Slip Statement
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="text-right">
                            <Badge variant="info" className="text-xs font-bold font-mono">{payroll?.payrollNumber || 'PAY-SLIP'}</Badge>
                            <p className="text-sm font-bold text-gray-900 mt-1">{monthNames[(payroll?.periodMonth || 1) - 1]} {payroll?.periodYear}</p>
                            <p className="text-xs text-gray-500 font-mono">
                                {payroll?.periodStartDate ? new Date(payroll.periodStartDate).toLocaleDateString('en-LK') : ''} — {payroll?.periodEndDate ? new Date(payroll.periodEndDate).toLocaleDateString('en-LK') : ''}
                            </p>
                        </div>
                    </div>

                    {/* Employee Info Section */}
                    <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50/70 rounded-xl border text-sm">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employee Details</p>
                            <p className="font-bold text-base text-gray-900">{employee?.firstName || ps?.employeeName} {employee?.lastName || ''}</p>
                            <p className="font-mono text-xs font-semibold text-gray-700">{employee?.employeeCode || ps?.employeeCode}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{employee?.designation || 'Staff Member'} · {employee?.department || 'Operations'}</p>
                            <p className="text-xs text-gray-500 mt-1">Pay Basis: <span className="font-semibold capitalize">{employee?.paymentType?.replace('_', ' ') || 'Monthly'}</span></p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Statutory &amp; Bank</p>
                            <p className="text-xs">EPF No: <span className="font-mono font-semibold">{employee?.epfNumber || 'EPF-PENDING'}</span></p>
                            <p className="text-xs">Bank: <span className="font-semibold">{employee?.bankDetails?.bankName || 'Direct Cash / Bank'}</span></p>
                            <p className="text-xs">Account: <span className="font-mono">{employee?.bankDetails?.accountNumber || '—'}</span></p>
                        </div>
                    </div>

                    {/* Attendance Summary */}
                    <div className="mb-6 border rounded-lg p-3 bg-gray-50/40">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attendance Summary</p>
                        <div className="grid grid-cols-6 gap-2 text-center text-xs">
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">Working</p><p className="font-bold">{ps?.workingDays || 0}</p></div>
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">Present</p><p className="font-bold text-emerald-700">{ps?.daysPresent || 0}</p></div>
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">Absent</p><p className="font-bold text-red-600">{ps?.daysAbsent || 0}</p></div>
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">Leave</p><p className="font-bold text-blue-600">{ps?.leaveDays || 0}</p></div>
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">Uninformed</p><p className="font-bold text-amber-600">{ps?.uninformedLeaveDays || 0}</p></div>
                            <div className="p-1 bg-white rounded border"><p className="text-gray-500">OT Hrs</p><p className="font-bold">{ps?.overtimeHours || 0}</p></div>
                        </div>
                    </div>

                    {/* Earnings & Deductions Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Earnings */}
                        <div className="border rounded-xl p-4 bg-emerald-50/20">
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Earnings (ලැබීම්)</span>
                                <span className="text-xs">LKR</span>
                            </p>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-100">
                                        <td className="py-1 text-gray-700">Basic Wage / Salary</td>
                                        <td className="py-1 text-right font-medium">{fmt(ps?.basicSalary)}</td>
                                    </tr>
                                    {ps?.earnings?.map((e, i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="py-1 text-gray-700">{e.name}</td>
                                            <td className="py-1 text-right font-medium">{fmt(e.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold text-emerald-900 border-t border-emerald-300 pt-2">
                                        <td className="py-2">Gross Earnings</td>
                                        <td className="py-2 text-right">{fmt(ps?.grossEarnings)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Deductions */}
                        <div className="border rounded-xl p-4 bg-rose-50/20">
                            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Deductions (අඩු කිරීම්)</span>
                                <span className="text-xs">LKR</span>
                            </p>
                            <table className="w-full text-sm">
                                <tbody>
                                    {ps?.epfEmployeeContribution > 0 && (
                                        <tr className="border-b border-gray-100">
                                            <td className="py-1 text-gray-700">EPF Employee (8%)</td>
                                            <td className="py-1 text-right text-rose-600">-{fmt(ps.epfEmployeeContribution)}</td>
                                        </tr>
                                    )}
                                    {ps?.advanceDeducted > 0 && (
                                        <tr className="border-b border-gray-100 bg-amber-50/50">
                                            <td className="py-1 font-semibold text-amber-900">Salary Advance Deducted</td>
                                            <td className="py-1 text-right font-bold text-amber-700">-{fmt(ps.advanceDeducted)}</td>
                                        </tr>
                                    )}
                                    {ps?.deductions?.map((d, i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="py-1 text-gray-700">{d.name}</td>
                                            <td className="py-1 text-right text-rose-600">-{fmt(d.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold text-rose-900 border-t border-rose-300 pt-2">
                                        <td className="py-2">Total Deductions</td>
                                        <td className="py-2 text-right text-rose-600">-{fmt(ps?.totalDeductions)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Net Pay Box */}
                    <div className="mt-6 p-4 rounded-xl bg-gray-900 text-white flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">NET SALARY PAYABLE</p>
                            <p className="text-3xl font-black text-emerald-400">{fmt(ps?.netPay)}</p>
                        </div>
                        <div className="text-right text-xs text-gray-300 space-y-0.5 border-l border-gray-700 pl-4">
                            <p>EPF Employer Contribution (12%): <span className="font-semibold text-white">{fmt(ps?.epfEmployerContribution)}</span></p>
                            <p>ETF Employer Contribution (3%): <span className="font-semibold text-white">{fmt(ps?.etfContribution)}</span></p>
                        </div>
                    </div>

                    {/* Signatures & Authorization Footer */}
                    <div className="mt-10 pt-6 border-t border-dashed border-gray-300 flex justify-between items-end text-xs">
                        <div>
                            <p className="font-semibold text-gray-600 mb-8">Employee Signature:</p>
                            <div className="border-t border-gray-400 w-44"></div>
                            <p className="text-[11px] font-medium text-gray-700 mt-1">{employee?.firstName || ps?.employeeName} {employee?.lastName || ''}</p>
                        </div>

                        {!hideHeaderAndSignature && (
                            <div className="text-right flex flex-col items-end">
                                <p className="font-semibold text-gray-600 mb-1">Approved &amp; Authorized By:</p>
                                {bossSignatureUrl ? (
                                    <img src={bossSignatureUrl} alt="Boss Signature" className="h-12 max-w-[180px] object-contain mb-1" />
                                ) : (
                                    <div className="h-10 w-44 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400 my-1">
                                        [ Boss Signature ]
                                    </div>
                                )}
                                <div className="border-t border-gray-400 w-48 mt-1"></div>
                                <p className="text-[11px] font-bold text-gray-900 mt-0.5">{bossTitle}</p>
                                <p className="text-[10px] text-gray-500">{systemSettings.companyName || 'GLX Industries (Pvt) Ltd'}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500">
                        {(!hideHeaderAndSignature && payslipMode === 'full') ? (
                            <p>This is an official system-generated corporate payslip of GLX Industries.</p>
                        ) : (
                            <p>Discreet / Mobile Pay Slip — Company Details hidden for privacy.</p>
                        )}
                    </div>
                </Card>
            </ProtectedView>
        </div>
    );
}