import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';

export default function ShareDocumentSmsModal({ isOpen, onClose, documentId, documentType, defaultPhone = '' }) {
    const [phone, setPhone] = useState(defaultPhone);
    const [sending, setSending] = useState(false);

    const handleShare = async (e) => {
        e.preventDefault();
        if (!phone.trim()) {
            toast.error('Please enter a valid phone number');
            return;
        }
        setSending(true);
        try {
            const res = await api.post(`/documents/${documentId}/share-sms`, {
                phone,
                documentType
            });
            if (res.data && res.data.success) {
                toast.success('Document link successfully shared via SMS!');
                onClose();
            } else {
                toast.error('Failed to share document.');
            }
        } catch (err) {
            toast.error('Sharing failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Link via SMS" size="sm">
            <form onSubmit={handleShare} className="space-y-4 font-calibri">
                <p className="text-xs text-gray-500">
                    This will send an instant SMS containing a passwordless public link to view this {documentType}. A copy will also be dispatched to the Manager.
                </p>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Recipient Phone Number</label>
                    <input 
                        type="tel" 
                        required
                        placeholder="e.g. +94771234567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        disabled={sending}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" loading={sending}>
                        <Send size={14} className="mr-1" /> Send Link
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
