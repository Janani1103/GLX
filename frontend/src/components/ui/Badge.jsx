import { CheckCircle2, AlertCircle, Clock, Info, XCircle } from 'lucide-react';

export default function Badge({ children, variant = 'default', size = 'md', showIcon = true }) {
    const variants = {
        default: { bg: 'bg-gray-100 text-gray-800 border-gray-200', dot: 'bg-gray-500', icon: Info },
        primary: { bg: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-600', icon: Info },
        success: { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-600', icon: CheckCircle2 },
        warning: { bg: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-600', icon: Clock },
        danger: { bg: 'bg-rose-100 text-rose-900 border-rose-300', dot: 'bg-rose-600', icon: AlertCircle },
        info: { bg: 'bg-sky-100 text-sky-900 border-sky-300', dot: 'bg-sky-600', icon: Info },
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5 font-semibold',
    };

    const currentVariant = variants[variant] || variants.default;

    return (
        <span className={`inline-flex items-center rounded-full border ${currentVariant.bg} ${sizes[size]}`}>
            {showIcon && <span className={`w-1.5 h-1.5 rounded-full ${currentVariant.dot} flex-shrink-0`} aria-hidden="true" />}
            <span>{children}</span>
        </span>
    );
}