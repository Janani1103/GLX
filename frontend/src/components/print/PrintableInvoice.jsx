import { forwardRef } from 'react';
import DocumentPrintView from './DocumentPrintView';

/**
 * Printable invoice wrapper component.
 * Uses DocumentPrintView to ensure consistent vehicle metadata, photos, QR code and styling.
 */
const PrintableInvoice = forwardRef(({ companyInfo, invoice, payments = [] }, ref) => {
    if (!invoice) return null;

    return (
        <DocumentPrintView ref={ref} document={{ ...invoice, documentType: 'invoice' }} companyInfo={companyInfo} />
    );
});

PrintableInvoice.displayName = 'PrintableInvoice';
export default PrintableInvoice;