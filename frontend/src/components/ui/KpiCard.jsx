import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from './Card';

export default function KpiCard({
    label, value, icon: Icon, iconColor = 'text-primary-600', iconBg = 'bg-primary-50',
    trend = null, subtext = null, onClick = null,
}) {
    const hasTrend = trend !== null && trend !== undefined;
    const trendUp = hasTrend && trend >= 0;

    return (
        <Card
            className={`p-3 sm:p-4 lg:p-5 ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98] transition-all' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 truncate">{label}</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight truncate">{value}</p>
                    {hasTrend && (
                        <p className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(trend)}% {trendUp ? 'up' : 'down'}
                        </p>
                    )}
                    {subtext && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtext}</p>}
                </div>
                {Icon && (
                    <div className={`${iconBg} ${iconColor} w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} />
                    </div>
                )}
            </div>
        </Card>
    );
}