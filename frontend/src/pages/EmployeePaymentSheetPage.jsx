import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw, Upload, CheckSquare, Square, FileSignature } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useSettings, useUpdateSettings } from '../features/settings/useSettings';
import ProtectedView from '../components/security/ProtectedView';

export default function EmployeePaymentSheetPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: settingsData } = useSettings();
    const updateSettings = useUpdateSettings();

    const systemSettings = settingsData?.data || {};

    // Default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Toggle: Hide Logo & Boss Signature on Download/Print
    const [hideHeaderAndSignature, setHideHeaderAndSignature] = useState(false);
    // Signature management modal/input state
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [customBossTitle, setCustomBossTitle] = useState('');

    const bossSignatureUrl = systemSettings.bossSignature || '';
    const bossTitle = systemSettings.bossTitle || 'Authorized Signature / Managing Director';

    const loadSheet = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hr/employees/${id}/payment-sheet`, {
                params: { startDate, endDate }
            });
            if (res.data && res.data.success) {
                setData(res.data.data);
            } else {
                toast.error('Failed to load payment sheet details.');
            }
        } catch (err) {
            toast.error('Error fetching payment sheet: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSheet();
    }, [id]);

    useEffect(() => {
        if (systemSettings.bossTitle) {
            setCustomBossTitle(systemSettings.bossTitle);
        }
    }, [systemSettings.bossTitle]);

    const handleSignatureUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Signature image file size must be less than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    await updateSettings.mutateAsync({
                        ...systemSettings,
                        bossSignature: reader.result,
                        bossTitle: customBossTitle || bossTitle,
                    });
                    toast.success('Boss signature updated & auto-filled on payment sheet!');
                    setShowSignatureModal(false);
                } catch (err) {
                    toast.error('Failed to save signature: ' + err.message);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveTitle = async () => {
        try {
            await updateSettings.mutateAsync({
                ...systemSettings,
                bossTitle: customBossTitle,
            });
            toast.success('Signatory title updated!');
            setShowSignatureModal(false);
        } catch (err) {
            toast.error('Failed to save title: ' + err.message);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    return (
        <div className="p-4 max-w-4xl mx-auto font-calibri">
            {/* Header controls (hidden on print) */}
            <div className="no-print bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-3">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/employees/${id}`)}>
                            <ArrowLeft size={16} className="mr-1" /> Back to Profile
                        </Button>
                        <h2 className="text-sm font-bold text-gray-700 uppercase">Employee Payment Sheet Control</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 text-xs">
                            <label className="font-bold text-gray-600">From:</label>
                            <input type="date" className="border rounded px-2 py-1 bg-gray-50 text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                            <label className="font-bold text-gray-600">To:</label>
                            <input type="date" className="border rounded px-2 py-1 bg-gray-50 text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <Button variant="primary" size="sm" onClick={loadSheet} loading={loading}>
                            <RefreshCw size={14} className="mr-1" /> Load
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer size={14} className="mr-1" /> Print Report
                        </Button>
                    </div>
                </div>

                {/* Signature & Print Mode Options Bar */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Toggle Checkbox: Hide Logo & Boss Signature */}
                    <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-gray-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition">
                        <input
                            type="checkbox"
                            checked={hideHeaderAndSignature}
                            onChange={(e) => setHideHeaderAndSignature(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Download / Print WITHOUT Logo &amp; Boss Signature (ලෝගෝ හා අත්සන නොමැතිව)</span>
                    </label>

                    {/* Boss Signature Quick Config Button */}
                    <button
                        type="button"
                        onClick={() => setShowSignatureModal(!showSignatureModal)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition"
                    >
                        <FileSignature size={14} />
                        {bossSignatureUrl ? 'Change Boss Signature' : 'Upload Boss Signature'}
                    </button>
                </div>

                {/* Inline Boss Signature Modal / Popover */}
                {showSignatureModal && (
                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3 mt-1">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                                <FileSignature size={15} /> Admin / Boss Signature Configuration
                            </h4>
                            <button onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕ Close</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <div>
                                <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Signatory Title / Name</label>
                                <input
                                    type="text"
                                    value={customBossTitle}
                                    onChange={(e) => setCustomBossTitle(e.target.value)}
                                    placeholder="Authorized Signature / Managing Director"
                                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleSaveTitle}
                                    className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded-md"
                                >
                                    Save Title
                                </button>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Upload Signature Image (PNG/JPG)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSignatureUpload}
                                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                />
                                {bossSignatureUrl && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[11px] text-gray-500">Current:</span>
                                        <img src={bossSignatureUrl} alt="Signature Preview" className="h-8 max-w-[120px] object-contain border bg-white p-0.5 rounded" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loading && (
                <div className="py-16 text-center text-gray-500 flex justify-center items-center gap-2">
                    <RefreshCw size={18} className="animate-spin text-blue-600" />
                    <span>Calculating work hours and generating sheet...</span>
                </div>
            )}

            {/* Printable Payment Sheet */}
            {data && !loading && (
                <ProtectedView title="Employee Payment Sheet">
                    <Card className="bg-white p-10 border border-gray-300 rounded shadow-none text-gray-900 text-sm leading-relaxed max-w-[800px] mx-auto print:border-0 print:p-0">
                        
                        {/* Brand Header */}
                        {!hideHeaderAndSignature ? (
                            <div className="text-center mb-6">
                                <div className="flex justify-center mb-1">
                                    <img src={systemSettings.companyLogo || "/logo.jpg"} alt="GLX Logo" className="h-12 w-12 object-contain filter grayscale" />
                                </div>
                                <h1 className="text-xl font-bold uppercase tracking-wider">{systemSettings.companyName || 'GLX INDUSTRIES'}</h1>
                                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-700 border-b pb-2 max-w-[320px] mx-auto border-gray-400 mt-0.5">
                                    EMPLOYEE PAYMENT SHEET
                                </h2>
                            </div>
                        ) : (
                            <div className="text-center mb-6 pt-2">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 border-b pb-2 max-w-[320px] mx-auto border-gray-400">
                                    EMPLOYEE PAYMENT SHEET
                                </h2>
                            </div>
                        )}

                        {/* Metadata Section */}
                        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-[13px] border-b pb-4 mb-4 border-gray-300 font-calibri">
                            <div className="flex gap-2">
                                <span className="font-semibold text-gray-600 w-28">Name :</span>
                                <span className="font-bold text-gray-950">{data.employee.name}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-gray-600 w-28">Salary Per Hour :</span>
                                <span className="font-bold font-mono">{formatCurrency(data.employee.hourlyRate)}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-gray-600 w-28">Date From :</span>
                                <span>{data.startDate}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-gray-600 w-28">Date To :</span>
                                <span>{data.endDate}</span>
                            </div>
                        </div>

                        {/* Sheet Table */}
                        <table className="w-full text-xs text-left border-collapse font-calibri mb-6">
                            <thead>
                                <tr className="border-b-2 border-t border-gray-400 uppercase text-[10px] text-gray-800 font-bold">
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3 text-center">IN</th>
                                    <th className="py-2.5 px-3 text-center">OUT</th>
                                    <th className="py-2.5 px-3 text-center">HOURS</th>
                                    <th className="py-2.5 px-3 text-right">DAY SALARY</th>
                                    <th className="py-2.5 px-3 text-right">ADVANCE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {data.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium text-gray-700">{row.date}</td>
                                        <td className="py-2 px-3 text-center font-mono text-gray-600">{row.inTime}</td>
                                        <td className="py-2 px-3 text-center font-mono text-gray-600">{row.outTime}</td>
                                        <td className="py-2 px-3 text-center font-mono font-semibold text-gray-800">{row.hours}</td>
                                        <td className="py-2 px-3 text-right font-mono text-gray-800">
                                            {row.daySalary > 0 ? formatCurrency(row.daySalary) : '0.00'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-red-600">
                                            {row.advance > 0 ? formatCurrency(row.advance) : '0.00'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals Summary */}
                        <div className="flex justify-end pt-2 border-t-2 border-gray-400 font-calibri">
                            <div className="w-64 text-xs space-y-2">
                                <div className="flex justify-between font-semibold text-gray-700">
                                    <span>Total Salary :</span>
                                    <span className="font-mono">{formatCurrency(data.totalSalary)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-red-600">
                                    <span>Total Advances :</span>
                                    <span className="font-mono">-{formatCurrency(data.totalAdvances)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-300">
                                    <span>Net Salary :</span>
                                    <span className="font-mono text-blue-900 border-b-4 border-double border-gray-900 pb-0.5">
                                        {formatCurrency(data.netSalary)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures & Approval Footer Section */}
                        <div className="mt-12 pt-6 border-t border-dashed border-gray-300 flex justify-between items-end text-xs font-calibri">
                            <div>
                                <p className="font-semibold text-gray-600 mb-8">Employee Signature:</p>
                                <div className="border-t border-gray-400 w-44"></div>
                                <p className="text-[11px] font-medium text-gray-700 mt-1">{data.employee.name}</p>
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
                    </Card>
                </ProtectedView>
            )}
        </div>
    );
}
