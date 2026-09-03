import { useState, useEffect } from 'react';
import { 
    Coins, Calculator, Search, Printer, Download, 
    FileSpreadsheet, Users, HelpCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { exportToExcel } from '../utils/dataExport';

export default function EpfEtfPage() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(new Date().getFullYear()));

    useEffect(() => {
        const fetchEmployees = async () => {
            setLoading(true);
            try {
                const res = await api.get('/hr/employees', { params: { limit: 1000 } });
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setEmployees(res.data.data);
                }
            } catch (err) {
                console.error('Error fetching employees for EPF:', err);
                toast.error('Failed to load employee list');
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, []);

    // Perform EPF calculations
    const computedEPFData = employees.map(emp => {
        const salary = Number(emp.basicSalary) || Number(emp.baseSalary) || Number(emp.salary) || (emp.hourlyRate ? emp.hourlyRate * 200 : 50000);
        const epfRate = Number(emp.epfRate) || 8;
        const etfRate = Number(emp.etfRate) || 3;
        const epfEmployee = +(salary * (epfRate / 100)).toFixed(2);
        const epfEmployer = +(salary * 0.12).toFixed(2);
        const etfEmployer = +(salary * (etfRate / 100)).toFixed(2);
        const totalContribution = +(epfEmployee + epfEmployer + etfEmployer).toFixed(2);
        return {
            ...emp,
            salary,
            epfEmployee,
            epfEmployer,
            etfEmployer,
            totalContribution
        };
    });

    const filteredEPFData = computedEPFData.filter(emp => {
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
        return fullName.includes(search.toLowerCase()) || 
               (emp.employeeCode || '').toLowerCase().includes(search.toLowerCase()) ||
               (emp.epfNumber || '').toLowerCase().includes(search.toLowerCase());
    });

    // Totals
    const totalSalaries = filteredEPFData.reduce((acc, curr) => acc + curr.salary, 0);
    const totalEpfEmployee = filteredEPFData.reduce((acc, curr) => acc + curr.epfEmployee, 0);
    const totalEpfEmployer = filteredEPFData.reduce((acc, curr) => acc + curr.epfEmployer, 0);
    const totalEtfEmployer = filteredEPFData.reduce((acc, curr) => acc + curr.etfEmployer, 0);
    const grandTotal = totalEpfEmployee + totalEpfEmployer + totalEtfEmployer;

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        if (!filteredEPFData.length) {
            toast.error('No employee records to export');
            return;
        }

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(month, 10) - 1] || month;

        const excelData = filteredEPFData.map((emp, index) => ({
            'No': index + 1,
            'Emp Code': emp.employeeCode || '—',
            'Employee Name': `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
            'Designation': emp.designationId?.name || emp.departmentId?.name || 'Staff',
            'EPF Number': emp.epfNumber || '—',
            'Basic Salary (LKR)': Number(emp.salary.toFixed(2)),
            'Employee EPF 8% (LKR)': Number(emp.epfEmployee.toFixed(2)),
            'Employer EPF 12% (LKR)': Number(emp.epfEmployer.toFixed(2)),
            'Total EPF 20% (LKR)': Number((emp.epfEmployee + emp.epfEmployer).toFixed(2)),
            'Employer ETF 3% (LKR)': Number(emp.etfEmployer.toFixed(2)),
            'Total Contribution (LKR)': Number(emp.totalContribution.toFixed(2)),
        }));

        excelData.push({
            'No': '',
            'Emp Code': '',
            'Employee Name': 'TOTALS',
            'Designation': '',
            'EPF Number': '',
            'Basic Salary (LKR)': Number(totalSalaries.toFixed(2)),
            'Employee EPF 8% (LKR)': Number(totalEpfEmployee.toFixed(2)),
            'Employer EPF 12% (LKR)': Number(totalEpfEmployer.toFixed(2)),
            'Total EPF 20% (LKR)': Number((totalEpfEmployee + totalEpfEmployer).toFixed(2)),
            'Employer ETF 3% (LKR)': Number(totalEtfEmployer.toFixed(2)),
            'Total Contribution (LKR)': Number(grandTotal.toFixed(2)),
        });

        exportToExcel(excelData, `EPF_ETF_Schedule_${monthName}_${year}`, 'EPF_ETF_Schedule');
        toast.success('EPF/ETF Excel Schedule downloaded successfully!');
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 print:p-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Coins className="w-7 h-7 text-emerald-500" />
                        EPF & ETF Monthly Contribution Dashboard
                    </h1>
                    <p className="text-sm text-slate-500">
                        Manage statutory EPF (Employer 12%, Employee 8%) and ETF (Employer 3%) compliance reports
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700 transition"
                    >
                        <Printer size={14} />
                        Print Schedule
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Selection filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 print:hidden">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by employee name / ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none"
                    >
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                    </select>

                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none"
                    >
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total EPF Liability (20%)</span>
                        <p className="text-xl font-bold text-slate-800 mt-1">LKR {(totalEpfEmployee + totalEpfEmployer).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-450 mt-1">EE (8%): LKR {totalEpfEmployee.toLocaleString()} · ER (12%): LKR {totalEpfEmployer.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Calculator className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total ETF Liability (3%)</span>
                        <p className="text-xl font-bold text-slate-800 mt-1">LKR {totalEtfEmployer.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-450 mt-1">100% Employer Contribution</p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Coins className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grand Total Compliance due</span>
                        <p className="text-xl font-bold text-slate-800 mt-1">LKR {grandTotal.toLocaleString()}</p>
                        <p className="text-[9px] text-emerald-600 mt-1">Calculated across {filteredEPFData.length} active employees</p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Main Table schedule */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-800">EPF / ETF Schedule for {month}/{year}</h3>
                    <HelpCircle className="w-4 h-4 text-slate-450 cursor-pointer print:hidden" title="Statutory rates: Employees' Provident Fund (EPF) and Employees' Trust Fund (ETF) Sri Lanka" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="p-4">Emp Code</th>
                                <th className="p-4">Employee Name</th>
                                <th className="p-4 text-right">Basic Salary</th>
                                <th className="p-4 text-right">EE EPF (8%)</th>
                                <th className="p-4 text-right">ER EPF (12%)</th>
                                <th className="p-4 text-right">ER ETF (3%)</th>
                                <th className="p-4 text-right">Total Payable (23%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                            {filteredEPFData.map(emp => (
                                <tr key={emp._id} className="hover:bg-slate-50/50 text-slate-700">
                                    <td className="p-4 font-mono text-[11px]">{emp.employeeCode || '—'}</td>
                                    <td className="p-4 font-bold">{emp.firstName} {emp.lastName}</td>
                                    <td className="p-4 text-right font-medium">LKR {emp.salary.toLocaleString()}</td>
                                    <td className="p-4 text-right text-slate-600">LKR {emp.epfEmployee.toLocaleString()}</td>
                                    <td className="p-4 text-right text-slate-600">LKR {emp.epfEmployer.toLocaleString()}</td>
                                    <td className="p-4 text-right text-slate-600">LKR {emp.etfEmployer.toLocaleString()}</td>
                                    <td className="p-4 text-right text-emerald-600 font-bold">LKR {emp.totalContribution.toLocaleString()}</td>
                                </tr>
                            ))}
                            {/* Summary row */}
                            <tr className="bg-slate-50 text-xs font-bold text-slate-800 border-t border-slate-300">
                                <td colSpan="2" className="p-4">TOTALS</td>
                                <td className="p-4 text-right">LKR {totalSalaries.toLocaleString()}</td>
                                <td className="p-4 text-right">LKR {totalEpfEmployee.toLocaleString()}</td>
                                <td className="p-4 text-right">LKR {totalEpfEmployer.toLocaleString()}</td>
                                <td className="p-4 text-right">LKR {totalEtfEmployer.toLocaleString()}</td>
                                <td className="p-4 text-right text-emerald-600">LKR {grandTotal.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
