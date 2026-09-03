import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import DocumentPrintView from '../components/print/DocumentPrintView';
import { exportDocumentToPDF, exportElementToPDF } from '../utils/dataExport';
import { getApiUrl } from '../api/config';

export default function PublicDocumentViewPage() {
    const { token } = useParams();
    const [doc, setDoc] = useState(null);
    const [docType, setDocType] = useState('quotation');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const printRef = useRef(null);

    useEffect(() => {
        const fetchDoc = async () => {
            try {
                // Determine API URL relative or configured base
                const apiUrl = `${getApiUrl()}/public/documents/${token}`;
                const response = await axios.get(apiUrl);
                if (response.data && response.data.success) {
                    setDoc(response.data.data);
                    setDocType(response.data.documentType);
                } else {
                    setError('Unable to load document details.');
                }
            } catch (err) {
                setError('Document not found or link has expired.');
            } finally {
                setLoading(false);
            }
        };
        fetchDoc();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-calibri">
                <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-bold uppercase tracking-wider">Loading GLX Industries Document...</p>
                </div>
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-calibri p-4">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm border max-w-md w-full">
                    <h1 className="text-lg font-bold text-red-600 mb-2">Access Error</h1>
                    <p className="text-sm text-gray-600 mb-4">{error || 'This link is invalid or expired.'}</p>
                    <div className="text-xs text-gray-400">If you believe this is a mistake, please contact GLX Truck Body Engineers.</div>
                </div>
            </div>
        );
    }

    // Map Quotation properties if needed for Print View
    const printDoc = {
        ...doc,
        documentType: docType
    };

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4 print:p-0 print:bg-white">
            <div className="no-print max-w-[850px] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    GLX Document Portal (Client View)
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => window.print()} 
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 border font-bold text-xs px-4 py-1.5 rounded-lg transition"
                    >
                        Print Document
                    </button>
                    <button 
                        onClick={() => exportElementToPDF(printRef.current, `${docType}_${(doc.invoiceNumber || doc.quoteNumber || doc.quotationCode || 'document').replace(/[\/\\:]/g, '_')}.pdf`)} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition"
                    >
                        Download PDF
                    </button>
                </div>
            </div>
            
            <div className="max-w-[850px] mx-auto bg-white p-8 shadow border print:shadow-none print:border-0 print:p-0">
                <DocumentPrintView ref={printRef} document={printDoc} />
            </div>
        </div>
    );
}
