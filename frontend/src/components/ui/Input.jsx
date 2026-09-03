import { forwardRef } from 'react';

const Input = forwardRef(({
    label,
    type = 'text',
    error,
    required = false,
    helperText,
    className = '',
    ...props
}, ref) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            <input
                ref={ref}
                type={type}
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                    min-h-[44px] text-[16px] leading-snug bg-white
                    ${error
                        ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/30'
                        : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-200'
                    }`}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
            {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
        </div>
    );
});

Input.displayName = 'Input';
export default Input;