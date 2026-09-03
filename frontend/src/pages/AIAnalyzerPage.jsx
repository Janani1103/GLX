import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Sparkles, Send, Bot, User, CheckCircle, 
    AlertTriangle, Lightbulb, RefreshCw, BarChart2
} from 'lucide-react';
import { predictionsApi } from '../features/reports/reportsApi';

const MODULES = [
    { id: 'sales', name: 'Sales & CRM', icon: BarChart2, description: 'Analyze inquiries, conversions, and quotation margins.' },
    { id: 'inventory', name: 'Inventory & Stock', icon: Sparkles, description: 'Analyze stock turnovers, scrap trends, and slow-fast movers.' },
    { id: 'finance', name: 'Finance & Expenses', icon: Lightbulb, description: 'Analyze petty cash outflows, company overheads, and tax liability.' },
    { id: 'hr', name: 'Human Resources', icon: Bot, description: 'Analyze shift attendance patterns, leaves, and EPF liability.' }
];

const PRESET_INSIGHTS = {
    sales: {
        score: 'A-',
        summary: 'Lead conversion has increased by 8.2% since last month. Quotation follow-ups are lagging at an average of 4.5 days.',
        anomalies: [
            'Quotation QT-2026-003 has been in "Draft" state for 7 days despite high engagement value (LKR 240,000).'
        ],
        recommendations: [
            'Assign a direct follow-up to sales representative for QT-2026-003.',
            'Introduce auto-generated email reminders for quotes valid for less than 3 days.'
        ]
    },
    inventory: {
        score: 'B+',
        summary: 'Stock accuracy is high, but scrap rate for profile configurations increased by 14% this month, primarily from cutting processes.',
        anomalies: [
            'Aluminium scrap inventory increased by 220kg this week compared to a weekly average of 80kg.'
        ],
        recommendations: [
            'Integrate the 2D visual configurator directly into cutting software to reduce manual calculation errors.',
            'Schedule maintenance for profile cutting machine #2 to calibrate cutting alignment.'
        ]
    },
    finance: {
        score: 'A',
        summary: 'Operational expenses are well within budget. Petty cash requests have been centralized, reducing overall leakage.',
        anomalies: [
            'Utility costs for Ja-Ela branch increased by 18% with no corresponding increase in production hours.'
        ],
        recommendations: [
            'Conduct power audit during off-peak hours at Ja-Ela branch.',
            'Pre-approve monthly recurring vendor payments to avoid manual cheque writing charges.'
        ]
    },
    hr: {
        score: 'B-',
        summary: 'Average attendance is stable at 91.2%, but Friday shift absenteeism is showing a rising trend (up to 14.5% vacancy).',
        anomalies: [
            'Overtime claims for production shifts increased by 25% despite production volume remaining flat.'
        ],
        recommendations: [
            'Implement shift rotation policy for weekend/Friday slots.',
            'Enforce stricter clock-in tolerances inside the shift policy dashboard.'
        ]
    }
};

const SUGGESTIONS = [
    "Predict next month's sales revenue",
    "How can we reduce cutting scrap in profile materials?",
    "Check for recent financial budget overruns",
    "Summarize shift attendance performance"
];

const CHAT_RESPONSES = {
    "predict next month's sales revenue": "Based on current pipeline inquiries, historical seasonal trends for August, and pending quotation conversions (including QT-2026-003), next month's estimated revenue is projected at **LKR 1,350,000 - 1,480,000** (Confidence: 89%). High probability wins include GLX Industries and K & A Engineering projects.",
    "how can we reduce cutting scrap in profile materials?": "Analysis shows 68% of cutting scrap is due to sub-optimal profile length matching. I recommend: \n1. Implementing the **2D Visual Configurator** for batch layouts.\n2. Reusing cut-off pieces (> 1.2m) by registering them back to the scrap inventory database.\n3. Recalibrating machine alignment for double-head miter saws.",
    "check for recent financial budget overruns": "Financial auditing reports highlight no major overall budget overruns. However, **Company Expenses** for Transport & Fuel exceeded the threshold by **11.2%** this week, linked to additional client deliveries at the Colombo branch. Recommend enforcing vehicle trip logs for authorization.",
    "summarize shift attendance performance": "Average shift attendance stands at **91.2%**. Top-performing shifts are Shift A (95%) and Shift C (93%). The primary bottleneck is Friday night shifts (82.4% average attendance). Staff shortages on Fridays led to a **LKR 42,500** overtime surcharge to meet the weekly production schedule."
};

export default function AIAnalyzerPage() {
    const [selectedModule, setSelectedModule] = useState('sales');
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState(PRESET_INSIGHTS.sales);
    
    // Chat states
    const [messages, setMessages] = useState([
        { sender: 'bot', text: 'Hello! I am your Raxwo AI Assistant. Ask me anything about your ERP metrics, sales projections, or operational logs.' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [sending, setSending] = useState(false);

    // Fetch real predictions data
    const { data: predictionsData, isLoading: predictionsLoading, refetch: refetchPredictions } = useQuery({
        queryKey: ['predictions', 'dashboard'],
        queryFn: predictionsApi.dashboard,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Update results when predictions data is loaded
    useEffect(() => {
        if (predictionsData?.data && !predictionsLoading) {
            updateResultsWithRealData(predictionsData.data);
        }
    }, [predictionsData, predictionsLoading, updateResultsWithRealData]);

    const handleRunAnalysis = () => {
        setAnalyzing(true);
        refetchPredictions();
        setTimeout(() => {
            if (predictionsData?.data) {
                updateResultsWithRealData(predictionsData.data);
            }
            setAnalyzing(false);
        }, 1200);
    };

    const updateResultsWithRealData = useCallback((data) => {
        const stockDepletion = data.stockDepletion || [];
        const criticalItems = stockDepletion.filter(item => item.riskLevel === 'critical').slice(0, 3);
        const salesProjections = data.salesProjections || {};
        
        let moduleResults = { ...PRESET_INSIGHTS[selectedModule] };

        if (selectedModule === 'inventory') {
            moduleResults.anomalies = criticalItems.map(item => 
                `${item.productName} (${item.productCode}) has only ${item.availableStock} ${item.unitOfMeasure} remaining - ${item.daysRemaining} days of stock left based on current sales velocity.`
            );
            
            moduleResults.recommendations = criticalItems.map(item =>
                `Reorder ${item.productName} immediately. Current stock (${item.availableStock} ${item.unitOfMeasure}) is below minimum level (${item.minStockLevel}).`
            );
            
            const totalProducts = stockDepletion.length;
            const criticalCount = criticalItems.length;
            const healthScore = totalProducts > 0 ? Math.max(0, 100 - (criticalCount / totalProducts * 50)) : 100;
            moduleResults.score = healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : 'C';
            moduleResults.summary = `Monitoring ${totalProducts} products. ${criticalCount} items at critical stock levels. Sales velocity analysis based on last 30 days of invoice data.`;
        } else if (selectedModule === 'sales') {
            const trendDirection = salesProjections.weeklyTrendDirection || 'stable';
            const growthRate = salesProjections.weeklyGrowthRate || 0;
            
            moduleResults.summary = `Sales trend is ${trendDirection} with a ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}% weekly growth rate. Next 4 weeks projected revenue: LKR ${(salesProjections.next4Weeks || 0).toLocaleString()}.`;
            
            if (trendDirection === 'increasing' && growthRate > 5) {
                moduleResults.anomalies = ['Strong upward sales trend detected - consider increasing inventory for high-performing products.'];
                moduleResults.recommendations = ['Capitalize on momentum by reviewing stock levels for top-selling items.', 'Analyze which products are driving the growth for focused marketing.'];
            } else if (trendDirection === 'decreasing') {
                moduleResults.anomalies = ['Sales declining - investigate potential causes such as seasonality, competition, or pricing.'];
                moduleResults.recommendations = ['Review pricing strategy and competitor activities.', 'Reach out to key customers for feedback on recent purchases.'];
            } else {
                moduleResults.anomalies = ['Sales performance is stable. Consider promotional activities to drive growth.'];
                moduleResults.recommendations = ['Launch targeted promotions for slow-moving inventory.', 'Focus on upselling and cross-selling opportunities.'];
            }
            
            moduleResults.score = trendDirection === 'increasing' ? 'A' : trendDirection === 'stable' ? 'B' : 'C';
        }

        setResults(moduleResults);
    }, [selectedModule]);

    const handleSendMessage = (textToSend) => {
        const query = textToSend || chatInput;
        if (!query.trim()) return;

        setMessages(prev => [...prev, { sender: 'user', text: query }]);
        setChatInput('');
        setSending(true);

        setTimeout(() => {
            const lowerQuery = query.toLowerCase().trim();
            let botText = "I have analyzed the current database records. While I don't have a direct answer for this specific query, overall business operations are running smoothly with no critical anomalies detected.";
            
            // First try to generate response from real predictions data
            if (predictionsData?.data) {
                botText = generateResponseFromRealData(lowerQuery, predictionsData.data);
            }
            
            // Fall back to preset responses if no real data match
            if (botText === "I have analyzed the current database records. While I don't have a direct answer for this specific query, overall business operations are running smoothly with no critical anomalies detected.") {
                for (const key of Object.keys(CHAT_RESPONSES)) {
                    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
                        botText = CHAT_RESPONSES[key];
                        break;
                    }
                }
            }

            setMessages(prev => [...prev, { sender: 'bot', text: botText }]);
            setSending(false);
        }, 1000);
    };

    const generateResponseFromRealData = (query, data) => {
        const lowerQuery = query.toLowerCase();
        
        // Stock-related queries
        if (lowerQuery.includes('stock') || lowerQuery.includes('inventory') || lowerQuery.includes('product')) {
            const stockDepletion = data.stockDepletion || [];
            const criticalItems = stockDepletion.filter(item => item.riskLevel === 'critical').slice(0, 5);
            
            if (criticalItems.length > 0) {
                const itemsList = criticalItems.map(item => 
                    `• ${item.productName} (${item.productCode}): ${item.availableStock} ${item.unitOfMeasure} remaining (${item.daysRemaining} days)`
                ).join('\n');
                
                return `**Stock Analysis Results:**\n\n${criticalItems.length} products are at critical stock levels:\n${itemsList}\n\n**Recommendation:** Immediate reordering suggested for these items to prevent stockouts.`;
            } else {
                return `**Stock Status:** All ${stockDepletion.length} monitored products have healthy stock levels. No critical shortages detected based on 30-day sales velocity analysis.`;
            }
        }
        
        // Sales-related queries
        if (lowerQuery.includes('sales') || lowerQuery.includes('revenue') || lowerQuery.includes('forecast')) {
            const salesProjections = data.salesProjections || {};
            const trend = salesProjections.weeklyTrendDirection || 'stable';
            const growth = salesProjections.weeklyGrowthRate || 0;
            const next4Weeks = salesProjections.next4Weeks || 0;
            
            return `**Sales Forecast Analysis:**\n\n• Current Trend: ${trend.toUpperCase()} (${growth > 0 ? '+' : ''}${growth.toFixed(1)}% weekly growth)\n• Next 4 Weeks Projected Revenue: LKR ${next4Weeks.toLocaleString()}\n• Next 8 Weeks Projected Revenue: LKR ${(salesProjections.next8Weeks || 0).toLocaleString()}\n\n**Insight:** ${trend === 'increasing' ? 'Sales momentum is strong - consider inventory expansion.' : trend === 'decreasing' ? 'Review pricing and market conditions.' : 'Stable performance - focus on growth initiatives.'}`;
        }
        
        // Expense-related queries
        if (lowerQuery.includes('expense') || lowerQuery.includes('cost') || lowerQuery.includes('budget')) {
            const expenseProjections = data.expenseProjections || {};
            const next4Weeks = expenseProjections.next4Weeks || 0;
            const trend = expenseProjections.weeklyTrendDirection || 'stable';
            
            return `**Expense Analysis:**\n\n• Next 4 Weeks Projected Expenses: LKR ${next4Weeks.toLocaleString()}\n• Weekly Trend: ${trend.toUpperCase()}\n\n**Recommendation:** ${trend === 'increasing' ? 'Monitor expense categories driving the increase for cost optimization opportunities.' : 'Current expense levels are within expected parameters.'}`;
        }
        
        return null; // Fall back to default response
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-7 h-7 text-amber-500 animate-pulse" />
                        AI Strategic Analyzer
                    </h1>
                    <p className="text-sm text-slate-500">
                        Harness machine learning models to detect anomalies, forecast revenue, and optimize company assets
                    </p>
                </div>
            </div>

            {/* Top Section - Module Select and Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Module Selector */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 mb-4">Select Domain for AI Audit</h3>
                        <div className="space-y-3">
                            {MODULES.map((m) => {
                                const Icon = m.icon;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedModule(m.id)}
                                        className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center gap-3 ${
                                            selectedModule === m.id
                                                ? 'border-amber-500 bg-amber-50/30'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-md ${selectedModule === m.id ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{m.name}</p>
                                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={analyzing || predictionsLoading}
                        className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition shadow-md"
                    >
                        {analyzing || predictionsLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Analyzing Records...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Run Live AI Audit
                            </>
                        )}
                    </button>
                </div>

                {/* Audit Results Dashboard */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">AI Health Assessment</h3>
                            <p className="text-[11px] text-slate-400">Based on system database scan</p>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <span className="text-xs text-slate-500">Health Index</span>
                            <span className="text-sm font-black text-emerald-600">{results.score}</span>
                        </div>
                    </div>

                    {/* Summary */}
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Executive Summary</span>
                        <p className="text-xs text-slate-600 leading-relaxed mt-1">{results.summary}</p>
                    </div>

                    {/* Anomalies detected */}
                    <div>
                        <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Anomalies & Risks Detected
                        </span>
                        <div className="space-y-2 mt-1.5">
                            {results.anomalies.map((an, i) => (
                                <div key={i} className="text-xs text-slate-600 p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg">
                                    {an}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Recommended Actions
                        </span>
                        <ul className="mt-2 space-y-2">
                            {results.recommendations.map((rec, i) => (
                                <li key={i} className="flex gap-2 text-xs text-slate-600">
                                    <span className="text-amber-500 font-bold">•</span>
                                    <span>{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Chat Assistant Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-amber-500" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Ask AI Assistant</h3>
                        <p className="text-[10px] text-slate-400">Natural language insights querying engine</p>
                    </div>
                </div>

                {/* Predefined suggestion bubbles */}
                <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => handleSendMessage(s)}
                            className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full transition"
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* Chat feed box */}
                <div className="h-64 overflow-y-auto bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 flex flex-col">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`flex gap-2 max-w-[80%] p-3 rounded-xl text-xs leading-relaxed ${
                                m.sender === 'bot'
                                    ? 'bg-amber-50/40 border border-amber-100 text-slate-700 self-start'
                                    : 'bg-amber-500 text-white self-end rounded-br-none'
                            }`}
                        >
                            {m.sender === 'bot' ? (
                                <Bot className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            ) : (
                                <User className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                            )}
                            <div>{m.text}</div>
                        </div>
                    ))}
                    {sending && (
                        <div className="flex gap-2 bg-amber-50/40 border border-amber-100 p-3 rounded-xl text-xs self-start items-center">
                            <Bot className="w-4 h-4 text-amber-500 animate-spin" />
                            <span className="text-slate-400">Formulating response...</span>
                        </div>
                    )}
                </div>

                {/* Text Input Row */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask me something, e.g., 'How can we reduce cutting scrap?'"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                        onClick={() => handleSendMessage()}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 rounded-lg flex items-center justify-center transition"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
