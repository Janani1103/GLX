import { useState, useEffect, useRef } from 'react';
import { Barcode as BarcodeIcon, Printer, Download, Sparkles, RefreshCw, Package, Search } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import api from '../api/axios';

export default function BarcodeGeneratorPage() {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [productName, setProductName] = useState('');
    const [barcodeValue, setBarcodeValue] = useState('0021');
    const [price, setPrice] = useState(0);
    const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
    const [printCount, setPrintCount] = useState(24);

    const [showName, setShowName] = useState(true);
    const [showPrice, setShowPrice] = useState(true);
    const [showCode, setShowCode] = useState(true);

    const [productsList, setProductsList] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const svgRef = useRef(null);

    useEffect(() => {
        setIsLoadingProducts(true);
        api.get('/products?limit=500')
            .then((res) => {
                setProductsList(res.data?.data || []);
                setIsLoadingProducts(false);
            })
            .catch(() => {
                setProductsList([]);
                setIsLoadingProducts(false);
            });
    }, []);

    useEffect(() => {
        if (!svgRef.current || !barcodeValue.trim()) return;

        try {
            JsBarcode(svgRef.current, barcodeValue.trim(), {
                format: barcodeFormat,
                width: 2,
                height: 70,
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
    }, [barcodeValue, barcodeFormat, showCode]);

    const handleProductSelect = (prod) => {
        setSelectedProductId(prod._id);
        setProductName(prod.name || '');
        setBarcodeValue(prod.barcode || prod.sku || prod.productCode || '0021');
        setPrice(prod.basePrice || 0);
    };

    const handleGenerateRandomCode = () => {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const newCode = `00${randomNum.toString().slice(0, 4)}`;
        setBarcodeValue(newCode);
        toast.success(`Generated barcode: ${newCode}`);
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
            toast.error('Please allow popups to print label sheet.');
            return;
        }

        const labelsHtml = Array.from({ length: printCount }).map(() => `
            <div style="
                width: 55mm;
                height: 35mm;
                border: 1px dashed #cbd5e1;
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
                ${showName ? `<div style="font-size: 11px; font-weight: bold; font-family: sans-serif; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${productName || 'GLX Product'}</div>` : ''}
                <svg class="barcode-item" data-code="${barcodeValue.trim()}"></svg>
                ${showPrice ? `<div style="font-size: 12px; font-weight: 900; font-family: sans-serif;">LKR ${(price || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</div>` : ''}
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Barcode Sticker Sheet - GLX Industries</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    body { font-family: sans-serif; margin: 0; padding: 10px; background: #fff; }
                    .label-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(55mm, 1fr)); gap: 4mm; }
                    @media print { body { padding: 0; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 15px; text-align: right;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Print Barcode Label Sheet
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

    const filteredProducts = productsList.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Barcode Generator Studio & Label Printing"
                description="Generate barcodes, barcode stickers, price tags, and printable label sheets"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Controls & Product Selector */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <BarcodeIcon className="w-5 h-5 text-sky-600" /> Barcode Configuration
                            </h3>
                            <Button variant="outline" onClick={handleGenerateRandomCode} size="sm">
                                <RefreshCw className="w-4 h-4 mr-1.5" /> Auto-Generate Code
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                    Barcode Code / Value <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={barcodeValue}
                                    onChange={(e) => setBarcodeValue(e.target.value)}
                                    placeholder="e.g. 0021 or 893000000021"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                    Barcode Symbology / Format
                                </label>
                                <select
                                    value={barcodeFormat}
                                    onChange={(e) => setBarcodeFormat(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                >
                                    <option value="CODE128">CODE128 (Standard Wholesale)</option>
                                    <option value="CODE39">CODE39 (Alphanumeric)</option>
                                    <option value="EAN13">EAN-13 (13 Digits)</option>
                                    <option value="UPC">UPC (12 Digits)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                                    Product Name Label
                                </label>
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    placeholder="e.g. Aluminium Sliding Door Profile"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
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
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold"
                                />
                            </div>
                        </div>

                        {/* Customization Checkboxes */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <span className="text-xs font-bold uppercase text-slate-500 block">Sticker Elements Display</span>
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showName}
                                        onChange={(e) => setShowName(e.target.checked)}
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    Display Product Name
                                </label>
                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showPrice}
                                        onChange={(e) => setShowPrice(e.target.checked)}
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    Display Price Tag (LKR)
                                </label>
                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showCode}
                                        onChange={(e) => setShowCode(e.target.checked)}
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    Display Human Readable Code
                                </label>
                            </div>
                        </div>
                    </Card>

                    {/* Product Selection List */}
                    <Card className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <Package className="w-4 h-4 text-sky-600" /> Select Product from Inventory
                            </h4>
                            <div className="relative w-64">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search inventory..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs"
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border rounded-xl">
                            {filteredProducts.map((p) => (
                                <div
                                    key={p._id}
                                    onClick={() => handleProductSelect(p)}
                                    className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                        selectedProductId === p._id
                                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-bold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div>
                                        <p className="font-semibold text-sm">{p.name}</p>
                                        <span className="font-mono text-slate-500 text-[11px]">
                                            Code: {p.productCode} | Barcode: {p.barcode || 'Not set'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-600 dark:text-emerald-400">
                                            LKR {(p.basePrice || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Live Preview & Print Panel */}
                <div className="space-y-6">
                    <Card className="p-6 text-center space-y-6 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                            Live Barcode Preview
                        </h4>

                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block max-w-full">
                            {showName && (
                                <p className="font-bold text-slate-900 text-sm mb-2 line-clamp-1">
                                    {productName || 'GLX Product'}
                                </p>
                            )}
                            <svg ref={svgRef}></svg>
                            {showPrice && (
                                <p className="text-xl font-black text-emerald-600 mt-2">
                                    LKR {(price || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>

                        {/* Print Quantity */}
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-left space-y-3">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                Label Copies Count
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={printCount}
                                onChange={(e) => setPrintCount(parseInt(e.target.value, 10) || 1)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-base"
                            />
                            <p className="text-xs text-slate-500">Formats labels for standard sticker sheets & thermal printers.</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            <Button variant="primary" onClick={handlePrintStickerSheet} className="w-full py-3 shadow-md">
                                <Printer className="w-5 h-5 mr-2" /> Print {printCount} Label(s)
                            </Button>
                            <Button variant="secondary" onClick={handleDownloadPNG} className="w-full">
                                <Download className="w-4 h-4 mr-2" /> Download Barcode PNG
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
