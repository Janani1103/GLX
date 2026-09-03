import { forwardRef } from 'react';

const Select = forwardRef(({
    label,
    error,
    required = false,
    options = [],
    placeholder = 'Select...',
    className = '',
    helperText,
    children,
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
            <select
                ref={ref}
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                    bg-white min-h-[44px] text-[16px] leading-snug appearance-none cursor-pointer
                    ${error
                        ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/30'
                        : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-200'
                    }`}
                {...props}
            >
                {children ? children : (
                    <>
                        <option value="">{placeholder}</option>
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </>
                )}
            </select>
            {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
            {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
        </div>
    );
});

Select.displayName = 'Select';
export default Select;