import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { format } from 'date-fns';
import {
    Plus, FileText, Trash2, Send,
    MapPin, Clock, X, ShoppingCart, Edit, Eye, Download, Search, Image as ImageIcon, Printer, CheckCircle, RotateCcw, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useSettings } from '../features/settings/useSettings';
import DocumentPrintView from '../components/print/DocumentPrintView';
import ShareDocumentSmsModal from '../components/ShareDocumentSmsModal';
import { exportDocumentToPDF, exportElementToPDF, printDocumentAsPDF, printElementAsPDF } from '../utils/dataExport';
import { getApiUrl } from '../api/config';
import { translateText, detectLanguage } from '../utils/translationService';
import { usePermission } from '../hooks/usePermission';

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return String(dateStr);
    }
};

const QuotationsPage = () => {
    const navigate = useNavigate();
    const { hasPermission, isAdmin } = usePermission();
    const canCreate = isAdmin || hasPermission('sales.create');
    const canEdit = isAdmin || hasPermission('sales.edit');
    const canDelete = isAdmin || hasPermission('sales.delete');
    const { data: settingsData } = useSettings();
    const settings = settingsData?.data;
    const [quotations, setQuotations] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [previewQuote, setPreviewQuote] = useState(null);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [documentTypeFilter, setDocumentTypeFilter] = useState('');

    const printRef = useRef();

    // Form inputs state
    const [formData, setFormData] = useState({
        documentType: 'quotation',
        quoteNumber: '', 
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        insuranceCompany: '',
        vehicleOwner: '',
        vehicleNo: '',
        vehicleModel: '',
        jobCaption: '',
        salesRep: 'Asanka',
        branch: 'JA-ELA',
        numberPlateImage: '',
        lorryBodyImage: '',
        bodyDimensions: { length: '8 Feet 5 Inch', width: '67 Inch', height: '5 Feet 6 Inch' },
        specifications: ['Non Rivet White Color Body', 'Japan Model Original Corner Set Bar', 'Rear 2 Doors (Waterproof Board)', 'Rear Gutter & Footboard'],
        warrantyInfo: '10 Years For Body Structure, 10 Years Full Body Waterproofing, 03 Years For All Doors.',
        status: 'draft',
        items: [{ product: '', productName: '', productTranslation: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
        totalAmount: 0, 
        laborCost: 0,
        advanceAmount: 0,
        balanceAmount: 0,
        discount: 0,
        tax: 0,
        grandTotal: 0,
        expiryDate: '', 
        notes: ''
    });

    // Revert Conversion State
    const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
    const [revertQuote, setRevertQuote] = useState(null);
    const [revertAdminPassword, setRevertAdminPassword] = useState('');
    const [reverting, setReverting] = useState(false);

    // Autocomplete UI state
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [showProductSuggestions, setShowProductSuggestions] = useState(null);

    // Convert to Project Dialog State
    const [isConvertToProjectOpen, setIsConvertToProjectOpen] = useState(false);
    const [convertProjectYard, setConvertProjectYard] = useState('');
    const [convertProjectEmployees, setConvertProjectEmployees] = useState([]);
    const [isProjectAdvanceChecked, setIsProjectAdvanceChecked] = useState(false);
    const [projectAdvanceAmount, setProjectAdvanceAmount] = useState(0);
    const [projectAdvanceMethod, setProjectAdvanceMethod] = useState('cash');
    const [projectAdvanceBankAccountId, setProjectAdvanceBankAccountId] = useState('');
    const [projectAdvanceReference, setProjectAdvanceReference] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);

    // Convert to Invoice Dialog State
    const [isConvertToInvoiceOpen, setIsConvertToInvoiceOpen] = useState(false);
    const [selectedConvertQuoteForInvoice, setSelectedConvertQuoteForInvoice] = useState(null);
    const [convertInvoiceType, setConvertInvoiceType] = useState('commercial');
    const [convertInvoiceAdvanceAmount, setConvertInvoiceAdvanceAmount] = useState(0);
    const [convertInvoicePaymentMethod, setConvertInvoicePaymentMethod] = useState('cash');
    const [convertInvoiceBankAccountId, setConvertInvoiceBankAccountId] = useState('');
    const [convertInvoiceReference, setConvertInvoiceReference] = useState('');

    const fetchQuotations = async () => {
        try {
            const { data } = await api.get('/crm/quotations');
            setQuotations(data.data || []);
        } catch (error) {
            toast.error('Failed to load quotations / estimates');
        } finally {
            setLoading(false);
        }
    };

    const filteredQuotations = quotations.filter((quote) => {
        const matchesSearch = 
            (quote.quoteNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (quote.vehicleNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (quote.customerName || quote.vehicleOwner || quote.customerId?.companyName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter ? quote.status === statusFilter : true;
        const matchesDocType = documentTypeFilter ? quote.documentType === documentTypeFilter : true;
        return matchesSearch && matchesStatus && matchesDocType;
    });

    const fetchData = async () => {
        try {
            const [prodRes, custRes, empRes, userRes, bankRes] = await Promise.all([
                api.get('/products?limit=1000&status=active').catch(() => ({ data: { data: [] } })),
                api.get('/customers?limit=1000&status=active').catch(() => ({ data: { data: [] } })),
                api.get('/hr/employees?limit=500&status=active').catch(() => ({ data: { data: [] } })),
                api.get('/users?limit=500').catch(() => ({ data: { data: [] } })),
                api.get('/finance/bank-accounts').catch(() => ({ data: { data: [] } }))
            ]);
            setProducts(prodRes.data.data || []);
            setCustomers(custRes.data.data || []);
            setEmployees(empRes.data.data || []);
            setUsers(userRes.data.data || []);
            setBankAccounts(bankRes.data?.data || []);
        } catch (error) {
            console.error('Failed to load products/customers/employees/users/bank-accounts', error);
        }
    };

    useEffect(() => {
        fetchQuotations();
        fetchData();
    }, []);

    const calculateTotals = (items, discount = 0, tax = 0, laborCost = 0, advanceAmount = 0) => {
        const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
        const grandTotal = subtotal + Number(laborCost || 0) + Number(tax || 0) - Number(discount || 0);
        const balanceAmount = Math.max(0, grandTotal - Number(advanceAmount || 0));
        return { subtotal, grandTotal, balanceAmount };
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        if (field === 'quantity' || field === 'unitPrice') {
            newItems[index].subtotal = Number(newItems[index].quantity || 0) * Number(newItems[index].unitPrice || 0);
        }
        const { subtotal, grandTotal, balanceAmount } = calculateTotals(newItems, formData.discount, formData.tax, formData.laborCost, formData.advanceAmount);
        setFormData({ ...formData, items: newItems, totalAmount: subtotal, grandTotal, balanceAmount });
    };

    const handleFormChange = (name, value) => {
        const updated = { ...formData, [name]: value };
        const { subtotal, grandTotal, balanceAmount } = calculateTotals(updated.items, updated.discount, updated.tax, updated.laborCost, updated.advanceAmount);
        setFormData({ ...updated, totalAmount: subtotal, grandTotal, balanceAmount });
    };

    const handleImageUpload = (field, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, [field]: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const addItem = () => {
        setFormData({ ...formData, items: [...formData.items, { product: '', productName: '', productTranslation: '', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }] });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        const { subtotal, grandTotal, balanceAmount } = calculateTotals(newItems, formData.discount, formData.tax, formData.laborCost, formData.advanceAmount);
        setFormData({ ...formData, items: newItems, totalAmount: subtotal, grandTotal, balanceAmount });
    };

    
    const handleTranslate = async (index) => {
        const item = formData.items[index];
        const text = item.productName || '';
        if (!text.trim()) return;
        try {
            const detected = detectLanguage(text);
            if (detected === 'si' || detected === 'ta') {
                const translated = await translateText(text, 'en');
                handleItemChange(index, 'productName', translated);
                handleItemChange(index, 'productTranslation', text);
                toast.success('Translated Sinhala/Tamil to English!');
            } else {
                const translated = await translateText(text, 'si');
                handleItemChange(index, 'productTranslation', translated);
                toast.success('Translated English to Sinhala!');
            }
        } catch (err) {
            toast.error('Translation failed: ' + err.message);
        }
    };

    const openForm = (quote = null, defaultType = 'quotation') => {
        if (quote) {
            setEditing(quote);
            setCustomerSearch(quote.customerName || quote.vehicleOwner || quote.customerId?.companyName || '');
            setFormData({
                documentType: quote.documentType || (quote.quoteNumber?.startsWith('EST') ? 'estimate' : 'quotation'),
                quoteNumber: quote.quoteNumber || '',
                customerId: quote.customerId?._id || quote.customerId || '',
                customerName: quote.customerName || quote.vehicleOwner || quote.customerId?.companyName || '',
                customerEmail: quote.customerEmail || '',
                customerPhone: quote.customerPhone || '',
                customerAddress: quote.customerAddress || '',
                insuranceCompany: quote.insuranceCompany || '',
                vehicleOwner: quote.vehicleOwner || quote.customerName || '',
                vehicleNo: quote.vehicleNo || '',
                vehicleModel: quote.vehicleModel || '',
                jobCaption: quote.jobCaption || '',
                salesRep: quote.salesRep || 'Asanka',
                introducer: quote.introducer?._id || quote.introducer || '',
                introducerName: quote.introducerName || '',
                biller: quote.biller?._id || quote.biller || '',
                billerName: quote.billerName || '',
                branch: quote.branch || 'JA-ELA',
                numberPlateImage: quote.numberPlateImage || '',
                lorryBodyImage: quote.lorryBodyImage || '',
                bodyDimensions: quote.bodyDimensions || { length: '8 Feet 5 Inch', width: '67 Inch', height: '5 Feet 6 Inch' },
                specifications: quote.specifications?.length > 0 ? quote.specifications : ['Non Rivet White Color Body', 'Japan Model Original Corner Set Bar', 'Rear 2 Doors (Waterproof Board)', 'Rear Gutter & Footboard'],
                warrantyInfo: quote.warrantyInfo || '10 Years For Body Structure, 10 Years Full Body Waterproofing, 03 Years For All Doors.',
                status: quote.status || 'draft',
                items: quote.items?.length > 0 ? quote.items.map(item => ({
                    product: item.product?._id || item.product || '',
                    productName: item.productName || item.product?.name || '',
                    productTranslation: item.productTranslation || '',
                    description: item.description || '',
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    subtotal: item.subtotal || (item.quantity * item.unitPrice) || 0
                })) : [{ product: '', productName: '', productTranslation: '', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
                totalAmount: quote.totalAmount || 0,
                laborCost: quote.laborCost || 0,
                advanceAmount: quote.advanceAmount || 0,
                balanceAmount: quote.balanceAmount || Math.max(0, (quote.grandTotal || 0) - (quote.advanceAmount || 0)),
                discount: quote.discount || 0,
                tax: quote.tax || 0,
                grandTotal: quote.grandTotal || quote.totalAmount || 0,
                expiryDate: quote.expiryDate ? new Date(quote.expiryDate).toISOString().split('T')[0] : '',
                notes: quote.notes || ''
            });
        } else {
            setEditing(null);
            setCustomerSearch('');
            setFormData({
                documentType: defaultType,
                quoteNumber: '', 
                customerId: '', 
                customerName: '',
                customerEmail: '',
                customerPhone: '',
                customerAddress: '',
                insuranceCompany: '',
                vehicleOwner: '',
                vehicleNo: '',
                vehicleModel: '',
                jobCaption: defaultType === 'estimate' ? 'Accident Repair' : 'Truck Body Manufacture',
                salesRep: 'Asanka',
                introducer: '',
                introducerName: '',
                biller: '',
                billerName: '',
                branch: 'JA-ELA',
                numberPlateImage: '',
                lorryBodyImage: '',
                bodyDimensions: { length: '8 Feet 5 Inch', width: '67 Inch', height: '5 Feet 6 Inch' },
                specifications: ['Non Rivet White Color Body', 'Japan Model Original Corner Set Bar', 'Rear 2 Doors (Waterproof Board)', 'Rear Gutter & Footboard'],
                warrantyInfo: '10 Years For Body Structure, 10 Years Full Body Waterproofing, 03 Years For All Doors.',
                status: 'draft',
                items: [{ product: '', productName: '', productTranslation: '', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
                totalAmount: 0, 
                laborCost: 0,
                advanceAmount: 0,
                balanceAmount: 0,
                discount: 0,
                tax: 0,
                grandTotal: 0,
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerName && !formData.vehicleOwner) {
            toast.error('Please enter customer / vehicle owner name');
            return;
        }
        if (formData.items.some(item => !item.productName)) {
            toast.error('Please specify description for all line items');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                items: formData.items.map(item => {
                    const cleaned = { ...item };
                    if (!cleaned.product || cleaned.product === '') {
                        delete cleaned.product;
                    }
                    return cleaned;
                })
            };

            if (editing) {
                await api.put(`/crm/quotations/${editing._id}`, payload);
                toast.success(`${formData.documentType === 'estimate' ? 'Estimate' : 'Quotation'} updated`);
            } else {
                await api.post('/crm/quotations', payload);
                toast.success(`${formData.documentType === 'estimate' ? 'Estimate' : 'Quotation'} created`);
            }
            setIsFormOpen(false);
            fetchQuotations();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenConvertToInvoiceModal = (quote, defaultType = 'commercial') => {
        setSelectedConvertQuoteForInvoice(quote);
        setConvertInvoiceType(defaultType);
        setConvertInvoiceAdvanceAmount(quote?.advanceAmount || 0);
        setConvertInvoicePaymentMethod('cash');
        setConvertInvoiceBankAccountId('');
        setConvertInvoiceReference('');
        setIsConvertToInvoiceOpen(true);
    };

    const handleConvertToInvoiceSubmit = async (e) => {
        e.preventDefault();
        const targetQuote = selectedConvertQuoteForInvoice || previewQuote;
        if (!targetQuote) return;
        setSaving(true);
        try {
            const payload = {
                invoiceType: convertInvoiceType,
                advanceAmount: Number(convertInvoiceAdvanceAmount) || 0,
                paymentMethod: convertInvoicePaymentMethod,
                bankAccountId: convertInvoicePaymentMethod !== 'cash' ? (convertInvoiceBankAccountId || undefined) : undefined,
                paymentReference: convertInvoiceReference || undefined
            };

            const { data } = await api.post(`/crm/quotations/${targetQuote._id}/convert-to-invoice`, payload);
            toast.success(`Successfully converted to ${convertInvoiceType === 'proforma' ? 'Proforma' : 'Commercial'} Invoice!`);
            setIsConvertToInvoiceOpen(false);
            setSelectedConvertQuoteForInvoice(null);
            setIsPreviewOpen(false);
            fetchQuotations();
            if (data.data?._id) {
                navigate(`/invoices/${data.data._id}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to convert to invoice');
        } finally {
            setSaving(false);
        }
    };

    const handleConvertToProjectSubmit = async (e) => {
        e.preventDefault();
        if (!convertProjectYard.trim()) { toast.error('Enter yard or worksite location'); return; }
        setSaving(true);
        try {
            const payload = {
                yard: convertProjectYard,
                assignedEmployees: convertProjectEmployees,
                details: previewQuote.jobCaption,
                advancePaymentAmount: isProjectAdvanceChecked ? Number(projectAdvanceAmount) : 0,
                paymentMethod: isProjectAdvanceChecked ? projectAdvanceMethod : undefined,
                bankAccountId: isProjectAdvanceChecked ? projectAdvanceBankAccountId : undefined,
                paymentReference: isProjectAdvanceChecked ? projectAdvanceReference : undefined,
            };

            const { data } = await api.post(`/crm/quotations/${previewQuote._id}/convert-to-project`, payload);
            toast.success('Successfully converted to Project!');
            setIsConvertToProjectOpen(false);
            setIsPreviewOpen(false);
            fetchQuotations();
            if (data.data?._id) {
                navigate(`/crm/projects/${data.data._id}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to convert to project');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/crm/quotations/${deleting._id}`);
            toast.success('Document deleted');
            setDeleting(null);
            fetchQuotations();
        } catch { toast.error('Failed to delete'); }
    };

    const handleRevertConversionSubmit = async (e) => {
        e.preventDefault();
        if (!revertAdminPassword) {
            toast.error('Please enter Admin Password');
            return;
        }
        setReverting(true);
        try {
            await api.post(`/crm/quotations/${revertQuote._id}/revert-conversion`, {
                adminPassword: revertAdminPassword
            });
            toast.success('Successfully reverted conversion back to Draft!');
            setIsRevertModalOpen(false);
            setRevertQuote(null);
            setRevertAdminPassword('');
            fetchQuotations();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to revert conversion');
        } finally {
            setReverting(false);
        }
    };

    const handlePrintDocument = () => {
        if (printRef.current) {
            printElementAsPDF(printRef.current);
        } else if (previewQuote) {
            printDocumentAsPDF(previewQuote, previewQuote.documentType || 'quotation');
        }
    };

    const getStatusStyle = (status) => {
        const colors = {
            draft: 'text-gray-600 bg-gray-50 border-gray-200',
            sent: 'text-blue-600 bg-blue-50 border-blue-200',
            accepted: 'text-emerald-600 bg-emerald-50 border-emerald-200',
            rejected: 'text-red-600 bg-red-50 border-red-200',
            expired: 'text-orange-600 bg-orange-50 border-orange-200',
            converted: 'text-purple-600 bg-purple-50 border-purple-200 font-bold'
        };
        return colors[status] || 'text-gray-400 bg-gray-50';
    };

    const getFilteredContacts = () => {
        const q = customerSearch.toLowerCase();
        const results = [];
        customers.forEach(c => {
            const name = c.displayName || c.companyName || '';
            if (name.toLowerCase().includes(q)) {
                results.push({ id: c._id, name, type: 'Customer', original: c });
            }
        });
        return results.slice(0, 8);
    };

    const handleSelectContact = (contact) => {
        setCustomerSearch(contact.name);
        setShowCustomerSuggestions(false);
        
        let email = '';
        let phone = '';
        let address = '';

        if (contact.type === 'Customer') {
            email = contact.original.primaryContact?.email || '';
            phone = contact.original.primaryContact?.phone || '';
            const b = contact.original.billingAddress;
            address = b ? `${b.line1 || ''}, ${b.city || ''}, ${b.country || 'Sri Lanka'}` : '';
        }

        const introducerId = contact.type === 'Customer' ? (contact.original.introducer || '') : '';
        const introducerName = contact.type === 'Customer' ? (contact.original.introducerName || '') : '';

        setFormData(prev => ({
            ...prev,
            customerId: contact.id,
            customerName: contact.name,
            vehicleOwner: contact.name,
            customerEmail: email,
            customerPhone: phone,
            customerAddress: address,
            introducer: introducerId,
            introducerName: introducerName
        }));
    };

    const getFilteredProducts = (query) => {
        const q = query.toLowerCase();
        return products.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
    };

    const handleSelectProduct = (index, product) => {
        const newItems = [...formData.items];
        newItems[index].product = product._id;
        newItems[index].productName = product.name;
        newItems[index].unitPrice = product.basePrice || product.mrp || 0;
        newItems[index].subtotal = newItems[index].quantity * newItems[index].unitPrice;
        
        setShowProductSuggestions(null);
        
        const { subtotal, grandTotal } = calculateTotals(newItems, formData.discount, formData.tax);
        setFormData({ ...formData, items: newItems, totalAmount: subtotal, grandTotal });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-gray-900">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold">Quotations & Estimates</h2>
                    <p className="text-sm text-gray-500">Manage vehicle body engineering quotations, insurance estimates & convert to invoices</p>
                </div>
                {canCreate && (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => openForm(null, 'estimate')}>
                            <Plus size={16} className="mr-1.5" /> New Estimate (EST)
                        </Button>
                        <Button variant="primary" onClick={() => openForm(null, 'quotation')}>
                            <Plus size={16} className="mr-1.5" /> New Quotation (QUT)
                        </Button>
                    </div>
                )}
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search by quote/estimate ref, vehicle no, customer name..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                const searchVal = e.target.value.trim();
                                if (searchVal.toUpperCase().startsWith('QUT-') || searchVal.toUpperCase().startsWith('EST-')) {
                                    const found = quotations.find(q => q.quoteNumber?.toUpperCase() === searchVal.toUpperCase() || q.quotationCode?.toUpperCase() === searchVal.toUpperCase());
                                    if (found) {
                                        setPreviewQuote(found);
                                        setIsPreviewOpen(true);
                                    } else {
                                        try {
                                            const res = await api.get(`/crm/quotations?search=${searchVal}`);
                                            const foundBack = res.data?.data?.find(q => q.quoteNumber?.toUpperCase() === searchVal.toUpperCase() || q.quotationCode?.toUpperCase() === searchVal.toUpperCase());
                                            if (foundBack) {
                                                setPreviewQuote(foundBack);
                                                setIsPreviewOpen(true);
                                            }
                                        } catch (err) {
                                            console.error('Barcode fetch failed', err);
                                        }
                                    }
                                }
                            }
                        }}
                    />
                </div>
                <div className="w-full sm:w-44">
                    <select 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[16px] sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                        value={documentTypeFilter}
                        onChange={(e) => setDocumentTypeFilter(e.target.value)}
                    >
                        <option value="">All Document Types</option>
                        <option value="quotation">Quotations (QUT)</option>
                        <option value="estimate">Estimates (EST)</option>
                    </select>
                </div>
                <div className="w-full sm:w-40">
                    <select 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[16px] sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="converted">Converted</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array(3).fill(0).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse"></div>)
                ) : filteredQuotations.length === 0 ? (
                    <div className="col-span-full py-20 bg-white border border-dashed border-gray-300 rounded-xl text-center text-gray-500">
                        <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="italic">No matching quotations or estimates found</p>
                    </div>
                ) : (
                    filteredQuotations.map((quote) => {
                        const isEst = quote.documentType === 'estimate' || quote.quoteNumber?.startsWith('EST');
                        return (
                            <div key={quote._id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col group h-full">
                                <div className="p-5 border-b border-gray-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${isEst ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {isEst ? 'ESTIMATE' : 'QUOTATION'}
                                                </span>
                                                <h3 className="font-bold font-mono tracking-tight">{quote.quoteNumber || quote.quotationCode}</h3>
                                            </div>
                                            <p className="text-xs font-semibold text-gray-700 mt-1">{quote.vehicleOwner || quote.customerName || 'Client'}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-widest ${getStatusStyle(quote.status)}`}>
                                            {quote.status}
                                        </span>
                                    </div>

                                    {quote.vehicleNo && (
                                        <div className="mt-2 text-xs font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block font-bold">
                                            🚘 Vehicle No: {quote.vehicleNo}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-3">
                                        <div className="text-xl font-black text-gray-900 font-mono">
                                            LKR {(quote.grandTotal || quote.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Grand Total</div>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 space-y-2 text-xs text-gray-600">
                                    {quote.insuranceCompany && (
                                        <p><span className="text-gray-400">Insurance:</span> {quote.insuranceCompany}</p>
                                    )}
                                    {quote.vehicleModel && (
                                        <p><span className="text-gray-400">Model:</span> {quote.vehicleModel}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                                        <Clock size={13} className="text-gray-400" />
                                        Date: {formatDate(quote.date || quote.createdAt)}
                                    </div>

                                    {/* Thumbnail Indicators for photos */}
                                    <div className="flex gap-2 pt-2">
                                        <div className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 ${quote.numberPlateImage ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                            <ImageIcon size={12} /> Plate Photo {quote.numberPlateImage ? '✓' : ''}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 ${quote.lorryBodyImage ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                            <ImageIcon size={12} /> Body Photo {quote.lorryBodyImage ? '✓' : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 flex gap-2 rounded-b-2xl border-t border-gray-100 flex-wrap">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setPreviewQuote(quote); setIsPreviewOpen(true); }}>
                                        <Eye size={14} className="mr-1" /> View
                                    </Button>
                                    {canEdit && (
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openForm(quote)}>
                                            <Edit size={14} className="mr-1" /> Edit
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => exportDocumentToPDF(quote, quote.documentType || 'quotation')} title="Download PDF">
                                        <Download size={14} />
                                    </Button>
                                    {quote.status === 'converted' ? (
                                        canEdit && (
                                            <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 font-bold" onClick={() => { setRevertQuote(quote); setRevertAdminPassword(''); setIsRevertModalOpen(true); }} title="Revert Conversion (Admin Password required)">
                                                <RotateCcw size={14} className="mr-1" /> Revert
                                            </Button>
                                        )
                                    ) : (
                                        canEdit && (
                                            <Button variant="primary" size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { setPreviewQuote(quote); setIsPreviewOpen(true); }}>
                                                <ShoppingCart size={14} className="mr-1" /> Convert
                                            </Button>
                                        )
                                    )}
                                    {canDelete && (
                                        <Button variant="outline" size="sm" onClick={() => setDeleting(quote)}>
                                            <Trash2 size={14} className="text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Quotation / Estimate Form Modal */}
            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editing ? `Edit ${formData.documentType === 'estimate' ? 'Estimate' : 'Quotation'}` : `New ${formData.documentType === 'estimate' ? 'Estimate (EST)' : 'Quotation (QUT)'}`} size="xl">
                <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                    
                    {/* Document Type Selector & Ref */}
                    <div className="bg-slate-100 p-3 rounded-xl flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.documentType === 'quotation' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                onClick={() => setFormData(prev => ({ ...prev, documentType: 'quotation' }))}
                            >
                                Quotation (QUT-...)
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.documentType === 'estimate' ? 'bg-amber-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                onClick={() => setFormData(prev => ({ ...prev, documentType: 'estimate' }))}
                            >
                                Estimate (EST-...)
                            </button>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-gray-500 uppercase block">Ref Code</span>
                            <span className="font-mono font-bold text-sm text-gray-800">{formData.quoteNumber || '(Auto Generated)'}</span>
                        </div>
                    </div>

                    {/* Vehicle & Client Details */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-wide">Vehicle & Owner Information</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle Owner / Customer Name *</label>
                                <input 
                                    type="text"
                                    required
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    value={formData.customerName}
                                    placeholder="e.g. Mr. UPDK Dhanasekara"
                                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value, vehicleOwner: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle Number (Plate No)</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-mono uppercase font-bold text-blue-700"
                                    value={formData.vehicleNo}
                                    placeholder="e.g. WP DAI-1974"
                                    onChange={(e) => handleFormChange('vehicleNo', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Insurance Company</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={formData.insuranceCompany}
                                    placeholder="e.g. Fairfirst Insurance Limited"
                                    onChange={(e) => handleFormChange('insuranceCompany', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle Model</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={formData.vehicleModel}
                                    placeholder="e.g. TATA / New Mahindra Bolero"
                                    onChange={(e) => handleFormChange('vehicleModel', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Job Caption</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={formData.jobCaption}
                                    placeholder="e.g. Accident Repair / Body Construction"
                                    onChange={(e) => handleFormChange('jobCaption', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Phone</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={formData.customerPhone}
                                    placeholder="e.g. 0714193455"
                                    onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Introducer and Biller selection fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 pt-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Introducer (Employee)</label>
                                <select
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    value={formData.introducer || ''}
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        const emp = employees.find(x => x._id === empId);
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            introducer: empId, 
                                            introducerName: emp ? `${emp.firstName} ${emp.lastName}` : '' 
                                        }));
                                    }}
                                >
                                    <option value="">-- Select Introducer --</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Biller (User)</label>
                                <select
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    value={formData.biller || ''}
                                    onChange={(e) => {
                                        const userId = e.target.value;
                                        const usr = users.find(x => x._id === userId);
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            biller: userId, 
                                            billerName: usr ? `${usr.firstName} ${usr.lastName}` : '' 
                                        }));
                                    }}
                                >
                                    <option value="">-- Select Biller --</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Photo Uploads (Number Plate & Lorry Body) - Key Requirement */}
                    <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-3">
                        <span className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                            <ImageIcon size={16} /> Photo Attachments (Displayed on Print & PDF)
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Number Plate Photo */}
                            <div className="bg-white p-3 rounded-lg border border-blue-200 space-y-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase">Number Plate Photo</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="text-xs text-gray-500 w-full file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                    onChange={(e) => handleImageUpload('numberPlateImage', e.target.files[0])}
                                />
                                {formData.numberPlateImage ? (
                                    <div className="relative border rounded p-1 bg-gray-50">
                                        <img src={formData.numberPlateImage} alt="Number Plate Preview" className="h-24 object-contain mx-auto" />
                                        <button type="button" onClick={() => handleFormChange('numberPlateImage', '')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X size={12} /></button>
                                    </div>
                                ) : (
                                    <input 
                                        type="text" 
                                        placeholder="Or paste Image URL..." 
                                        className="w-full text-xs px-2 py-1 border rounded bg-gray-50"
                                        value={formData.numberPlateImage}
                                        onChange={(e) => handleFormChange('numberPlateImage', e.target.value)}
                                    />
                                )}
                            </div>

                            {/* Lorry Body Photo */}
                            <div className="bg-white p-3 rounded-lg border border-blue-200 space-y-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase">Lorry Body Photo</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="text-xs text-gray-500 w-full file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                    onChange={(e) => handleImageUpload('lorryBodyImage', e.target.files[0])}
                                />
                                {formData.lorryBodyImage ? (
                                    <div className="relative border rounded p-1 bg-gray-50">
                                        <img src={formData.lorryBodyImage} alt="Lorry Body Preview" className="h-24 object-contain mx-auto" />
                                        <button type="button" onClick={() => handleFormChange('lorryBodyImage', '')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X size={12} /></button>
                                    </div>
                                ) : (
                                    <input 
                                        type="text" 
                                        placeholder="Or paste Image URL..." 
                                        className="w-full text-xs px-2 py-1 border rounded bg-gray-50"
                                        value={formData.lorryBodyImage}
                                        onChange={(e) => handleFormChange('lorryBodyImage', e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Parts and Labour Line Items Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-gray-700 border-b pb-2">
                            <span className="text-xs font-black uppercase">Parts & Labour Charges</span>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus size={14} className="mr-1" /> Add Charge Item</Button>
                        </div>
                        <div className="overflow-x-auto">
                        {formData.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end bg-gray-50/80 p-2.5 rounded-xl relative border border-gray-200 mb-2">
                                <div className="col-span-12 md:col-span-6 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Item Description</label>
                                        <button 
                                            type="button" 
                                            onClick={() => handleTranslate(index)} 
                                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded"
                                        >
                                            Translate
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-calibri"
                                            placeholder="e.g. Set Bar Corner (21 feet) / Labour Charges / Paint Works"
                                            value={item.productName}
                                            onChange={(e) => {
                                                handleItemChange(index, 'productName', e.target.value);
                                                setShowProductSuggestions(index);
                                            }}
                                            onFocus={() => setShowProductSuggestions(index)}
                                            onBlur={() => setTimeout(() => setShowProductSuggestions(null), 250)}
                                        />
                                        {showProductSuggestions === index && (
                                            <div className="absolute z-50 left-0 right-0 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg mt-1 divide-y shadow-blue-500/10">
                                                {products
                                                    .filter(p => {
                                                        const search = (item.productName || '').toLowerCase().trim();
                                                        if (!search) return true;
                                                        const name = (p.name || p.productName || p.title || '').toLowerCase();
                                                        const code = (p.productCode || p.code || p.sku || '').toLowerCase();
                                                        return name.includes(search) || code.includes(search);
                                                    })
                                                    .slice(0, 10)
                                                    .map(p => {
                                                        const pName = p.name || p.productName || 'Item';
                                                        const pPrice = Number(p.basePrice || p.sellingPrice || p.retailPrice || p.costs?.lastPurchaseCost || p.costs?.averageCost || p.unitPrice || p.price || 0);
                                                        const pCode = p.productCode || p.code || 'NO-CODE';
                                                        return (
                                                            <button
                                                                key={p._id}
                                                                type="button"
                                                                onMouseDown={() => {
                                                                    const newItems = [...formData.items];
                                                                    const qty = Number(newItems[index].quantity || 1);
                                                                    newItems[index].product = p._id;
                                                                    newItems[index].productName = pName;
                                                                    newItems[index].unitPrice = pPrice;
                                                                    newItems[index].quantity = qty;
                                                                    newItems[index].subtotal = qty * pPrice;
                                                                    
                                                                    const { subtotal, grandTotal } = calculateTotals(newItems, formData.discount, formData.tax);
                                                                    setFormData({ ...formData, items: newItems, totalAmount: subtotal, grandTotal });
                                                                    setShowProductSuggestions(null);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition cursor-pointer"
                                                            >
                                                                <div className="font-bold text-gray-800">{pName}</div>
                                                                <div className="text-gray-500 flex justify-between text-[11px] mt-0.5">
                                                                    <span>Code: {pCode}</span>
                                                                    <span className="font-mono text-blue-600 font-semibold">LKR {pPrice.toLocaleString()}</span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-1 border border-dashed border-gray-300 rounded-lg text-xs bg-slate-50 text-blue-700 mt-1 font-calibri"
                                        placeholder="Translation (Sinhala/Tamil)"
                                        value={item.productTranslation || ''}
                                        onChange={(e) => handleItemChange(index, 'productTranslation', e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-800 mt-1 font-calibri"
                                        placeholder="Detailed Item Description / Work Specifications"
                                        value={item.description || ''}
                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                    />
                                </div>

                                <div className="col-span-4 md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Qty</label>
                                    <input type="number" min="1" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-center font-semibold" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} />
                                </div>

                                <div className="col-span-4 md:col-span-3 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Rate (LKR)</label>
                                    <input type="number" step="0.01" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-mono" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} />
                                </div>

                                <div className="col-span-3 md:col-span-1 flex justify-center pb-2">
                                    <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 transition" disabled={formData.items.length <= 1}><X size={18} /></button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Summary & Totals */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes / Terms</label>
                            <textarea 
                                rows={4}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                placeholder="Special notes, cash deposit requirements, validity details..."
                                value={formData.notes}
                                onChange={(e) => handleFormChange('notes', e.target.value)}
                            />
                        </div>

                        <div className="bg-slate-100 p-4 rounded-xl space-y-2 border border-gray-200 text-xs">
                            <div className="flex justify-between items-center font-semibold text-gray-700">
                                <span>Items Subtotal</span>
                                <span className="font-mono text-gray-900">LKR {formData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-gray-700">
                                <span>Labor Cost / Workmanship</span>
                                <input 
                                    type="number" 
                                    className="w-28 px-2 py-1 border rounded text-right font-mono text-xs bg-white text-emerald-700 font-bold"
                                    value={formData.laborCost} 
                                    onChange={(e) => handleFormChange('laborCost', Number(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-between items-center font-semibold text-gray-700">
                                <span>Discount</span>
                                <input 
                                    type="number" 
                                    className="w-28 px-2 py-1 border rounded text-right font-mono text-xs bg-white"
                                    value={formData.discount} 
                                    onChange={(e) => handleFormChange('discount', Number(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t font-black text-gray-900 text-sm">
                                <span>Grand Total</span>
                                <span className="font-mono text-blue-800">LKR {formData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-gray-700 pt-2 border-t">
                                <span>Advance Payment</span>
                                <input 
                                    type="number" 
                                    className="w-28 px-2 py-1 border rounded text-right font-mono text-xs bg-emerald-50 text-emerald-800 font-bold border-emerald-300"
                                    value={formData.advanceAmount} 
                                    onChange={(e) => handleFormChange('advanceAmount', Number(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-between items-center font-bold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                <span>Balance Due</span>
                                <span className="font-mono text-sm font-black">LKR {(formData.balanceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" loading={saving}>{editing ? 'Save Changes' : `Create ${formData.documentType === 'estimate' ? 'Estimate' : 'Quotation'}`}</Button>
                    </div>
                </form>
            </Modal>

            {previewQuote && (
                <ShareDocumentSmsModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    documentId={previewQuote._id}
                    documentType={previewQuote.documentType || 'quotation'}
                    defaultPhone={previewQuote.customerPhone || ''}
                />
            )}
            {/* A4 Print & QR Preview Modal */}
            <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title={`${previewQuote?.documentType === 'estimate' ? 'Estimate' : 'Quotation'} Printable View & QR Code`} size="xl">
                {previewQuote && (
                    <div className="p-3 sm:p-6 space-y-6">
                        <div className="max-h-[75vh] overflow-y-auto p-2 bg-gray-100 rounded-xl">
                            <DocumentPrintView ref={printRef} document={previewQuote} companyInfo={settings} />
                        </div>

                        {/* Professional Action Toolbar */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3 flex-wrap">
                            {/* Left: Close */}
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 transition-all duration-150 shadow-sm"
                            >
                                <X size={15} />
                                Close
                            </button>

                            {/* Right: Action Groups */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Document Actions Group */}
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1">
                                    <button
                                        onClick={handlePrintDocument}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg hover:bg-white hover:shadow-sm hover:text-gray-900 transition-all duration-150"
                                        title="Print Document"
                                    >
                                        <Printer size={14} />
                                        Print
                                    </button>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <button
                                        onClick={() => setShareModalOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg hover:bg-white hover:shadow-sm hover:text-gray-900 transition-all duration-150"
                                        title="Share via SMS"
                                    >
                                        <Send size={14} />
                                        Share SMS
                                    </button>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <button
                                        onClick={() => exportElementToPDF(printRef.current, `${previewQuote.documentType || 'quotation'}_${(previewQuote.quoteNumber || previewQuote.quotationCode || 'document').replace(/[\/\\:]/g, '_')}.pdf`)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 rounded-lg hover:bg-emerald-50 hover:shadow-sm transition-all duration-150"
                                        title="Download as PDF"
                                    >
                                        <Download size={14} />
                                        Download PDF
                                    </button>
                                </div>

                                {/* Conversion Actions Group */}
                                {previewQuote.status === 'converted' ? (
                                    <button
                                        onClick={() => { setRevertQuote(previewQuote); setRevertAdminPassword(''); setIsRevertModalOpen(true); }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-all duration-150 shadow-sm"
                                    >
                                        <RotateCcw size={13} />
                                        Revert Conversion
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-xl p-1">
                                        <button
                                            onClick={() => handleOpenConvertToInvoiceModal(previewQuote, 'commercial')}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-all duration-150 shadow-sm"
                                            title="Convert to Commercial Invoice"
                                        >
                                            <FileText size={13} />
                                            To Invoice
                                        </button>
                                        <div className="w-px h-5 bg-purple-200" />
                                        <button
                                            onClick={() => handleOpenConvertToInvoiceModal(previewQuote, 'proforma')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 rounded-lg hover:bg-purple-100 transition-all duration-150"
                                            title="Convert to Proforma Invoice"
                                        >
                                            <FileText size={13} />
                                            To Proforma
                                        </button>
                                        <div className="w-px h-5 bg-purple-200" />
                                        <button
                                            onClick={() => {
                                                setConvertProjectYard('');
                                                setConvertProjectEmployees([]);
                                                setIsProjectAdvanceChecked(false);
                                                setProjectAdvanceAmount(0);
                                                setProjectAdvanceMethod('cash');
                                                setProjectAdvanceBankAccountId('');
                                                setProjectAdvanceReference('');
                                                setIsConvertToProjectOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 rounded-lg hover:bg-blue-100 transition-all duration-150"
                                            title="Convert to Project"
                                        >
                                            <Briefcase size={13} />
                                            To Project
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Convert to Project Modal */}
            {isConvertToProjectOpen && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Convert to Project</h3>
                            <button onClick={() => setIsConvertToProjectOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg">×</button>
                        </div>
                        <form onSubmit={handleConvertToProjectSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Yard / Worksite Location</label>
                                <input
                                    type="text"
                                    required
                                    value={convertProjectYard}
                                    onChange={(e) => setConvertProjectYard(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    placeholder="e.g. JA-ELA Workshop / Yard 1"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-700 uppercase">Assign Employees</label>
                                <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                                    {employees.map(emp => (
                                        <label key={emp._id} className="flex items-center space-x-2 text-xs p-1 hover:bg-white rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={convertProjectEmployees.includes(emp._id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setConvertProjectEmployees([...convertProjectEmployees, emp._id]);
                                                    } else {
                                                        setConvertProjectEmployees(convertProjectEmployees.filter(id => id !== emp._id));
                                                    }
                                                }}
                                                className="rounded text-primary-600 border-gray-300"
                                            />
                                            <span>{emp.fullName || `${emp.firstName} ${emp.lastName}`} ({emp.employeeCode})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t pt-3 space-y-3">
                                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isProjectAdvanceChecked}
                                        onChange={(e) => setIsProjectAdvanceChecked(e.target.checked)}
                                        className="rounded text-primary-600 border-gray-300 w-4 h-4"
                                    />
                                    <span>Record Advance Payment</span>
                                </label>

                                {isProjectAdvanceChecked && (
                                    <div className="p-3 bg-slate-50 border border-gray-200 rounded-xl space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Advance Amount (LKR)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="1"
                                                    value={projectAdvanceAmount}
                                                    onChange={(e) => setProjectAdvanceAmount(Number(e.target.value))}
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Payment Method</label>
                                                <select
                                                    value={projectAdvanceMethod}
                                                    onChange={(e) => setProjectAdvanceMethod(e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="bank_transfer">Bank Transfer</option>
                                                    <option value="card">Card</option>
                                                    <option value="cheque">Cheque</option>
                                                </select>
                                            </div>
                                        </div>

                                        {(projectAdvanceMethod === 'cheque' || projectAdvanceMethod === 'bank_transfer') && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Company Bank Account</label>
                                                <select
                                                    required
                                                    value={projectAdvanceBankAccountId}
                                                    onChange={(e) => setProjectAdvanceBankAccountId(e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                                >
                                                    <option value="">-- Select Account --</option>
                                                    {bankAccounts.map(acc => (
                                                        <option key={acc._id} value={acc._id}>
                                                            {acc.bankName} - {acc.accountNumber} (LKR {acc.balance?.toLocaleString()})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Payment Reference / Notes</label>
                                            <input
                                                type="text"
                                                value={projectAdvanceReference}
                                                onChange={(e) => setProjectAdvanceReference(e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                                placeholder="e.g. Txn Ref, Cheque No, etc."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsConvertToProjectOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={saving}>Convert to Project</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Revert Conversion Modal */}
            {isRevertModalOpen && revertQuote && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-amber-600" />
                                Revert Conversion
                            </h3>
                            <button onClick={() => setIsRevertModalOpen(false)} className="text-gray-400 hover:text-slate-600 text-lg font-bold">×</button>
                        </div>
                        <p className="text-xs text-slate-600 leading-normal">
                            Reverting <strong>{revertQuote.quoteNumber || revertQuote.quotationCode}</strong> will change its status back to <strong>Draft</strong> and soft-delete/cancel any linked Invoice or Project.
                        </p>
                        <form onSubmit={handleRevertConversionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Admin Password Required:
                                </label>
                                <input
                                    type="password"
                                    value={revertAdminPassword}
                                    onChange={(e) => setRevertAdminPassword(e.target.value)}
                                    placeholder="Enter Admin Password to confirm"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button variant="outline" type="button" onClick={() => setIsRevertModalOpen(false)}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={reverting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                                    Confirm Revert
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Convert to Invoice Modal */}
            {isConvertToInvoiceOpen && (selectedConvertQuoteForInvoice || previewQuote) && (() => {
                const targetQuote = selectedConvertQuoteForInvoice || previewQuote;
                return (
                    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-[slideUp_0.2s_ease-out]">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800">Convert to Invoice</h3>
                                <button onClick={() => { setIsConvertToInvoiceOpen(false); setSelectedConvertQuoteForInvoice(null); }} className="text-gray-400 hover:text-slate-600 text-lg font-bold">×</button>
                            </div>
                            <form onSubmit={handleConvertToInvoiceSubmit} className="space-y-4">
                                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                                    <p className="text-xs font-bold text-purple-900 uppercase">Document: {targetQuote.quoteNumber || targetQuote.quotationCode}</p>
                                    <p className="text-sm font-bold text-purple-950 mt-0.5">Grand Total: LKR {(targetQuote.grandTotal || targetQuote.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Invoice Type</label>
                                <select
                                    value={convertInvoiceType}
                                    onChange={(e) => setConvertInvoiceType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                >
                                    <option value="commercial">Commercial / Standard Tax Invoice</option>
                                    <option value="proforma">Proforma Invoice (PI)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Advance Payment Amount (LKR)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={convertInvoiceAdvanceAmount}
                                    onChange={(e) => setConvertInvoiceAdvanceAmount(e.target.value)}
                                    placeholder="e.g. 50000"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold font-mono bg-white"
                                />
                                <p className="text-[11px] text-gray-500">Entering an advance amount will deduct it from the total invoice amount and show balance due.</p>
                            </div>

                            {Number(convertInvoiceAdvanceAmount) > 0 && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 uppercase">Payment Method</label>
                                        <select
                                            value={convertInvoicePaymentMethod}
                                            onChange={(e) => setConvertInvoicePaymentMethod(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="card">Card</option>
                                            <option value="cheque">Cheque</option>
                                        </select>
                                    </div>

                                    {(convertInvoicePaymentMethod === 'bank_transfer' || convertInvoicePaymentMethod === 'cheque') && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-700 uppercase">Company Bank Account</label>
                                            <select
                                                value={convertInvoiceBankAccountId}
                                                onChange={(e) => setConvertInvoiceBankAccountId(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                            >
                                                <option value="">-- Select Bank Account --</option>
                                                {bankAccounts.map((acc) => (
                                                    <option key={acc._id} value={acc._id}>
                                                        {acc.bankName} ({acc.accountNumber}) - Bal: LKR {acc.balance?.toLocaleString()}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 uppercase">Payment Reference / Notes</label>
                                        <input
                                            type="text"
                                            value={convertInvoiceReference}
                                            onChange={(e) => setConvertInvoiceReference(e.target.value)}
                                            placeholder="Txn ID, cheque #, or reference"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <Button variant="outline" type="button" onClick={() => { setIsConvertToInvoiceOpen(false); setSelectedConvertQuoteForInvoice(null); }}>Cancel</Button>
                                <Button variant="primary" type="submit" loading={saving} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                                    Confirm Conversion
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })()}

            <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
                title="Delete Document" message={`Permanently remove ${deleting?.quoteNumber || deleting?.quotationCode}?`} />
        </div>
    );
};

export default QuotationsPage;
