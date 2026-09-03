import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is Stop)
];

const Barcode128 = ({ value, width = 1.2, height = 45 }) => {
    if (!value) return null;
    const text = String(value).toUpperCase();
    let sum = 104;
    const codes = [104];
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i) - 32;
        codes.push(code);
        sum += code * (i + 1);
    }
    const checksum = sum % 103;
    codes.push(checksum);
    codes.push(106);
    let patternString = "";
    for (const code of codes) {
        if (code >= 0 && code <= 106) {
            patternString += CODE128_PATTERNS[code];
        }
    }
    const rects = [];
    let currentX = 0;
    for (let i = 0; i < patternString.length; i++) {
        const w = parseInt(patternString[i], 10);
        if (i % 2 === 0) {
            rects.push(
                <rect 
                    key={i} 
                    x={currentX * width} 
                    y={0} 
                    width={w * width} 
                    height={height} 
                    fill="black" 
                />
            );
        }
        currentX += w;
    }
    const totalWidth = currentX * width;
    return (
        <svg width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
            <g>{rects}</g>
        </svg>
    );
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
    }).format(amount || 0);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
};

/**
 * Reusable Printable Document Component matching GLS Industries (Pvt) Ltd / GLX TRUCK BODY ENGINEERS layout
 */
const DocumentPrintView = forwardRef(({ document: doc, companyInfo }, ref) => {
    if (!doc) return null;

    const isEstimate = doc.documentType === 'estimate' || (doc.quoteNumber && doc.quoteNumber.startsWith('EST'));
    const isInvoice = !!doc.invoiceNumber || doc.documentType === 'invoice';
    const isQuotation = !isEstimate && !isInvoice;

    let docTitle = 'QUOTATION';
    if (isEstimate) docTitle = 'ESTIMATE';
    if (isInvoice) docTitle = 'INVOICE';

    const docNumber = doc.invoiceNumber || doc.quoteNumber || doc.quotationCode || 'N/A';
    const customerName = doc.customerName || doc.vehicleOwner || doc.customerSnapshot?.name || 'Valued Client';
    const contactPhone = doc.customerPhone || doc.customerSnapshot?.contactName || '';
    const dateDisplay = formatDate(doc.date || doc.invoiceDate || doc.createdAt);

    // Custom Template settings
    const customTemplateUrl = isInvoice
        ? companyInfo?.invoiceCustomTemplateUrl
        : companyInfo?.quotationCustomTemplateUrl;

    const defaultActiveTemplate = isInvoice
        ? (companyInfo?.activeInvoiceTemplate || 'default')
        : (companyInfo?.activeQuotationTemplate || 'default');

    const [selectedTemplate, setSelectedTemplate] = React.useState(defaultActiveTemplate);

    React.useEffect(() => {
        if (defaultActiveTemplate) {
            setSelectedTemplate(defaultActiveTemplate);
        }
    }, [defaultActiveTemplate]);

    const isUsingCustom = selectedTemplate === 'custom' && !!customTemplateUrl;

    const qrDataObj = {
        type: docTitle,
        number: docNumber,
        date: dateDisplay,
        customer: customerName,
        vehicleNo: doc.vehicleNo || 'N/A',
        vehicleModel: doc.vehicleModel || 'N/A',
        grandTotal: doc.grandTotal || doc.finalSellingPrice || doc.totalAmount || 0,
        status: doc.status || 'Active',
    };
    const qrString = JSON.stringify(qrDataObj);

    // Template Switcher Header (hidden during actual paper printing)
    const TemplateToolbar = () => (
        <div className="no-print mb-4 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Print Template:</span>
                <button
                    type="button"
                    onClick={() => setSelectedTemplate('default')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        selectedTemplate === 'default'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    System Default Template
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (!customTemplateUrl) {
                            alert('No custom template uploaded yet. Please upload one in Settings.');
                            return;
                        }
                        setSelectedTemplate('custom');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        selectedTemplate === 'custom'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    Custom Uploaded Template {customTemplateUrl ? '' : '(Not Uploaded)'}
                </button>
            </div>
            {isUsingCustom && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    ✓ Rendering Custom Template Background
                </span>
            )}
        </div>
    );

    // Standard Header component
    const Header = () => {
        if (isUsingCustom) {
            return (
                <div className="w-full mb-4 quotation-header print-header avoid-break">
                    <img
                        src={customTemplateUrl}
                        alt="Custom Template Header"
                        className="w-full max-h-36 object-contain rounded mb-2"
                    />
                </div>
            );
        }

        return (
            <div className="quotation-header print-header avoid-break flex justify-between items-start pb-4 border-b border-gray-400 mb-4 font-calibri" style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}>
                <div className="flex gap-4 items-start w-full">
                    {/* Black & White Logo */}
                    <div className="w-16 h-16 flex-shrink-0">
                        <img src="/logo.jpg" alt="GLX Logo" className="w-full h-full object-contain filter grayscale" />
                    </div>
                    
                    {/* Addresses & Info Columns */}
                    <div className="grid grid-cols-3 gap-6 w-full text-xs text-gray-900">
                        {/* Left Column: Head Office */}
                        <div>
                            <p className="font-bold text-sm uppercase tracking-wide">GLX Industries (Pvt) Ltd</p>
                            <p className="mt-1 text-[11px] leading-tight text-gray-600 font-calibri">
                                No.14, Negambo Road,<br />
                                Thudella, Ja-Ela,<br />
                                Sri Lanka.<br />
                                (11350)
                            </p>
                        </div>

                        {/* Middle Column: GLX Truck Body Engineers */}
                        <div>
                            <p className="font-bold text-sm uppercase tracking-wide">GLX TRUCK BODY ENGINEERS</p>
                            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">
                                ALUMINIUM, STEEL & FREEZER BOX MANUFACTURE
                            </p>
                            <p className="mt-1.5 text-[11px] leading-tight text-gray-600 font-calibri">
                                No.2020/3L, 2, Seeduwa Road,<br />
                                Kotugoda, Ja-Ela.<br />
                                Sri Lanka.<br />
                                (11390)
                            </p>
                        </div>

                        {/* Right Column: Contact Details */}
                        <div className="text-[11px] leading-snug font-mono text-left flex flex-col items-end">
                            <div className="text-left font-mono">
                                <p><span className="font-semibold">Mobile :</span> 071 6666 888</p>
                                <p><span className="font-semibold">Tel &nbsp;&nbsp;&nbsp;&nbsp;:</span> 011 740 4446</p>
                                <p><span className="font-semibold">Email &nbsp;:</span> glx.engi@gmail.com</p>
                                <p><span className="font-semibold">Web &nbsp;&nbsp;&nbsp;:</span> www.glx.lk</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Split Quotation into two distinct pages
    if (isQuotation) {
        return (
            <div ref={ref} className="quotation-print-area print-area print-container document-print-view font-calibri text-gray-900 bg-white max-w-[850px] mx-auto text-sm leading-relaxed p-6" style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}>
                <TemplateToolbar />

                {/* ================= PAGE 1 ================= */}
                <div className="print-page border border-gray-300 rounded-lg p-6 pb-8 shadow-sm mb-8 bg-white flex flex-col justify-between" style={{ pageBreakAfter: 'always', breakAfter: 'page', minHeight: '252mm' }}>
                    <Header />

                    {/* Customer Box & Metadata */}
                    <div className="quotation-card avoid-break print-avoid-break grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded border border-gray-200 mb-6 text-xs">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Customer</p>
                            <p className="font-bold text-gray-900 text-sm">{customerName}</p>
                            {doc.billingAddress?.line1 && <p className="text-gray-600 mt-1">{doc.billingAddress.line1}</p>}
                            {contactPhone && <p className="text-gray-600">{contactPhone}</p>}
                        </div>
                        <div className="text-right space-y-1">
                            <p><span className="font-semibold text-gray-700">Quotation No :</span> <span className="font-bold font-mono text-sm">{docNumber}</span></p>
                            <p><span className="font-semibold text-gray-700">Sales :</span> {doc.salesRep || 'Asanka'}</p>
                            <p><span className="font-semibold text-gray-700">Branch :</span> {doc.branch || 'JA-ELA'}</p>
                            <p><span className="font-semibold text-gray-700">Date :</span> {dateDisplay}</p>
                        </div>
                    </div>

                    {/* Table Header & Specifications Description */}
                    <div className="mb-4 overflow-hidden border border-gray-300 rounded">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-800 text-white uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3 border-r border-gray-600">Description</th>
                                    <th className="py-2.5 px-3 text-right w-28 border-r border-gray-600">Rate</th>
                                    <th className="py-2.5 px-3 text-center w-16 border-r border-gray-600">Qty</th>
                                    <th className="py-2.5 px-3 text-right w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white font-calibri">
                                {(doc.items || []).map((item, idx) => {
                                    const desc = item.productName || item.description || 'Lorry Body';
                                    const qty = item.quantity || 1;
                                    const unitPrice = item.unitPrice || item.rate || 0;
                                    const lineTotal = item.lineTotal || (qty * unitPrice);

                                    return (
                                        <tr key={idx} className="border-b border-gray-200">
                                            <td className="py-3 px-3 border-r border-gray-300">
                                                <div className="font-bold text-gray-900 text-sm uppercase">{desc}</div>
                                                {item.bodyModel && <div className="text-xs text-gray-700 font-semibold mt-1">Body Model : {item.bodyModel}</div>}
                                                {item.vehicleModel && <div className="text-xs text-gray-700 font-semibold">Vehicle Model : {item.vehicleModel}</div>}
                                                
                                                {/* Render specifications multiline or bullets */}
                                                {item.specificationsText ? (
                                                    <pre className="whitespace-pre-wrap font-calibri text-[11px] text-gray-700 mt-2 leading-relaxed">
                                                        {item.specificationsText}
                                                    </pre>
                                                ) : (
                                                    doc.specifications?.length > 0 && (
                                                        <ul className="list-decimal list-inside text-[11px] text-gray-700 mt-2 space-y-0.5 leading-relaxed">
                                                            {doc.specifications.map((spec, specIdx) => (
                                                                <li key={specIdx}>{spec}</li>
                                                            ))}
                                                        </ul>
                                                    )
                                                )}

                                                <p className="font-bold text-xs uppercase tracking-wider text-gray-900 mt-3">100% MADE IN GLX SRI LANKA</p>
                                                
                                                {/* Outside Body Dimensions */}
                                                {doc.bodyDimensions && (
                                                    <div className="mt-4 border-t border-dashed pt-2">
                                                        <p className="font-bold text-gray-800 text-[11px] uppercase">Outside Body Dimensions</p>
                                                        <p className="text-gray-700 text-[11px]">
                                                            Length - {doc.bodyDimensions.length || '9 Feet 2 Inch'} | Width - {doc.bodyDimensions.width || '66 Inch'} | Height - {doc.bodyDimensions.height || '6 Feet'}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Special Notes & Warranty */}
                                                <div className="mt-4 border-t border-dashed pt-2 space-y-1 text-[11px]">
                                                    <p className="font-bold text-gray-800 uppercase">Special Note :</p>
                                                    <p className="font-bold text-gray-900">WARRANTY JAPAN MODEL 10/0255/22</p>
                                                    <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                                                        <li>10 Years For Body Structure (Condition Apply)</li>
                                                        <li>10 Years Full Body Waterproofing (Condition Apply)</li>
                                                        <li>03 Years For All Doors (Condition Apply)</li>
                                                    </ul>
                                                    <p className="text-gray-500 mt-1 italic">No Warranty: Rubber Beading / Plywood Sheets / Aluminium Sheet or Cladding Sheets</p>
                                                    <p className="text-gray-700 font-semibold mt-1">Note: Every 12 Months you should Come to the GLX TRUCK BODY ENGINEERS YARD and Check your Vehicle Body through our Company and Update your Warranty Card...</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono align-top text-sm border-r border-gray-300">{formatCurrency(unitPrice)}</td>
                                            <td className="py-3 px-3 text-center font-semibold align-top text-sm border-r border-gray-300">{qty}</td>
                                            <td className="py-3 px-3 text-right font-mono font-bold align-top text-sm text-gray-900">{formatCurrency(lineTotal)}</td>
                                        </tr>
                                    );
                                })}

                                {/* Page 1 Discount row at the bottom of table */}
                                {doc.discount > 0 && (
                                    <tr className="text-red-600 font-bold border-t-2 border-gray-300">
                                        <td className="py-2.5 px-3 uppercase text-sm border-r border-gray-300">Discount</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-sm border-r border-gray-300">-{formatCurrency(doc.discount)}</td>
                                        <td className="py-2.5 px-3 text-center text-sm border-r border-gray-300">1</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-sm">-{formatCurrency(doc.discount)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Page 1 Footer */}
                    <div className="mt-6 pt-3 border-t-2 border-gray-300 flex items-center justify-between text-xs font-calibri">
                        <span className="font-semibold text-gray-700">GLX INDUSTRIES (PVT) LTD — Kotugoda, Ja-Ela, Sri Lanka</span>
                        <span className="font-bold text-gray-800 tracking-wider">PAGE 1 / 2</span>
                    </div>
                </div>

                {/* ================= PAGE 2 ================= */}
                <div className="print-page border border-gray-300 rounded-lg p-6 pb-8 shadow-sm bg-white flex flex-col justify-between" style={{ minHeight: '252mm' }}>
                    <Header />

                    <div className="mb-4 overflow-hidden border border-gray-300 rounded">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-800 text-white uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3 border-r border-gray-600">Description</th>
                                    <th className="py-2.5 px-3 text-right w-28 border-r border-gray-600">Rate</th>
                                    <th className="py-2.5 px-3 text-center w-16 border-r border-gray-600">Qty</th>
                                    <th className="py-2.5 px-3 text-right w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white font-calibri">
                                {/* Bank Details Row */}
                                <tr className="bank-details avoid-break border-b border-gray-200">
                                    <td className="py-4 px-3 text-gray-800 font-semibold leading-relaxed border-r border-gray-300">
                                        <div className="font-bold text-gray-900 text-sm mb-1 uppercase">Bank Details for Payments:</div>
                                        Account Name : GLX Truck Body Engineers<br />
                                        Number : 100600002717<br />
                                        Nations Trust Bank<br />
                                        Ja-Ela Branch
                                    </td>
                                    <td className="py-4 px-3 text-right font-mono align-top text-sm border-r border-gray-300">0.00</td>
                                    <td className="py-4 px-3 text-center font-semibold align-top text-sm border-r border-gray-300">1</td>
                                    <td className="py-4 px-3 text-right font-mono align-top text-sm">0.00</td>
                                </tr>

                                {/* Special Discount Row in Red */}
                                {doc.specialDiscount > 0 && (
                                    <tr className="text-red-600 font-bold avoid-break border-b border-gray-200">
                                        <td className="py-3 px-3 uppercase text-sm border-r border-gray-300">Special Discount</td>
                                        <td className="py-3 px-3 text-right font-mono text-sm border-r border-gray-300">-{formatCurrency(doc.specialDiscount)}</td>
                                        <td className="py-3 px-3 text-center text-sm border-r border-gray-300">1</td>
                                        <td className="py-3 px-3 text-right font-mono text-sm">-{formatCurrency(doc.specialDiscount)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Summary */}
                    <div className="avoid-break print-avoid-break flex justify-between items-start mb-6">
                        <div className="text-xs text-gray-600 leading-relaxed max-w-sm pt-2">
                            <span className="font-bold text-gray-800">Remarks :</span> {doc.remarks || 'Please process payments directly to the designated Nations Trust Bank account.'}
                        </div>
                        <div className="w-80 bg-gray-50 border border-gray-300 rounded p-3 text-xs space-y-1.5 font-calibri">
                            <div className="flex justify-between text-gray-700">
                                <span>ITEMS SUB TOTAL:</span>
                                <span className="font-mono">{formatCurrency(doc.subtotal || doc.totalAmount)}</span>
                            </div>
                            {doc.laborCost > 0 && (
                                <div className="flex justify-between text-emerald-800 font-semibold">
                                    <span>LABOR COST:</span>
                                    <span className="font-mono">+{formatCurrency(doc.laborCost)}</span>
                                </div>
                            )}
                            {(doc.discount > 0 || doc.specialDiscount > 0) && (
                                <div className="flex justify-between text-red-600 font-bold">
                                    <span>DISCOUNT:</span>
                                    <span className="font-mono">-{formatCurrency((doc.discount || 0) + (doc.specialDiscount || 0))}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-400">
                                <span>GRAND TOTAL:</span>
                                <span className="font-mono text-blue-900 border-b-4 border-double border-gray-900 pb-0.5">{formatCurrency(doc.grandTotal || doc.finalSellingPrice)}</span>
                            </div>
                            {(doc.advanceAmount > 0 || doc.amountPaid > 0) && (
                                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-dashed">
                                    <span>ADVANCE PAID:</span>
                                    <span className="font-mono">-{formatCurrency(doc.advanceAmount || doc.amountPaid)}</span>
                                </div>
                            )}
                            {(doc.balanceAmount !== undefined || doc.balanceDue !== undefined) && (
                                <div className="flex justify-between text-amber-900 font-black pt-1 bg-amber-50 p-1 rounded border border-amber-200">
                                    <span>BALANCE DUE:</span>
                                    <span className="font-mono text-sm">{formatCurrency(doc.balanceAmount ?? doc.balanceDue ?? ((doc.grandTotal || 0) - (doc.advanceAmount || doc.amountPaid || 0)))}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment & Warranty Terms */}
                    <div className="avoid-break bank-details mb-6 grid grid-cols-2 gap-6 text-xs text-gray-700 font-calibri">
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                            <p className="font-bold text-gray-900 uppercase mb-2">Condition of Payments:</p>
                            <ul className="space-y-1 text-gray-700">
                                <li><span className="font-semibold">a). 70%</span> Advance Payment with the firm Order.</li>
                                <li><span className="font-semibold">b). Balance Payment</span> on Completion of Work.</li>
                                <li className="pt-2"><span className="font-semibold">Completion of Work :</span> 18 to 26 working Days after the Order Confirmation.</li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 p-4 rounded border border-gray-200 space-y-2">
                            <p><span className="font-bold text-gray-900 uppercase">Validity (Quotation) :</span> 30 Working Days From the Issued Date.</p>
                            <p><span className="font-bold text-gray-900 uppercase">Warranty :</span></p>
                            <ul className="list-alpha list-inside pl-1 text-gray-700 space-y-0.5">
                                <li>a). Please See the Description.</li>
                                <li>b). Warranty Will be Issued with the Invoice.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Authorized Person Signature & QR Code */}
                    <div className="avoid-break print-footer mt-auto pt-6 border-t border-gray-300">
                        <div className="flex justify-between items-end text-xs mb-4">
                            <div className="space-y-3">
                                <div className="text-left font-mono text-[10px] text-gray-500">
                                    Printed at: {new Date().toLocaleString('en-GB')}
                                </div>
                                <div className="text-center w-56">
                                    <div className="border-b border-gray-800 mb-1.5 h-10"></div>
                                    <p className="font-bold text-gray-900 uppercase">Yours Faithfully,</p>
                                    <p className="font-bold text-gray-900 uppercase text-[10px]">GLX INDUSTRIES - Ja Ela</p>
                                    <p className="text-gray-600 text-[10px]">Authorized Person</p>
                                </div>
                            </div>

                            {/* QR Code */}
                            <div className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded shadow-sm">
                                <QRCodeSVG value={qrString} size={90} level="M" />
                                <p className="text-[9px] font-bold text-gray-700 mt-2 uppercase tracking-wide">Scan to Verify</p>
                                <p className="text-[8px] text-gray-400 font-mono mt-0.5">{docNumber}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t-2 border-gray-300 pt-3 pb-1 text-xs font-calibri">
                            <span className="font-semibold text-gray-700">GLX INDUSTRIES (PVT) LTD — Kotugoda, Ja-Ela, Sri Lanka</span>
                            <span className="font-bold text-gray-800 tracking-wider">PAGE 2 / 2</span>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // Default clean A4 print view for Invoice or Estimate
    return (
        <div ref={ref} className="quotation-print-area print-area print-container document-print-view font-calibri text-gray-900 bg-white p-8 max-w-[850px] mx-auto text-sm leading-relaxed border border-gray-200 rounded-lg shadow-sm" style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}>
            <TemplateToolbar />
            <Header />

            {/* Document Metadata Grid */}
            <div className="quotation-card avoid-break print-avoid-break grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md border border-gray-200 mb-6 text-xs font-calibri">
                <div className="space-y-1">
                    {doc.insuranceCompany && (
                        <p><span className="font-semibold text-gray-700">Insurance Company:</span> {doc.insuranceCompany}</p>
                    )}
                    <p><span className="font-semibold text-gray-700">Customer Name:</span> <strong className="text-gray-900">{customerName}</strong></p>
                    {contactPhone && (
                        <p><span className="font-semibold text-gray-700">Contact Number:</span> {contactPhone}</p>
                    )}
                    {doc.vehicleNo && (
                        <p><span className="font-semibold text-gray-700">Vehicle No:</span> <strong className="text-blue-700 font-mono text-sm">{doc.vehicleNo}</strong></p>
                    )}
                    {doc.vehicleModel && (
                        <p><span className="font-semibold text-gray-700">Vehicle Model:</span> {doc.vehicleModel}</p>
                    )}
                </div>

                <div className="space-y-1 text-right">
                    <p><span className="font-semibold text-gray-700">{docTitle} No:</span> <span className="font-mono font-bold">{docNumber}</span></p>
                    <p><span className="font-semibold text-gray-700">Sales Rep:</span> <strong className="text-gray-900">{doc.salesRep || 'Asanka'}</strong></p>
                    <p><span className="font-semibold text-gray-700">Branch:</span> {doc.branch || 'JA-ELA'}</p>
                    <p><span className="font-semibold text-gray-700">Date:</span> {dateDisplay}</p>
                </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-6 overflow-hidden border border-gray-300 rounded">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-800 text-white uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="py-2.5 px-3 w-8 text-center border-r border-gray-600">#</th>
                            <th className="py-2.5 px-3 border-r border-gray-600">Description</th>
                            <th className="py-2.5 px-3 text-right w-28 border-r border-gray-600">Rate</th>
                            <th className="py-2.5 px-3 text-center w-16 border-r border-gray-600">Qty</th>
                            <th className="py-2.5 px-3 text-right w-32">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white font-calibri">
                        {(doc.items || []).map((item, idx) => {
                            const desc = item.productName || item.description || 'Line item';
                            const qty = item.quantity || 1;
                            const unitPrice = item.unitPrice || item.rate || 0;
                            const lineTotal = item.lineTotal || (qty * unitPrice);

                            return (
                                <tr key={idx} className="hover:bg-gray-50 avoid-break print-table-row border-b border-gray-200">
                                    <td className="py-2.5 px-3 text-center font-medium text-gray-500 border-r border-gray-300">{idx + 1}</td>
                                    <td className="py-2.5 px-3 font-semibold text-gray-800 border-r border-gray-300">
                                        <div>{desc}</div>
                                        {item.description && item.description !== desc && (
                                            <div className="text-[11px] text-gray-600 font-normal mt-0.5 whitespace-pre-wrap">{item.description}</div>
                                        )}
                                        {item.productTranslation && (
                                            <div className="text-[11px] text-gray-500 font-normal italic mt-0.5">{item.productTranslation}</div>
                                        )}
                                        {item.notes && <div className="text-[10px] text-gray-400 italic mt-0.5">{item.notes}</div>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-gray-700 border-r border-gray-300">{formatCurrency(unitPrice)}</td>
                                    <td className="py-2.5 px-3 text-center font-semibold text-gray-800 border-r border-gray-300">{qty}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatCurrency(lineTotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Totals Summary */}
            <div className="avoid-break print-avoid-break flex justify-end mb-6">
                <div className="w-72 bg-gray-50 border border-gray-300 rounded p-3 text-xs space-y-1.5 font-calibri">
                    <div className="flex justify-between text-gray-700">
                        <span>SUB TOTAL:</span>
                        <span className="font-mono">{formatCurrency(doc.subtotal || doc.totalAmount)}</span>
                    </div>
                    {doc.discount > 0 && (
                        <div className="flex justify-between text-red-600 font-bold">
                            <span>DISCOUNT:</span>
                            <span className="font-mono">-{formatCurrency(doc.discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-400">
                        <span>GRAND TOTAL:</span>
                        <span className="font-mono text-blue-900 border-b-4 border-double border-gray-900 pb-0.5">{formatCurrency(doc.grandTotal || doc.finalSellingPrice)}</span>
                    </div>
                </div>
            </div>

            {/* Authorized Person Signature & QR Code */}
            <div className="avoid-break print-footer mt-12 pt-4 border-t border-gray-300 flex justify-between items-end text-xs">
                <div className="space-y-3">
                    <div className="text-left font-mono text-[10px] text-gray-500">
                        Printed at: {new Date().toLocaleString('en-GB')}
                    </div>
                    <div className="text-center w-56">
                        <div className="border-b border-gray-800 mb-1.5 h-10"></div>
                        <p className="font-bold text-gray-900 uppercase">GLX INDUSTRIES - Ja Ela</p>
                        <p className="text-gray-600 text-[10px]">Authorized Signature</p>
                    </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded shadow-sm">
                    <QRCodeSVG value={qrString} size={90} level="M" />
                    <p className="text-[9px] font-bold text-gray-700 mt-2 uppercase tracking-wide">Scan to Verify</p>
                    <p className="text-[8px] text-gray-400 font-mono mt-0.5">{docNumber}</p>
                </div>
            </div>

            {/* Bottom Footer Bar */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-8">
                <span className="text-[10px] text-gray-400 font-mono">GLX INDUSTRIES (PVT) LTD — Kotugoda, Ja-Ela, Sri Lanka</span>
                <span className="text-[10px] text-gray-400 font-mono tracking-wider">PAGE 1 / 1</span>
            </div>
        </div>
    );
});

DocumentPrintView.displayName = 'DocumentPrintView';
export default DocumentPrintView;