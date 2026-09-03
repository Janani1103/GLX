import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function CustomerAutocompleteSelect({
    label,
    placeholder,
    customers = [],
    value,
    onChange,
    onCreated,
    required = false,
    disabled = false
}) {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [localCustomers, setLocalCustomers] = useState([]);
    const wrapperRef = useRef(null);
    const blurTimeoutRef = useRef(null);
    const isCreatingRef = useRef(false);

    // Fetch customers automatically if prop is not provided or empty
    useEffect(() => {
        if (Array.isArray(customers) && customers.length > 0) {
            setLocalCustomers(customers);
        } else {
            api.get('/customers?limit=500')
                .then((res) => {
                    const list = res.data?.data || res.data || [];
                    if (Array.isArray(list)) {
                        setLocalCustomers(list);
                    }
                })
                .catch((err) => {
                    console.error('Failed to fetch customers in Autocomplete:', err);
                });
        }
    }, [customers]);

    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    // Sync input value with external value change
    useEffect(() => {
        if (isValidObjectId(value)) {
            const found = localCustomers.find(c => c._id === value);
            if (found) {
                setInputValue(found.displayName || found.companyName || `${found.firstName || ''} ${found.lastName || ''}`.trim());
            }
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        } else if (!value) {
            setInputValue('');
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        } else {
            setInputValue(value);
        }
    }, [value, localCustomers]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Handle clicks outside of dropdown to close it
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    const queryLower = (inputValue || '').toLowerCase();
    const filtered = localCustomers.filter(c => {
        const name = (c.displayName || c.companyName || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase();
        const code = (c.customerCode || '').toLowerCase();
        const phone = (c.primaryContact?.phone || c.primaryContact?.mobile || '').toLowerCase();
        return name.includes(queryLower) || code.includes(queryLower) || phone.includes(queryLower);
    });

    const handleSelectOption = (customer) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }
        const selectedName = customer.displayName || customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
        setInputValue(selectedName);
        onChange(customer._id, customer);
        setIsOpen(false);
    };

    // Auto-create customer if it doesn't exist
    const handleAutoCreate = async (nameToCreate) => {
        if (!nameToCreate || !nameToCreate.trim() || isCreatingRef.current) return;

        // Check if customer with exact same name already exists in local list
        const nameClean = nameToCreate.trim();
        const existing = localCustomers.find(c =>
            (c.displayName || c.companyName || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase() === nameClean.toLowerCase()
        );
        if (existing) {
            handleSelectOption(existing);
            return;
        }

        isCreatingRef.current = true;
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }

        // Parse name and phone
        const match = nameClean.match(/(\+?\d{8,14})/);
        let phone = '';
        let displayName = nameClean;
        if (match) {
            phone = match[1];
            displayName = nameClean.replace(phone, '').trim();
            if (!displayName) {
                displayName = `Customer ${phone}`;
            }
        }

        try {
            const payload = {
                displayName,
                legalName: displayName,
                status: 'active',
                primaryContact: phone ? {
                    phone,
                    name: displayName
                } : undefined,
                paymentTerms: {
                    type: 'cod',
                    creditDays: 0,
                    creditLimit: 0,
                },
            };

            const res = await api.post('/customers', payload);
            if (res.data?.success && res.data?.data) {
                const newCust = res.data.data;
                toast.success(`Created customer: ${newCust.displayName}`);
                
                // Add to local state list
                setLocalCustomers(prev => {
                    if (prev.some(c => c._id === newCust._id)) return prev;
                    return [...prev, newCust];
                });
                setInputValue(newCust.displayName);
                onChange(newCust._id, newCust);
                onCreated?.(newCust);
            }
        } catch (err) {
            console.error('Customer auto-creation failed:', err.response?.data || err);
            toast.error(err.response?.data?.message || 'Failed to auto-create new customer');
        } finally {
            isCreatingRef.current = false;
        }
    };

    const handleBlur = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }
        blurTimeoutRef.current = setTimeout(() => {
            if (!inputValue.trim()) {
                onChange('');
                return;
            }
            // Check if exactly matches an option
            const exactMatch = localCustomers.find(c =>
                (c.displayName || c.companyName || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase() === inputValue.trim().toLowerCase()
            );
            if (exactMatch) {
                handleSelectOption(exactMatch);
            }
        }, 250);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!inputValue.trim()) {
                onChange('');
                setIsOpen(false);
                return;
            }
            const exactMatch = localCustomers.find(c => c.displayName.toLowerCase() === inputValue.trim().toLowerCase());
            if (exactMatch) {
                setInputValue(exactMatch.displayName);
                onChange(exactMatch._id, exactMatch);
                setIsOpen(false);
            } else {
                handleAutoCreate(inputValue);
                setIsOpen(false);
            }
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            {label && <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    placeholder={placeholder || "Search or type to add..."}
                    value={inputValue}
                    onChange={(e) => {
                        const val = e.target.value;
                        setInputValue(val);
                        onChange(val);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium"
                />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filtered.map(c => (
                        <button
                            key={c._id}
                            type="button"
                            onMouseDown={() => handleSelectOption(c)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition flex items-center justify-between"
                        >
                            <span className="font-medium text-gray-900">{c.displayName || c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim()}</span>
                            <span className="text-gray-400 text-xs font-mono">({c.customerCode || 'CUST'}{c.primaryContact?.phone ? ` - ${c.primaryContact.phone}` : ''})</span>
                        </button>
                    ))}
                    {inputValue.trim() && !localCustomers.some(c => c.displayName.toLowerCase() === inputValue.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={() => handleAutoCreate(inputValue)}
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 font-semibold border-t border-gray-100 flex items-center gap-1.5"
                        >
                            <span>+ Create new: "{inputValue.trim()}"</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
