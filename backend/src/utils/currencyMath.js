/**
 * Currency and Financial Math Utility
 * Standardizes rounding to 2 decimal places to prevent float drift in financial reports.
 */

export const roundCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const calculateTax = (subtotal, taxRatePercent) => {
    const tax = (Number(subtotal || 0) * Number(taxRatePercent || 0)) / 100;
    return roundCurrency(tax);
};

export const calculateLineTotal = (unitPrice, quantity, discountPercent = 0, taxPercent = 0) => {
    const gross = roundCurrency(Number(unitPrice || 0) * Number(quantity || 0));
    const discount = roundCurrency((gross * Number(discountPercent || 0)) / 100);
    const taxable = roundCurrency(gross - discount);
    const tax = roundCurrency((taxable * Number(taxPercent || 0)) / 100);
    return roundCurrency(taxable + tax);
};
