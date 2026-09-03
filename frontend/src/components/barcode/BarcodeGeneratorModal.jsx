import { useState, useEffect, useRef } from 'react';
import { X, Printer, Download, Barcode as BarcodeIcon, Sparkles, RefreshCw, Check } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import api from '../../api/axios';

export default function BarcodeGeneratorModal({ isOpen, onClose, initialProduct = null }) {
    const [selectedProductId, setSelectedProductId] = useState(initialProduct?._id || '');
    const [productName, setProductName] = useState(initialProduct?.name || '');
    const [barcodeValue, setBarcodeValue] = useState(initialProduct?.barcode || initialProduct?.productCode || '0021');
    const [price, setPrice] = useState(initialProduct?.basePrice || 0);
    const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
    const [printCount, setPrintCount] = useState(12);

    const [showName, setShowName] = useState(true);
    const [showPrice, setShowPrice] = useState(true);
    const [showCode, setShowCode] = useState(true);

    const [productsList, setProductsList] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    const svgRef = useRef(null);

    // Fetch products list on mount
    useEffect(() => {
        if (!isOpen) return;
        setIsLoadingProducts(true);
        api.get('/products?limit=500')
            .then(res => {
                setProductsList(res.data?.data || []);
                setIsLoadingProducts(false);
            })
            .catch(() => {
                setProductsList([]);
                setIsLoadingProducts(false);
            });
    }, [isOpen]);

    // Handle initial product sync
    useEffect(() => {
        if (initialProduct) {
            setSelectedProductId(initialProduct._id || '');
            setProductName(initialProduct.name || '');
            setBarcodeValue(initialProduct.barcode || initialProduct.productCode || '0021');
            setPrice(initialProduct.basePrice || 0);
        }
    }, [initialProduct]);

    // Render Barcode via JsBarcode
    useEffect(() => {
        if (!isOpen || !svgRef.current || !barcodeValue.trim()) return;

        try {
            JsBarcode(svgRef.current, barcodeValue.trim(), {
                format: barcodeFormat,
                width: 2,
                height: 60,
                displayValue: showCode,
                font: 'monospace',
                fontSize: 14,
                margin: 10,
                background: '#ffffff',
                lineColor: '#000000',
            });
        } catch (err) {
            console.error('JsBarcode render error:', err);
        }
    }, [isOpen, barcodeValue, barcodeFormat, showCode]);

    if (!isOpen) return null;

    const handleProductSelect = (prodId) => {
        setSelectedProductId(prodId);
        const prod = productsList.find(p => p._id === prodId);
        if (prod) {
            setProductName(prod.name || '');
            setBarcodeValue(prod.barcode || prod.sku || prod.productCode || '0021');
            setPrice(prod.basePrice || 0);
        }
    };

    const handleGenerateRandomCode = () => {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const newCode = `00${randomNum.toString().slice(0, 4)}`;
        setBarcodeValue(newCode);
        toast.success(`Generated code: ${newCode}`);
    };

    const handleDownloadPNG = () => {
        if (!svgRef.current) return;
        const svgElement = svgRef.current;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = img.width + 40;
            canvas.height = img.height + 40;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 20, 20);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `barcode_${barcodeValue.trim()}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
            toast.success('Barcode PNG downloaded successfully!');
        };

        img.src = url;
    };

    const handlePrintStickerSheet = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to print barcode label sheet.');
            return;
        }

        const labelsHtml = Array.from({ length: printCount }).map(() => `
            <div style="
                width: 55mm;
                height: 35mm;
                border: 1px dashed #ccc;
                padding: 4px;
                box-sizing: border-box;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: #fff;
                page-break-inside: avoid;
            ">
                <div style="font-size: 11px; font-weight: bold; font-family: sans-serif; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${showName ? (productName || 'GLX Product') : ''}
                </div>
                <svg class="barcode-item" data-code="${barcodeValue.trim()}"></svg>
                ${showPrice ? `<div style="font-size: 12px; font-weight: 900; font-family: sans-serif;">LKR ${(price || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</div>` : ''}
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Barcode Label Sheet - GLX Industries</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    body {
                        font-family: sans-serif;
                        margin: 0;
                        padding: 10px;
                        background: #fff;
                    }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(55mm, 1fr));
                        gap: 4mm;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 15px; text-align: right;">
                    <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Print Label Sheet
                    </button>
                </div>
                <div class="label-grid">
                    ${labelsHtml}
                </div>
                <script>
                    window.onload = function() {
                        const elements = document.querySelectorAll('.barcode-item');
                        elements.forEach(el => {
                            const code = el.getAttribute('data-code');
                            JsBarcode(el, code, {
                                format: '${barcodeFormat}',
                                width: 1.5,
                                height: 40,
                                displayValue: ${showCode},
                                fontSize: 11,
                                margin: 2
                            });
                        });
                    }
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                            <BarcodeIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Barcode Generator & Label Studio</h3>
                            <p className="text-xs text-slate-400">Generate high-res barcodes and printable sticker sheets</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Live Preview Box */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center space-y-3">
                        {showName && (
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">
                                {productName || 'Sample Product Name'}
                            </h4>
                        )}

                        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                            <svg ref={svgRef}></svg>
                        </div>

                        {showPrice && (
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                LKR {(price || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>

                    {/* Form Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Select Existing Product
                            </label>
                            <select
                                value={selectedProductId}
                                onChange={(e) => handleProductSelect(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="">-- Custom Input / Select Product --</option>
                                {productsList.map((p) => (
                                    <option key={p._id} value={p._id}>
                                        {p.name} ({p.barcode || p.productCode || 'No Barcode'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Barcode Number / Code
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={barcodeValue}
                                    onChange={(e) => setBarcodeValue(e.target.value)}
                                    placeholder="e.g. 0021 or 893000000021"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono font-bold"
                                />
                                <button
                                    type="button"
                                    onClick={handleGenerateRandomCode}
                                    title="Auto generate code"
                                    className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Product Display Name
                            </label>
                            <input
                                type="text"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder="e.g. Aluminium Section Profile"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Price (LKR)
                            </label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Barcode Format
                            </label>
                            <select
                                value={barcodeFormat}
                                onChange={(e) => setBarcodeFormat(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="CODE128">CODE128 (Standard Wholesale)</option>
                                <option value="CODE39">CODE39 (Alphanumeric)</option>
                                <option value="EAN13">EAN-13 (13 Digits)</option>
                                <option value="UPC">UPC (12 Digits)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                Number of Labels to Print
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={printCount}
                                onChange={(e) => setPrintCount(parseInt(e.target.value, 10) || 1)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold"
                            />
                        </div>
                    </div>

                    {/* Toggle Options */}
                    <div className="flex flex-wrap gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showName}
                                onChange={(e) => setShowName(e.target.checked)}
                                className="rounded text-sky-600 focus:ring-sky-500"
                            />
                            Show Product Name
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showPrice}
                                onChange={(e) => setShowPrice(e.target.checked)}
                                className="rounded text-sky-600 focus:ring-sky-500"
                            />
                            Show Price Tag
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showCode}
                                onChange={(e) => setShowCode(e.target.checked)}
                                className="rounded text-sky-600 focus:ring-sky-500"
                            />
                            Show Code Text
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        <Button variant="secondary" onClick={handleDownloadPNG}>
                            <Download className="w-4 h-4 mr-1.5" /> Download PNG
                        </Button>
                        <Button variant="primary" onClick={handlePrintStickerSheet}>
                            <Printer className="w-4 h-4 mr-1.5" /> Print {printCount} Label(s)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
