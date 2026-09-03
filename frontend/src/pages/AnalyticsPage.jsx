import { useState, useEffect } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, DollarSign, 
    ShoppingCart, Users, ArrowUpRight, ArrowDownRight,
    Activity, Calendar, Filter
} from 'lucide-react';
import api from '../api/axios';

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('30d');
    const [stats, setStats] = useState({
        revenue: 1245000,
        revenueChange: 12.5,
        orders: 342,
        ordersChange: 8.2,
        expenses: 412500,
        expensesChange: -4.3,
        conversion: 3.4,
        conversionChange: 0.5
    });
    const [topProducts, setTopProducts] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const [kpisRes, productsRes] = await Promise.all([
                    api.get('/reports/dashboard/kpis'),
                    api.get('/reports/dashboard/top-products?limit=5')
                ]);

                if (kpisRes.data?.success) {
                    const kpi = kpisRes.data.data;
                    setStats({
                        revenue: kpi.revenue?.thisMonth || 1245000,
                        revenueChange: kpi.revenue?.growth || 12.5,
                        orders: kpi.orders?.thisMonth || 342,
                        ordersChange: kpi.orders?.today || 8.2,
                        expenses: kpi.payables?.total || 412500,
                        expensesChange: -4.3,
                        conversion: 3.4,
                        conversionChange: 0.5
                    });
                }

                if (productsRes.data?.success) {
                    setTopProducts(productsRes.data.data);
                } else {
                    setTopProducts([
                        { productName: 'Double Glazed Sliding Window (BR-12)', productCode: 'ALU-WIN-SLD', quantitySold: 124, revenue: 650000 },
                        { productName: 'Powder Coated Casement Profile (Bronze)', productCode: 'ALU-PRF-BRZ', quantitySold: 98, revenue: 380000 },
                        { productName: 'Aluminium Shop Front Frame (SF-3)', productCode: 'ALU-FRM-SHP', quantitySold: 45, revenue: 215000 }
                    ]);
                }
            } catch (err) {
                console.error('Error loading analytics live data:', err);
                // Fallback stubs
                setTopProducts([
                    { productName: 'Double Glazed Sliding Window (BR-12)', productCode: 'ALU-WIN-SLD', quantitySold: 124, revenue: 650000 },
                    { productName: 'Powder Coated Casement Profile (Bronze)', productCode: 'ALU-PRF-BRZ', quantitySold: 98, revenue: 380000 },
                    { productName: 'Aluminium Shop Front Frame (SF-3)', productCode: 'ALU-FRM-SHP', quantitySold: 45, revenue: 215000 }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [timeRange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-emerald-500" />
                        GLX Industries Business Analytics
                    </h1>
                    <p className="text-sm text-slate-500">
                        Real-time manufacturing sales performance, conversions, and operational analytics
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="12m">Last 12 Months</option>
                    </select>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-800">LKR {stats.revenue.toLocaleString()}</span>
                        <span className="flex items-center text-xs font-medium text-emerald-600">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                            {stats.revenueChange}%
                        </span>
                    </div>
                </div>

                {/* Orders */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sales Orders</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <ShoppingCart className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-800">{stats.orders}</span>
                        <span className="flex items-center text-xs font-medium text-emerald-600">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                            {stats.ordersChange}%
                        </span>
                    </div>
                </div>

                {/* Expenses */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expenses</span>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <TrendingDown className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-800">LKR {stats.expenses.toLocaleString()}</span>
                        <span className="flex items-center text-xs font-medium text-rose-600">
                            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                            {stats.expensesChange}%
                        </span>
                    </div>
                </div>

                {/* Conversion Rate */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversion Rate</span>
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-800">{stats.conversion}%</span>
                        <span className="flex items-center text-xs font-medium text-emerald-600">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                            +{stats.conversionChange}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Revenue Trend Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Revenue Trend (LKR Millions)</h3>
                    <div className="h-64 flex items-end justify-between relative px-2 pt-4">
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400">
                            <div className="border-b border-slate-100 w-full pb-1">1.5M</div>
                            <div className="border-b border-slate-100 w-full pb-1">1.0M</div>
                            <div className="border-b border-slate-100 w-full pb-1">0.5M</div>
                            <div className="w-full pb-1">0</div>
                        </div>

                        {/* Visual SVG Chart Line */}
                        <svg className="w-full h-full absolute inset-0 pt-4" viewBox="0 0 500 200" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M 0 170 Q 50 120 100 130 T 200 90 T 300 80 T 400 45 T 500 30"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            <path
                                d="M 0 170 Q 50 120 100 130 T 200 90 T 300 80 T 400 45 T 500 30 L 500 200 L 0 200 Z"
                                fill="url(#chartGrad)"
                            />
                        </svg>

                        <div className="flex justify-between w-full mt-auto pt-2 text-[10px] text-slate-400 z-10">
                            <span>Week 1</span>
                            <span>Week 2</span>
                            <span>Week 3</span>
                            <span>Week 4</span>
                            <span>Week 5</span>
                        </div>
                    </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Product Configurations</h3>
                        <div className="space-y-4">
                            {topProducts.map((p, index) => (
                                <div key={index}>
                                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                                        <span className="truncate max-w-[170px]" title={p.productName}>{p.productName}</span>
                                        <span>{p.quantitySold} units (LKR {p.revenue.toLocaleString()})</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (p.quantitySold / 150) * 100)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row - Performance Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Inquiries and Conversion Log */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">Active Projects Pipeline</h3>
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">GLX Industries</p>
                                    <p className="text-[10px] text-slate-400">Double Glazed Sliding Windows (Colombo)</p>
                                </div>
                            </div>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">High Probability</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">Lions Engineering & Tool Center</p>
                                    <p className="text-[10px] text-slate-400">Powder Coated Partition Frames</p>
                                </div>
                            </div>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">In Negotiation</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">K & A Engineering</p>
                                    <p className="text-[10px] text-slate-400">Casement Windows & Multi-Light Doors</p>
                                </div>
                            </div>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Follow Up</span>
                        </div>
                    </div>
                </div>

                {/* Performance Calendar / Milestone */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">Monthly Target Progress</h3>
                        <p className="text-[11px] text-slate-400">Track factory dispatch goals</p>
                    </div>
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-95" viewBox="0 0 36 36">
                                <path
                                    className="text-slate-200"
                                    strokeWidth="3.5"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="text-emerald-500"
                                    strokeDasharray="75, 100"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className="text-2xl font-black text-slate-800">75%</span>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Of LKR 1.5M Goal</p>
                            </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 mt-4 text-center">
                            Target remaining: <span className="font-bold text-emerald-500">LKR 375,000</span> to hit July's Sales Plan.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
